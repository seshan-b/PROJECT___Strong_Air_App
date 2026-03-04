# routers/messages_router.py
# Handles the inbox and messaging between users.
#
# Endpoint summary:
#   GET  /api/messages/threads               — List all threads the current user is part of
#   POST /api/messages/threads               — Start a new thread (first message + recipients)
#   GET  /api/messages/threads/{id}/messages — Load all messages in a thread (marks them as read)
#   POST /api/messages/threads/{id}/reply    — Reply to a thread
#   GET  /api/messages/unread-count          — Number of unread messages (drives the sidebar badge)
#
# How read/unread works:
#   Each message has a MessageRecipient row for every person who received it.
#   is_read starts as False and is set True when the user opens the thread.
#   The sidebar badge calls /unread-count every 30 seconds to stay up to date.
#
# How delete works:
#   - Worker deletes a thread  → soft delete (only hidden from their inbox; others unaffected).
#   - Admin deletes a thread that contains at least one Worker → hard delete (wipes for everyone).
#   - Admin deletes a thread between Admins only → soft delete (only hidden from that admin's inbox).
#   Soft deletions are stored in user_thread_deletions and filtered out when listing threads.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from database import get_db
from models import MessageThread, Message, MessageRecipient, User, UserRole, UserThreadDeletion
from schemas import CreateThreadRequest, ReplyRequest, MessageResponse, ThreadResponse
from auth import get_current_user, require_role
from datetime import datetime, timezone
from typing import List

router = APIRouter(prefix="/api/messages", tags=["messages"])


async def _soft_delete_thread(db: AsyncSession, user_id: int, thread_id: int) -> None:
    """Hide a thread from one user's inbox without deleting it from the database."""
    existing = await db.execute(
        select(UserThreadDeletion).where(
            UserThreadDeletion.user_id == user_id,
            UserThreadDeletion.thread_id == thread_id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(UserThreadDeletion(user_id=user_id, thread_id=thread_id))
    await db.commit()


@router.get("/threads", response_model=List[ThreadResponse])
async def list_threads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get IDs of threads this user has soft-deleted (hidden from their inbox)
    deleted_result = await db.execute(
        select(UserThreadDeletion.thread_id).where(UserThreadDeletion.user_id == current_user.id)
    )
    deleted_ids = {row[0] for row in deleted_result.all()}

    # Get threads where user is a recipient or creator
    if current_user.role in [UserRole.superadmin]:
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

    # Filter out soft-deleted threads
    threads = [t for t in threads if t.id not in deleted_ids]

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

    # If any recipient previously soft-deleted this thread, un-hide it for them —
    # a new message arriving means the conversation is active again.
    if all_participants:
        await db.execute(
            delete(UserThreadDeletion).where(
                UserThreadDeletion.thread_id == thread_id,
                UserThreadDeletion.user_id.in_(list(all_participants)),
            )
        )

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


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread_result = await db.execute(select(MessageThread).where(MessageThread.id == thread_id))
    thread = thread_result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user.role == UserRole.superadmin:
        # Gather all participant user IDs in this thread
        all_participant_ids = {thread.created_by}

        senders_result = await db.execute(
            select(Message.sender_id).where(Message.thread_id == thread_id).distinct()
        )
        for row in senders_result.all():
            all_participant_ids.add(row[0])

        recip_result = await db.execute(
            select(MessageRecipient.recipient_id)
            .join(Message)
            .where(Message.thread_id == thread_id)
            .distinct()
        )
        for row in recip_result.all():
            all_participant_ids.add(row[0])

        # Check if any participant is a worker
        worker_check = await db.execute(
            select(User.id).where(
                User.id.in_(all_participant_ids),
                User.role == UserRole.user,
            ).limit(1)
        )
        has_workers = worker_check.scalar_one_or_none() is not None

        if has_workers:
            # Hard delete: wipes thread and all messages for everyone
            await db.execute(delete(MessageThread).where(MessageThread.id == thread_id))
            await db.commit()
        else:
            # Admin-to-admin thread: soft delete for just this admin
            await _soft_delete_thread(db, current_user.id, thread_id)
    else:
        # Worker: soft delete from their own inbox only; others are unaffected
        await _soft_delete_thread(db, current_user.id, thread_id)

    return {"detail": "Thread deleted"}


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
