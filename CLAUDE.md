# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Strong Air** is a workforce management platform for a construction company. Features: user approval workflow, job creation/assignment, clock in/out tracking, analytics, threaded messaging.

- **Frontend**: React 18 + TypeScript (Create React App / react-scripts 5), Tailwind CSS, port 3001
- **Backend**: FastAPI (Python), SQLAlchemy ORM (sync), PostgreSQL 16, port 8001
- **Auth**: JWT access tokens + refresh tokens, role-based (superadmin = Admin, user = Worker)

## Development Commands

```bash
# Start everything (postgres container + backend + frontend)
./start.sh dev

# Backend only
cd backend && uvicorn server:app --reload --port 8001

# Frontend only
cd frontend && npm start

# Run backend tests
python backend_test.py
```

Frontend uses `REACT_APP_*` env vars — they must be in `frontend/.env`.

## Architecture

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `server.py` | FastAPI app entry point; registers all routers; runs `init_db()` on startup |
| `models.py` | SQLAlchemy ORM models (User, Job, JobAssignment, ClockSession, MessageThread, Message, MessageRecipient, UserThreadDeletion) |
| `schemas.py` | Pydantic v2 request/response schemas |
| `database.py` | Engine setup; `init_db()` runs `create_all(checkfirst=True)` + any `ALTER TABLE IF NOT EXISTS` for new columns |
| `auth.py` | `get_current_user`, `require_role(role)`, `require_verified` dependencies |
| `routers/` | One file per feature: auth, users, jobs, clock, messages, analytics |

**No Alembic** — schema changes go in `models.py` + manual `ALTER TABLE IF NOT EXISTS` in `database.py:init_db()`.

### Frontend (`frontend/src/`)

| Path | Purpose |
|---|---|
| `api/client.ts` | All Axios calls; token refresh interceptor |
| `types/index.ts` | TypeScript interfaces mirroring backend schemas |
| `pages/admin/` | Admin-only pages (Dashboard, Users, Jobs, ClockSessions) |
| `pages/worker/` | Worker-only pages (Dashboard, Hours, Profile) |
| `pages/shared/MessagesPage.tsx` | Shared inbox used by both roles |
| `components/layout/AppLayout.tsx` | Sidebar + header shell; polls unread message count every 30s |

### Auth Flow

- `require_role(UserRole.superadmin)` — admin-only endpoints
- `require_verified` — blocks pending/suspended users
- `get_current_user` — any authenticated user (e.g. `/api/users/directory`)
- Pydantic v2 validation errors return `detail` as an array of `{type, loc, msg, ...}` — frontend must check `Array.isArray(detail)` and join `.msg` fields

### Messaging System

- `MessageThread` → `Message` → `MessageRecipient` (one per recipient per message)
- Soft delete: `UserThreadDeletion(user_id, thread_id)` hides thread for one user
- Worker delete → soft delete; Admin deletes Admin+Worker thread → hard delete; Admin deletes Admin-only thread → soft delete
- Sending a reply removes all `UserThreadDeletion` records for that thread (un-hides for all)
- Thread list and unread count both poll every 30s

### Key Patterns

- **Route order**: `/directory` must be defined before `/{user_id}` in the same router
- **Cascade deletes**: `db.delete(obj)` without `cascade="all, delete-orphan"` on the relationship won't cascade — use `db.execute(delete(Model).where(...))` to rely on DB-level `ON DELETE CASCADE`
- **Job map**: `JobResponse` must explicitly include `location`, `latitude`, `longitude`; map only renders when both lat/lng are non-null
- **CORS 500s**: 500 errors don't carry CORS headers and appear as CORS errors in the browser console
- **Sidebar**: Auto-collapses on `window.innerWidth < 768`; collapse button is hidden on mobile (`hidden md:flex`)

## Deployment

Production uses Docker Compose (`docker-compose.yml`) with Nginx reverse proxy. All API traffic proxies from `/api/` to the backend container. Static frontend assets are served by Nginx with long cache headers.
