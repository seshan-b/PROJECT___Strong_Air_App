# routers/auth_router.py
# Handles all authentication endpoints: register, login, token refresh, and "who am I".
#
# Endpoint summary:
#   POST /api/auth/register  — Create a new account (starts as "pending", needs admin approval)
#   POST /api/auth/login     — Log in with email + password, receive two tokens
#   POST /api/auth/refresh   — Exchange a refresh token for a new access token
#   GET  /api/auth/me        — Return the currently logged-in user's data

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, UserRole, UserStatus
from schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse, RefreshRequest
from auth import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user, SECRET_KEY, ALGORITHM
from jose import JWTError, jwt
from datetime import datetime, timezone

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check username uniqueness
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    # New accounts always start as "pending" — an admin must approve them before they can log in.
    user = User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        username=req.username,
        password_hash=hash_password(req.password),
        role=UserRole.user,
        status=UserStatus.pending,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    # Return the same generic error whether the email is wrong or the password is wrong.
    # This prevents an attacker from figuring out which emails are registered.
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.status == UserStatus.pending:
        raise HTTPException(status_code=403, detail="Account pending approval")
    if user.status == UserStatus.suspended:
        raise HTTPException(status_code=403, detail="Account suspended")

    token_data = {"sub": user.id, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(req.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        # Convert string back to int for database lookup
        user_id = int(user_id_str)
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = {"sub": user.id, "role": user.role.value}
    access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current_user.last_active_at = None
    await db.commit()
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
