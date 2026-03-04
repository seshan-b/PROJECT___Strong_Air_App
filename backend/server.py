# server.py
# This is the main entry point for the backend API.
# It creates the FastAPI app, sets up CORS (so the frontend can talk to it),
# and registers all the route groups (auth, users, jobs, clock, messages, analytics).
# When the server starts, it also runs init_db() to make sure all database tables exist.

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routers.auth_router import router as auth_router
from routers.users_router import router as users_router
from routers.jobs_router import router as jobs_router
from routers.clock_router import router as clock_router
from routers.messages_router import router as messages_router
from routers.analytics_router import router as analytics_router
from dotenv import load_dotenv

load_dotenv()


# lifespan runs once when the server starts up.
# We use it to ensure the database tables are created before any request comes in.
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="Strong Air API", version="1.0.0", lifespan=lifespan)

# ALLOWED_ORIGINS controls which frontend URLs are allowed to send requests.
# In production, set this environment variable to your real frontend URL.
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route groups. Each router handles a different part of the app.
app.include_router(auth_router)       # /api/auth — login, register, token refresh
app.include_router(users_router)      # /api/users — manage user accounts
app.include_router(jobs_router)       # /api/jobs — manage jobs and worker assignments
app.include_router(clock_router)      # /api/clock — clock in and clock out
app.include_router(messages_router)   # /api/messages — messaging between users
app.include_router(analytics_router)  # /api/analytics — dashboard stats and charts


# Simple health check endpoint. Useful for monitoring and deployment checks.
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Strong Air API"}
