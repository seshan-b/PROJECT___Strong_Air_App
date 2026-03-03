# schemas.py
# Defines the shape of data going in (requests) and coming out (responses) for the API.
#
# Why this file exists:
#   - Request schemas validate incoming data before it touches the database.
#     If a required field is missing or too short, Pydantic rejects it automatically.
#   - Response schemas control exactly what gets sent back to the frontend.
#     For example, UserResponse never includes password_hash — it is intentionally excluded.
#
# Schemas are grouped by feature: Auth, Users, Jobs, Assignments, Clock, Messages, Analytics.

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from models import UserRole, UserStatus, JobStatus


# ── Auth ──────────────────────────────────────────────────────────────────────

# Used when a new user signs up. Phone is optional; everything else is required.
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = None
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)


# Used when a user logs in with email and password.
class LoginRequest(BaseModel):
    email: str
    password: str


# Returned after a successful login or token refresh.
# Includes both tokens and the full user object so the frontend can store the session.
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


# Used when the frontend sends a refresh token to get a new access token.
class RefreshRequest(BaseModel):
    refresh_token: str


# ── Users ─────────────────────────────────────────────────────────────────────

# What the API sends back when returning user data.
# password_hash is intentionally NOT here — we never expose it.
# is_clocked_in is not stored in the database; it is calculated at query time.
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    username: str
    role: str
    status: str
    created_at: datetime
    is_clocked_in: bool = False

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)


class ApproveUserRequest(BaseModel):
    status: str  # verified or suspended


class ChangeRoleRequest(BaseModel):
    role: str  # user or superadmin


# ── Jobs ──
class JobCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None


class JobUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = None


class JobResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    created_at: datetime
    assigned_users: Optional[List[UserResponse]] = None
    has_active_session: bool = False

    class Config:
        from_attributes = True


# ── Assignments ──
class AssignmentRequest(BaseModel):
    job_id: int
    user_ids: List[int]


class AssignmentResponse(BaseModel):
    id: int
    job_id: int
    user_id: int
    assigned_at: datetime

    class Config:
        from_attributes = True


# ── Clock ──
class ClockInRequest(BaseModel):
    job_id: int


class ClockSessionResponse(BaseModel):
    id: int
    user_id: int
    job_id: int
    clock_in: datetime
    clock_out: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    user_name: Optional[str] = None
    job_title: Optional[str] = None

    class Config:
        from_attributes = True


# ── Messages ──
class CreateThreadRequest(BaseModel):
    subject: str = Field(..., min_length=1)
    body: str = Field(..., min_length=1)
    recipient_ids: List[int]


class ReplyRequest(BaseModel):
    body: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    id: int
    thread_id: int
    sender_id: int
    sender_name: Optional[str] = None
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class ThreadResponse(BaseModel):
    id: int
    subject: Optional[str] = None
    created_by: int
    created_at: datetime
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    participants: Optional[List[str]] = None

    class Config:
        from_attributes = True


# ── Analytics ──
class HoursByUserResponse(BaseModel):
    user_id: int
    user_name: str
    total_hours: float


class HoursByJobResponse(BaseModel):
    job_id: int
    job_title: str
    total_hours: float


class HoursOverTimeResponse(BaseModel):
    date: str
    total_hours: float
