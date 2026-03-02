"""Seed script to create demo data for Strong Air."""
import asyncio
from datetime import datetime, timezone, timedelta
from database import async_session, init_db
from models import User, Job, JobAssignment, ClockSession, MessageThread, Message, MessageRecipient, UserRole, UserStatus, JobStatus
from auth import hash_password


async def seed():
    await init_db()

    async with async_session() as db:
        # Check if already seeded
        from sqlalchemy import select
        existing = await db.execute(select(User).where(User.email == "admin@strongair.com"))
        if existing.scalar_one_or_none():
            print("Database already seeded!")
            return

        # Create Super Admin
        super_admin = User(
            name="Super Admin",
            email="admin@strongair.com",
            username="superadmin",
            password_hash=hash_password("admin123"),
            role=UserRole.superadmin,
            status=UserStatus.verified,
            phone="+64 21 000 0001",
        )
        db.add(super_admin)
        await db.flush()

        # Create Workers
        workers = []
        worker_data = [
            ("John Builder", "john@strongair.com", "johnb", "+64 21 111 0001"),
            ("Sarah Mason", "sarah@strongair.com", "sarahm", "+64 21 111 0002"),
            ("Mike Crane", "mike@strongair.com", "mikec", "+64 21 111 0003"),
            ("Lisa Plumber", "lisa@strongair.com", "lisap", "+64 21 111 0004"),
        ]
        for name, email, username, phone in worker_data:
            worker = User(
                name=name,
                email=email,
                username=username,
                password_hash=hash_password("worker123"),
                role=UserRole.user,
                status=UserStatus.verified,
                phone=phone,
            )
            db.add(worker)
            workers.append(worker)
        await db.flush()

        # Create a pending worker
        pending_worker = User(
            name="New Worker",
            email="newworker@strongair.com",
            username="newworker",
            password_hash=hash_password("worker123"),
            role=UserRole.user,
            status=UserStatus.pending,
            phone="+64 21 111 0005",
        )
        db.add(pending_worker)
        await db.flush()

        # Create Jobs
        jobs = []
        job_data = [
            ("Highway Bridge Repair", "Structural repair work on the main highway bridge overpass."),
            ("Office Tower Foundation", "Foundation laying for the new 12-story office complex downtown."),
            ("Residential Block C", "Construction of residential apartments in Block C of the development."),
            ("Warehouse Renovation", "Interior renovation and structural reinforcement of the old warehouse."),
        ]
        for title, desc in job_data:
            job = Job(title=title, description=desc, status=JobStatus.active)
            db.add(job)
            jobs.append(job)
        await db.flush()

        # Assign workers to jobs
        assignments = [
            (jobs[0].id, workers[0].id),
            (jobs[0].id, workers[1].id),
            (jobs[1].id, workers[1].id),
            (jobs[1].id, workers[2].id),
            (jobs[2].id, workers[2].id),
            (jobs[2].id, workers[3].id),
            (jobs[3].id, workers[0].id),
            (jobs[3].id, workers[3].id),
        ]
        for job_id, user_id in assignments:
            db.add(JobAssignment(job_id=job_id, user_id=user_id))
        await db.flush()

        # Create clock sessions (past 7 days)
        now = datetime.now(timezone.utc)
        for day_offset in range(7, 0, -1):
            day = now - timedelta(days=day_offset)
            for i, worker in enumerate(workers):
                if day_offset % (i + 1) == 0:  # Vary which workers work each day
                    job_idx = i % len(jobs)
                    start = day.replace(hour=8, minute=0, second=0)
                    end = day.replace(hour=16 + (i % 2), minute=30 * (i % 2), second=0)
                    duration = (end - start).total_seconds() / 60
                    session = ClockSession(
                        user_id=worker.id,
                        job_id=jobs[job_idx].id,
                        clock_in=start,
                        clock_out=end,
                        duration_minutes=round(duration, 2),
                    )
                    db.add(session)

        # Create message threads
        thread1 = MessageThread(subject="Safety Meeting Tomorrow", created_by=super_admin.id)
        db.add(thread1)
        await db.flush()

        msg1 = Message(thread_id=thread1.id, sender_id=super_admin.id, body="Reminder: Mandatory safety meeting tomorrow at 7:30 AM in the site office. Please be on time.")
        db.add(msg1)
        await db.flush()

        for worker in workers:
            db.add(MessageRecipient(message_id=msg1.id, recipient_id=worker.id))

        thread2 = MessageThread(subject="Overtime Request", created_by=workers[0].id)
        db.add(thread2)
        await db.flush()

        msg2 = Message(thread_id=thread2.id, sender_id=workers[0].id, body="Hi, I need to work overtime this Saturday for the bridge project. Is that approved?")
        db.add(msg2)
        await db.flush()
        db.add(MessageRecipient(message_id=msg2.id, recipient_id=super_admin.id))

        msg3 = Message(thread_id=thread2.id, sender_id=super_admin.id, body="Approved. Please log your hours as usual.")
        db.add(msg3)
        await db.flush()
        db.add(MessageRecipient(message_id=msg3.id, recipient_id=workers[0].id))

        await db.commit()
        print("Database seeded successfully!")
        print("\nDemo Accounts:")
        print("  Super Admin: admin@strongair.com / admin123")
        print("  Workers: john@strongair.com / worker123")
        print("           sarah@strongair.com / worker123")
        print("           mike@strongair.com / worker123")
        print("           lisa@strongair.com / worker123")
        print("  Pending: newworker@strongair.com / worker123")


if __name__ == "__main__":
    asyncio.run(seed())
