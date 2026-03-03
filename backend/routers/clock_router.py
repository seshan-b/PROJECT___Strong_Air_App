from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from database import get_db
from models import ClockSession, JobAssignment, User, UserRole, UserStatus
from schemas import ClockInRequest, ClockSessionResponse
from auth import get_current_user, require_role
from datetime import datetime, timezone, timedelta
from typing import List, Optional

router = APIRouter(prefix="/api/clock", tags=["clock"])


@router.post("/in", response_model=ClockSessionResponse)
async def clock_in(
    req: ClockInRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.status != UserStatus.verified:
        raise HTTPException(status_code=403, detail="Account not verified")

    # Check user is assigned to this job
    assignment = await db.execute(
        select(JobAssignment).where(
            JobAssignment.job_id == req.job_id,
            JobAssignment.user_id == current_user.id,
        )
    )
    if not assignment.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not assigned to this job")

    # Check for active session (prevent double clock-in)
    active = await db.execute(
        select(ClockSession).where(
            ClockSession.user_id == current_user.id,
            ClockSession.clock_out.is_(None),
        )
    )
    if active.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already clocked in to a job")

    session = ClockSession(
        user_id=current_user.id,
        job_id=req.job_id,
        clock_in=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ClockSessionResponse(
        id=session.id,
        user_id=session.user_id,
        job_id=session.job_id,
        clock_in=session.clock_in,
        clock_out=session.clock_out,
        duration_minutes=session.duration_minutes,
    )


@router.post("/out", response_model=ClockSessionResponse)
async def clock_out(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.status != UserStatus.verified:
        raise HTTPException(status_code=403, detail="Account not verified")

    result = await db.execute(
        select(ClockSession).where(
            ClockSession.user_id == current_user.id,
            ClockSession.clock_out.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=400, detail="No active clock session")

    now = datetime.now(timezone.utc)
    session.clock_out = now
    duration = (now - session.clock_in).total_seconds() / 60
    session.duration_minutes = round(duration, 2)

    await db.commit()
    await db.refresh(session)
    return ClockSessionResponse(
        id=session.id,
        user_id=session.user_id,
        job_id=session.job_id,
        clock_in=session.clock_in,
        clock_out=session.clock_out,
        duration_minutes=session.duration_minutes,
    )


@router.get("/active", response_model=Optional[ClockSessionResponse])
async def get_active_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ClockSession).where(
            ClockSession.user_id == current_user.id,
            ClockSession.clock_out.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    return ClockSessionResponse(
        id=session.id,
        user_id=session.user_id,
        job_id=session.job_id,
        clock_in=session.clock_in,
        clock_out=session.clock_out,
        duration_minutes=session.duration_minutes,
    )


@router.get("/sessions", response_model=List[ClockSessionResponse])
async def list_sessions(
    user_id: Optional[int] = None,
    job_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(ClockSession)

    # Workers can only see their own sessions
    if current_user.role == UserRole.user:
        query = query.where(ClockSession.user_id == current_user.id)
    elif user_id:
        query = query.where(ClockSession.user_id == user_id)

    if job_id:
        query = query.where(ClockSession.job_id == job_id)
    if start_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        query = query.where(ClockSession.clock_in >= start_dt)
    if end_date:
        # Include the full end day by using the start of the following day
        end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(tzinfo=timezone.utc) + timedelta(days=1)
        query = query.where(ClockSession.clock_in < end_dt)

    query = query.order_by(ClockSession.clock_in.desc())
    result = await db.execute(query)
    sessions = result.scalars().all()

    response = []
    for s in sessions:
        # Get user name and job title
        user_result = await db.execute(select(User).where(User.id == s.user_id))
        user = user_result.scalar_one_or_none()
        from models import Job
        job_result = await db.execute(select(Job).where(Job.id == s.job_id))
        job = job_result.scalar_one_or_none()

        response.append(ClockSessionResponse(
            id=s.id,
            user_id=s.user_id,
            job_id=s.job_id,
            clock_in=s.clock_in,
            clock_out=s.clock_out,
            duration_minutes=s.duration_minutes,
            user_name=user.name if user else None,
            job_title=job.title if job else None,
        ))
    return response
