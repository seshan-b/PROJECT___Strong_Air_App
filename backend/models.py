from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Boolean, Text, Enum as SAEnum, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone
import enum


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    user = "user"


class UserStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    suspended = "suspended"


class JobStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    status = Column(SAEnum(UserStatus), default=UserStatus.pending, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    clock_sessions = relationship("ClockSession", back_populates="user")
    job_assignments = relationship("JobAssignment", back_populates="user")
    sent_messages = relationship("Message", back_populates="sender")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    status = Column(SAEnum(JobStatus), default=JobStatus.active, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    assignments = relationship("JobAssignment", back_populates="job")
    clock_sessions = relationship("ClockSession", back_populates="job")


class JobAssignment(Base):
    __tablename__ = "job_assignments"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="assignments")
    user = relationship("User", back_populates="job_assignments")

    __table_args__ = (
        UniqueConstraint("job_id", "user_id", name="uq_job_user_assignment"),
    )


class ClockSession(Base):
    __tablename__ = "clock_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    clock_in = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    clock_out = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="clock_sessions")
    job = relationship("Job", back_populates="clock_sessions")

    __table_args__ = (
        Index("idx_cs_active", "user_id", postgresql_where=(clock_out.is_(None))),
        Index("idx_cs_analytics", "clock_in", "user_id", "job_id", postgresql_where=(clock_out.isnot(None))),
    )


class MessageThread(Base):
    __tablename__ = "message_threads"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(500), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    messages = relationship("Message", back_populates="thread", order_by="Message.created_at")
    creator = relationship("User", foreign_keys=[created_by])


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("message_threads.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    thread = relationship("MessageThread", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
    recipients = relationship("MessageRecipient", back_populates="message")


class MessageRecipient(Base):
    __tablename__ = "message_recipients"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    message = relationship("Message", back_populates="recipients")
    recipient = relationship("User")

    __table_args__ = (
        Index("idx_mr_user", "recipient_id", "is_read"),
    )
