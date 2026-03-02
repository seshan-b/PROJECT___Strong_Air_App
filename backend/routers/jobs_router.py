from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
from models import Job, JobAssignment, User, UserRole, JobStatus
from schemas import JobCreateRequest, JobUpdateRequest, JobResponse, UserResponse, AssignmentRequest, AssignmentResponse
from auth import get_current_user, require_role, require_verified
from typing import List

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/", response_model=List[JobResponse])
async def list_jobs(
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Job)
    if status:
        query = query.where(Job.status == status)
    query = query.order_by(Job.created_at.desc())
    result = await db.execute(query)
    jobs = result.scalars().all()

    response = []
    for job in jobs:
        # Get assigned users
        assignments = await db.execute(
            select(JobAssignment).options(selectinload(JobAssignment.user)).where(JobAssignment.job_id == job.id)
        )
        assigned_users = [
            UserResponse.model_validate(a.user) for a in assignments.scalars().all()
        ]
        job_dict = JobResponse(
            id=job.id,
            title=job.title,
            description=job.description,
            image_url=job.image_url,
            status=job.status.value if isinstance(job.status, JobStatus) else job.status,
            created_at=job.created_at,
            assigned_users=assigned_users,
        )
        response.append(job_dict)
    return response


@router.post("/", response_model=JobResponse)
async def create_job(
    req: JobCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    job = Job(title=req.title, description=req.description, image_url=req.image_url)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        image_url=job.image_url,
        status=job.status.value if isinstance(job.status, JobStatus) else job.status,
        created_at=job.created_at,
        assigned_users=[],
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    assignments = await db.execute(
        select(JobAssignment).options(selectinload(JobAssignment.user)).where(JobAssignment.job_id == job.id)
    )
    assigned_users = [UserResponse.model_validate(a.user) for a in assignments.scalars().all()]
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        image_url=job.image_url,
        status=job.status.value if isinstance(job.status, JobStatus) else job.status,
        created_at=job.created_at,
        assigned_users=assigned_users,
    )


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: int,
    req: JobUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if req.title is not None:
        job.title = req.title
    if req.description is not None:
        job.description = req.description
    if req.image_url is not None:
        job.image_url = req.image_url
    if req.status is not None:
        job.status = req.status
    await db.commit()
    await db.refresh(job)
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        image_url=job.image_url,
        status=job.status.value if isinstance(job.status, JobStatus) else job.status,
        created_at=job.created_at,
        assigned_users=[],
    )


@router.post("/{job_id}/assign", response_model=List[AssignmentResponse])
async def assign_users(
    job_id: int,
    req: AssignmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    assignments = []
    for user_id in req.user_ids:
        # Check user exists
        user_result = await db.execute(select(User).where(User.id == user_id))
        if not user_result.scalar_one_or_none():
            continue
        # Check if already assigned
        existing = await db.execute(
            select(JobAssignment).where(
                JobAssignment.job_id == job_id, JobAssignment.user_id == user_id
            )
        )
        if existing.scalar_one_or_none():
            continue
        assignment = JobAssignment(job_id=job_id, user_id=user_id)
        db.add(assignment)
        assignments.append(assignment)

    await db.commit()
    for a in assignments:
        await db.refresh(a)
    return assignments


@router.delete("/{job_id}/assign/{user_id}")
async def unassign_user(
    job_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    result = await db.execute(
        select(JobAssignment).where(
            JobAssignment.job_id == job_id, JobAssignment.user_id == user_id
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(assignment)
    await db.commit()
    return {"detail": "User unassigned"}


@router.get("/my/assigned", response_model=List[JobResponse])
async def my_assigned_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignments = await db.execute(
        select(JobAssignment).options(selectinload(JobAssignment.job)).where(
            JobAssignment.user_id == current_user.id
        )
    )
    jobs = []
    for a in assignments.scalars().all():
        job = a.job
        if job.status == JobStatus.active or job.status == "active":
            jobs.append(
                JobResponse(
                    id=job.id,
                    title=job.title,
                    description=job.description,
                    image_url=job.image_url,
                    status=job.status.value if isinstance(job.status, JobStatus) else job.status,
                    created_at=job.created_at,
                    assigned_users=[],
                )
            )
    return jobs
