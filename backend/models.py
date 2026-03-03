# models.py
# Defines the database tables as Python classes using SQLAlchemy.
# Each class here maps to one table in the database.
#
# Tables in this file:
#   User            — people who use the app (admins and workers)
#   Job             — construction jobs that workers can be assigned to
#   JobAssignment   — which workers are assigned to which jobs
#   ClockSession    — a record of a worker clocking in and out on a job
#   MessageThread   — a conversation (has a subject and a list of messages)
#   Message         — a single message inside a thread
#   MessageRecipient — tracks who received each message and whether they read it

from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Boolean, Text, Enum as SAEnum, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone
import enum


# UserRole controls what a user can do in the app.
# "superadmin" can manage everything. "user" is a regular worker.
class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    user = "user"


# UserStatus tracks where a user is in the approval lifecycle.
# New accounts start as "pending" until an admin approves them.
class UserStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    suspended = "suspended"


# JobStatus tracks whether a job is currently active or has been archived.
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
    password_hash = Column(String(255), nullable=False)  # Passwords are always stored hashed, never plain text
    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    status = Column(SAEnum(UserStatus), default=UserStatus.pending, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # These relationships let us navigate from a user to their related records.
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


# JobAssignment is a link table — it connects a Job to a User.
# One job can have many workers; one worker can be on many jobs.
# The UniqueConstraint prevents the same worker from being assigned to the same job twice.
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


# ClockSession records a single work session for one worker on one job.
# clock_in is always set when the session is created.
# clock_out and duration_minutes are set when the worker clocks out.
# If clock_out is NULL, the worker is currently clocked in.
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

    # Database indexes to speed up common queries:
    # idx_cs_active — quickly find workers who are currently clocked in (clock_out is NULL)
    # idx_cs_analytics — speeds up the analytics queries that filter by date, user, and job
    __table_args__ = (
        Index("idx_cs_active", "user_id", postgresql_where=(clock_out.is_(None))),
        Index("idx_cs_analytics", "clock_in", "user_id", "job_id", postgresql_where=(clock_out.isnot(None))),
    )


# MessageThread is the container for a conversation.
# It has a subject and tracks who created it.
class MessageThread(Base):
    __tablename__ = "message_threads"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(500), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    messages = relationship("Message", back_populates="thread", order_by="Message.created_at")
    creator = relationship("User", foreign_keys=[created_by])


# Message is a single reply or initial message inside a thread.
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


# MessageRecipient links a Message to each person who received it.
# is_read tracks whether the recipient has opened the message.
# This is how the unread message badge count is calculated.
class MessageRecipient(Base):
    __tablename__ = "message_recipients"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    message = relationship("Message", back_populates="recipients")
    recipient = relationship("User")

    # Index to quickly count unread messages per user
    __table_args__ = (
        Index("idx_mr_user", "recipient_id", "is_read"),
    )
