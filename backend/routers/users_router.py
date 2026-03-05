from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, UserRole, UserStatus, ClockSession, JobAssignment, MessageThread
from sqlalchemy import delete
from schemas import UserResponse, UserUpdateRequest, ApproveUserRequest, ChangeRoleRequest
from auth import get_current_user, require_role, require_verified, hash_password
from typing import List
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    status: str = None,
    role: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    query = select(User)
    if status:
        query = query.where(User.status == status)
    if role:
        query = query.where(User.role == role)
    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    active_result = await db.execute(
        select(ClockSession.user_id).where(ClockSession.clock_out.is_(None))
    )
    active_user_ids = set(active_result.scalars().all())

    # A user is considered active if they made any API call within the last 5 minutes.
    # last_active_at is updated on every authenticated request (see auth.py get_current_user).
    session_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)

    return [
        UserResponse.model_validate(u).model_copy(update={
            "is_clocked_in": u.id in active_user_ids,
            "is_active_session": (
                u.last_active_at is not None and u.last_active_at > session_cutoff
            ),
        })
        for u in users
    ]


@router.get("/directory", response_model=List[UserResponse])
async def user_directory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All verified users — accessible to any authenticated user for messaging."""
    result = await db.execute(
        select(User).where(User.status == UserStatus.verified).order_by(User.name.asc())
    )
    return result.scalars().all()


@router.get("/pending", response_model=List[UserResponse])
async def list_pending_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(
        select(User).where(User.status == UserStatus.pending).order_by(User.created_at.desc())
    )
    return result.scalars().all()


@router.patch("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: int,
    req: ApproveUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.status not in ["verified", "suspended"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    user.status = req.status
    # When suspending, remove the worker from all job assignments
    if req.status == "suspended":
        await db.execute(delete(JobAssignment).where(JobAssignment.user_id == user_id))
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}/role", response_model=UserResponse)
async def change_user_role(
    user_id: int,
    req: ChangeRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.role not in ["user", "superadmin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    user.role = req.role
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    req: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.name is not None:
        current_user.name = req.name
    if req.phone is not None:
        current_user.phone = req.phone
    if req.email is not None:
        existing = await db.execute(select(User).where(User.email == req.email, User.id != current_user.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = req.email
    if req.username is not None:
        existing = await db.execute(select(User).where(User.username == req.username, User.id != current_user.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = req.username
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # MessageThread.created_by has no ON DELETE CASCADE, so delete the user's
    # threads first (DB cascade handles their child messages/recipients).
    await db.execute(delete(MessageThread).where(MessageThread.created_by == user_id))
    # All other FK references to users have ON DELETE CASCADE at the DB level.
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    return {"detail": "User deleted"}
