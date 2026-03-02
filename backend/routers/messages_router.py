from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from database import get_db
from models import MessageThread, Message, MessageRecipient, User, UserRole
from schemas import CreateThreadRequest, ReplyRequest, MessageResponse, ThreadResponse
from auth import get_current_user, require_role
from datetime import datetime, timezone
from typing import List

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("/threads", response_model=List[ThreadResponse])
async def list_threads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get threads where user is a recipient or creator
    if current_user.role in [UserRole.superadmin, UserRole.admin]:
        # Admins see threads they created
        result = await db.execute(
            select(MessageThread)
            .where(MessageThread.created_by == current_user.id)
            .order_by(MessageThread.created_at.desc())
        )
        threads_created = list(result.scalars().all())

        # Also threads where they are a recipient
        recipient_thread_ids = await db.execute(
            select(MessageRecipient.message_id).where(MessageRecipient.recipient_id == current_user.id)
        )
        msg_ids = [r[0] for r in recipient_thread_ids.all()]
        thread_ids_from_messages = set()
        for msg_id in msg_ids:
            msg_result = await db.execute(select(Message.thread_id).where(Message.id == msg_id))
            tid = msg_result.scalar_one_or_none()
            if tid:
                thread_ids_from_messages.add(tid)

        created_ids = {t.id for t in threads_created}
        all_thread_ids = created_ids | thread_ids_from_messages

        if all_thread_ids:
            result2 = await db.execute(
                select(MessageThread).where(MessageThread.id.in_(all_thread_ids)).order_by(MessageThread.created_at.desc())
            )
            threads = list(result2.scalars().all())
        else:
            threads = threads_created
    else:
        # Users see threads where they are a recipient
        subq = (
            select(Message.thread_id)
            .join(MessageRecipient)
            .where(MessageRecipient.recipient_id == current_user.id)
            .distinct()
        )
        result = await db.execute(subq)
        thread_ids = [r[0] for r in result.all()]

        # Also threads where user is the creator
        result2 = await db.execute(
            select(MessageThread).where(MessageThread.created_by == current_user.id)
        )
        created_threads = list(result2.scalars().all())
        created_ids = {t.id for t in created_threads}
        all_ids = set(thread_ids) | created_ids

        if all_ids:
            result3 = await db.execute(
                select(MessageThread).where(MessageThread.id.in_(all_ids)).order_by(MessageThread.created_at.desc())
            )
            threads = list(result3.scalars().all())
        else:
            threads = []

    response = []
    for thread in threads:
        # Get last message
        last_msg_result = await db.execute(
            select(Message).where(Message.thread_id == thread.id).order_by(Message.created_at.desc()).limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # Get unread count for current user
        unread_result = await db.execute(
            select(func.count(MessageRecipient.id))
            .join(Message)
            .where(
                Message.thread_id == thread.id,
                MessageRecipient.recipient_id == current_user.id,
                MessageRecipient.is_read == False,
            )
        )
        unread_count = unread_result.scalar() or 0

        last_message = None
        if last_msg:
            sender_result = await db.execute(select(User.name).where(User.id == last_msg.sender_id))
            sender_name = sender_result.scalar_one_or_none()
            last_message = MessageResponse(
                id=last_msg.id,
                thread_id=last_msg.thread_id,
                sender_id=last_msg.sender_id,
                sender_name=sender_name,
                body=last_msg.body,
                created_at=last_msg.created_at,
            )

        response.append(ThreadResponse(
            id=thread.id,
            subject=thread.subject,
            created_by=thread.created_by,
            created_at=thread.created_at,
            last_message=last_message,
            unread_count=unread_count,
        ))

    return response


@router.post("/threads", response_model=ThreadResponse)
async def create_thread(
    req: CreateThreadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = MessageThread(subject=req.subject, created_by=current_user.id)
    db.add(thread)
    await db.flush()

    message = Message(thread_id=thread.id, sender_id=current_user.id, body=req.body)
    db.add(message)
    await db.flush()

    for rid in req.recipient_ids:
        recipient = MessageRecipient(message_id=message.id, recipient_id=rid)
        db.add(recipient)

    await db.commit()
    await db.refresh(thread)

    sender_name = current_user.name
    return ThreadResponse(
        id=thread.id,
        subject=thread.subject,
        created_by=thread.created_by,
        created_at=thread.created_at,
        last_message=MessageResponse(
            id=message.id,
            thread_id=message.thread_id,
            sender_id=message.sender_id,
            sender_name=sender_name,
            body=message.body,
            created_at=message.created_at,
        ),
        unread_count=0,
    )


@router.get("/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def get_thread_messages(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    # Mark messages as read for current user
    for msg in messages:
        read_result = await db.execute(
            select(MessageRecipient).where(
                MessageRecipient.message_id == msg.id,
                MessageRecipient.recipient_id == current_user.id,
                MessageRecipient.is_read == False,
            )
        )
        for mr in read_result.scalars().all():
            mr.is_read = True
            mr.read_at = datetime.now(timezone.utc)

    await db.commit()

    response = []
    for msg in messages:
        sender_result = await db.execute(select(User.name).where(User.id == msg.sender_id))
        sender_name = sender_result.scalar_one_or_none()
        response.append(MessageResponse(
            id=msg.id,
            thread_id=msg.thread_id,
            sender_id=msg.sender_id,
            sender_name=sender_name,
            body=msg.body,
            created_at=msg.created_at,
        ))
    return response


@router.post("/threads/{thread_id}/reply", response_model=MessageResponse)
async def reply_to_thread(
    thread_id: int,
    req: ReplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify thread exists
    thread_result = await db.execute(select(MessageThread).where(MessageThread.id == thread_id))
    thread = thread_result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    message = Message(thread_id=thread_id, sender_id=current_user.id, body=req.body)
    db.add(message)
    await db.flush()

    # Get all participants in the thread (previous recipients + creator) except sender
    all_participants = set()
    all_participants.add(thread.created_by)

    # Get all previous message recipients
    prev_msgs = await db.execute(select(Message.id).where(Message.thread_id == thread_id))
    for msg_row in prev_msgs.all():
        recipients_result = await db.execute(
            select(MessageRecipient.recipient_id).where(MessageRecipient.message_id == msg_row[0])
        )
        for r in recipients_result.all():
            all_participants.add(r[0])

    # Get all senders
    senders_result = await db.execute(
        select(Message.sender_id).where(Message.thread_id == thread_id).distinct()
    )
    for s in senders_result.all():
        all_participants.add(s[0])

    # Remove current sender from recipients
    all_participants.discard(current_user.id)

    for pid in all_participants:
        recipient = MessageRecipient(message_id=message.id, recipient_id=pid)
        db.add(recipient)

    await db.commit()
    await db.refresh(message)

    return MessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_id=message.sender_id,
        sender_name=current_user.name,
        body=message.body,
        created_at=message.created_at,
    )


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count(MessageRecipient.id)).where(
            MessageRecipient.recipient_id == current_user.id,
            MessageRecipient.is_read == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}
