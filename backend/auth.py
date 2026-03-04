# auth.py
# Handles everything related to security: passwords and tokens.
#
# How login works in this app:
#   1. User sends their email + password.
#   2. We check the password against the stored hash (never store plain passwords).
#   3. If correct, we give them two tokens:
#        - access_token  : short-lived (30 min), used on every API request
#        - refresh_token : long-lived (7 days), used only to get a new access token
#   4. The frontend stores both tokens in localStorage and sends the access token
#      in the "Authorization: Bearer <token>" header on every request.
#
# Token type is "HS256" — a standard signed token format.
# SECRET_KEY must be changed to something secret in production.

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, UserRole, UserStatus
import os

# These values can be overridden with environment variables in production.
SECRET_KEY = os.environ.get("SECRET_KEY", "strongair-super-secret-key-change-in-production-2024")
ALGORITHM = os.environ.get("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# pwd_context handles all password hashing using bcrypt (a secure one-way algorithm).
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# security reads the "Authorization: Bearer <token>" header from incoming requests.
security = HTTPBearer()


# Turns a plain-text password into a secure hash for storage.
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# Checks if a plain password matches the stored hash. Returns True or False.
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# Creates a short-lived access token. The token contains the user's ID and role
# so we don't need to hit the database on every request just to know who they are.
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # Ensure sub is a string as required by python-jose
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Creates a long-lived refresh token. Used only to get a new access token when it expires.
def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    # Ensure sub is a string as required by python-jose
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# get_current_user is used as a dependency in any route that requires login.
# It reads the token from the request header, decodes it, and returns the User object.
# If the token is missing, expired, or invalid, it raises a 401 error.
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        # Convert string back to int for database lookup
        user_id = int(user_id_str)
    except (JWTError, ValueError, TypeError) as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    # Keep last_active_at fresh (throttled to one write per minute to avoid excessive DB writes)
    now = datetime.now(timezone.utc)
    if user.last_active_at is None or (now - user.last_active_at).total_seconds() > 60:
        user.last_active_at = now
        await db.commit()

    return user


# require_role is a factory that creates a dependency checking the user's role.
# Example usage: current_user: User = Depends(require_role(UserRole.superadmin))
# Returns a 403 error if the logged-in user doesn't have the required role.
def require_role(*roles: UserRole):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


# require_verified blocks access if the user's account hasn't been approved yet.
# Used on any route a worker shouldn't access while their account is still pending.
def require_verified(current_user: User = Depends(get_current_user)):
    if current_user.status != UserStatus.verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    return current_user