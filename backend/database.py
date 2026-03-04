# database.py
# Sets up the connection to the PostgreSQL database and provides two things:
#   1. get_db() — a helper that gives each API request its own database session,
#      then closes it cleanly when the request is done.
#   2. init_db() — called once at startup to create any missing tables.
#
# The DATABASE_URL environment variable controls which database to connect to.
# The default points to a local PostgreSQL instance for development.

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://strongair:strongair_pass@localhost:5432/strongair_db")

# pool_size and max_overflow control how many database connections can be open at once.
engine = create_async_engine(DATABASE_URL, echo=False, pool_size=10, max_overflow=20)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Base is the parent class for all database models (tables).
# Every model in models.py inherits from this.
class Base(DeclarativeBase):
    pass


# get_db is used as a dependency in every route that needs the database.
# FastAPI automatically calls this, gives the route the session, then closes it.
async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


# init_db creates all tables defined in models.py if they don't exist yet.
# checkfirst=True means it won't try to recreate tables that are already there.
# The ALTER TABLE statements below safely add new columns to existing tables.
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        for sql in [
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location VARCHAR(500)",
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude FLOAT",
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude FLOAT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ",
        ]:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass
