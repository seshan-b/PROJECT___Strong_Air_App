from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, UserRole, UserStatus
from schemas import UserResponse, UserUpdateRequest, ApproveUserRequest
from auth import get_current_user, require_role, hash_password
from typing import List

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[UserResponse])
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
    await db.delete(user)
    await db.commit()
    return {"detail": "User deleted"}
