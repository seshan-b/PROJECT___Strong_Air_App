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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="Strong Air API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(jobs_router)
app.include_router(clock_router)
app.include_router(messages_router)
app.include_router(analytics_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Strong Air API"}
