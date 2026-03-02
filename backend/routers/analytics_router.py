from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from database import get_db
from models import ClockSession, User, Job, UserRole
from schemas import HoursByUserResponse, HoursByJobResponse, HoursOverTimeResponse
from auth import require_role
from typing import List, Optional

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/hours-by-user", response_model=List[HoursByUserResponse])
async def hours_by_user(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin, UserRole.admin)),
):
    query = (
        select(
            ClockSession.user_id,
            User.name.label("user_name"),
            func.coalesce(func.sum(ClockSession.duration_minutes), 0).label("total_minutes"),
        )
        .join(User, ClockSession.user_id == User.id)
        .where(ClockSession.clock_out.isnot(None))
    )
    if start_date:
        query = query.where(ClockSession.clock_in >= start_date)
    if end_date:
        query = query.where(ClockSession.clock_in <= end_date)
    query = query.group_by(ClockSession.user_id, User.name)
    result = await db.execute(query)

    return [
        HoursByUserResponse(
            user_id=row.user_id,
            user_name=row.user_name,
            total_hours=round(row.total_minutes / 60, 2),
        )
        for row in result.all()
    ]


@router.get("/hours-by-job", response_model=List[HoursByJobResponse])
async def hours_by_job(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin, UserRole.admin)),
):
    query = (
        select(
            ClockSession.job_id,
            Job.title.label("job_title"),
            func.coalesce(func.sum(ClockSession.duration_minutes), 0).label("total_minutes"),
        )
        .join(Job, ClockSession.job_id == Job.id)
        .where(ClockSession.clock_out.isnot(None))
    )
    if start_date:
        query = query.where(ClockSession.clock_in >= start_date)
    if end_date:
        query = query.where(ClockSession.clock_in <= end_date)
    query = query.group_by(ClockSession.job_id, Job.title)
    result = await db.execute(query)

    return [
        HoursByJobResponse(
            job_id=row.job_id,
            job_title=row.job_title,
            total_hours=round(row.total_minutes / 60, 2),
        )
        for row in result.all()
    ]


@router.get("/hours-over-time", response_model=List[HoursOverTimeResponse])
async def hours_over_time(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin, UserRole.admin)),
):
    query = (
        select(
            cast(ClockSession.clock_in, Date).label("date"),
            func.coalesce(func.sum(ClockSession.duration_minutes), 0).label("total_minutes"),
        )
        .where(ClockSession.clock_out.isnot(None))
    )
    if start_date:
        query = query.where(ClockSession.clock_in >= start_date)
    if end_date:
        query = query.where(ClockSession.clock_in <= end_date)
    query = query.group_by(cast(ClockSession.clock_in, Date)).order_by(cast(ClockSession.clock_in, Date))
    result = await db.execute(query)

    return [
        HoursOverTimeResponse(
            date=str(row.date),
            total_hours=round(row.total_minutes / 60, 2),
        )
        for row in result.all()
    ]


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin, UserRole.admin)),
):
    # Total hours
    total_result = await db.execute(
        select(func.coalesce(func.sum(ClockSession.duration_minutes), 0)).where(ClockSession.clock_out.isnot(None))
    )
    total_minutes = total_result.scalar() or 0

    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0

    # Pending users
    from models import UserStatus
    pending_result = await db.execute(
        select(func.count(User.id)).where(User.status == UserStatus.pending)
    )
    pending_users = pending_result.scalar() or 0

    # Active jobs
    from models import JobStatus
    jobs_result = await db.execute(
        select(func.count(Job.id)).where(Job.status == JobStatus.active)
    )
    active_jobs = jobs_result.scalar() or 0

    # Active clock sessions
    active_sessions_result = await db.execute(
        select(func.count(ClockSession.id)).where(ClockSession.clock_out.is_(None))
    )
    active_sessions = active_sessions_result.scalar() or 0

    return {
        "total_hours": round(total_minutes / 60, 2),
        "total_users": total_users,
        "pending_users": pending_users,
        "active_jobs": active_jobs,
        "active_sessions": active_sessions,
    }
