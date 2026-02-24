# Strong Air — Developer Notes

## Overview

Strong Air is a web-based workforce management platform for a construction company. It enables verified worker account management, job creation and assignment, automated clock-in/clock-out tracking, timesheet generation, admin analytics, and secure threaded messaging.

---

## Scope Decisions (v1.0)

- **Leave Management** → deferred to v1.1
- **Email provider** → SendGrid
- **Build approach** → Phase-by-phase (each module verified end-to-end before proceeding)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.12), SQLAlchemy async (asyncpg), Alembic, Pydantic v2 |
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State | TanStack Query (server state), Zustand (auth + clock) |
| Charts | Recharts |
| Database | PostgreSQL 16 |
| Queue | Redis 7 + Celery |
| Email | SendGrid (via `sendgrid` Python SDK) |
| Proxy | Nginx (SSL termination + static file serving) |
| Infra | Docker + Docker Compose, Ubuntu VPS |

---

## Repository Structure

```
PROJECT___Strong_Air_App/
├── docker-compose.yml
├── docker-compose.override.yml       # Dev hot-reload overrides
├── .env.example                      # Committed template — never commit .env
├── Makefile                          # Shortcuts: make up, make migrate, etc.
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml                # Poetry
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── main.py                   # FastAPI app factory
│       ├── config.py                 # pydantic-settings (reads .env)
│       ├── database.py               # Async SQLAlchemy engine + session
│       ├── dependencies.py           # get_current_user, require_role
│       ├── exceptions.py             # Custom exceptions + handlers
│       ├── middleware.py             # Rate limiting, CORS, request logging
│       ├── models/                   # SQLAlchemy ORM models
│       ├── schemas/                  # Pydantic v2 request/response schemas
│       ├── routers/                  # FastAPI APIRouter per module
│       ├── services/                 # Business logic (no DB access in routers)
│       ├── tasks/                    # Celery task modules
│       └── tests/
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/                      # Axios client + typed endpoint wrappers
│       ├── store/                    # Zustand: authStore, clockStore
│       ├── hooks/                    # Custom React hooks
│       ├── pages/                    # Route-level page components
│       ├── components/               # Reusable UI components
│       ├── types/                    # TypeScript interfaces
│       └── utils/                    # timezone.ts, dateFormat.ts, exportCsv.ts
│
├── nginx/
│   ├── nginx.conf
│   └── conf.d/strong-air.conf
│
└── scripts/
    ├── init-db.sh                    # First-run superadmin seed
    ├── backup-db.sh                  # Daily pg_dump called by Celery
    ├── generate-certs.sh             # Let's Encrypt via Certbot
    └── deploy.sh                     # Pull → rebuild → migrate → restart
```

---

## Database Schema

### Tables

**users**
`id, name, email, phone, username, password_hash, role (superadmin|admin|user), status (pending|verified|suspended), created_at`

**jobs**
`id, title, description, image_url, status (active|archived), created_at`

**job_assignments**
`id, job_id, user_id, assigned_at`

**clock_sessions**
`id, user_id, job_id, clock_in (timestamptz), clock_out (timestamptz nullable), duration_minutes, notes, edited_by, edit_reason, edit_timestamp, before_snapshot (jsonb)`

**timesheets**
`id, user_id, period_start, period_end, total_minutes, status (draft|submitted|approved|rejected)`

**audit_logs**
`id, entity_type, entity_id, action, actor_id, before_state (jsonb), after_state (jsonb), reason, created_at`

**message_threads**
`id, created_at`

**messages**
`id, thread_id, sender_id, body, created_at`

**message_recipients**
`id, message_id, recipient_id, is_read, read_at`

### Critical Indexes

```sql
-- Analytics performance (partial index — completed sessions only)
CREATE INDEX idx_cs_analytics ON clock_sessions (clock_in, user_id, job_id)
    WHERE clock_out IS NOT NULL;

-- Active session lookup (used on every clock-in attempt)
CREATE INDEX idx_cs_active ON clock_sessions (user_id)
    WHERE clock_out IS NULL;

-- Messaging unread lookup
CREATE INDEX idx_mr_user ON message_recipients (recipient_id, is_read);

-- Audit trail lookup
CREATE INDEX idx_al_entity ON audit_logs (entity_type, entity_id, created_at DESC);
```

---

## API Endpoints

| Module | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/api/v1/auth` | POST /register, /login, /refresh, /logout; POST /approve/{user_id} |
| Users | `/api/v1/users` | GET /, GET /me, PATCH /me, GET /{id}, DELETE /{id} |
| Jobs | `/api/v1/jobs` | GET /, POST /, GET /{id}, PATCH /{id}, POST /{id}/image |
| Assignments | `/api/v1/assignments` | POST /, DELETE /{id}, GET /job/{id}/users, GET /user/{id}/jobs |
| Clock | `/api/v1/clock` | POST /in, POST /out, GET /active, GET /sessions (admin), PATCH /sessions/{id} |
| Timesheets | `/api/v1/timesheets` | GET /, GET /all (admin), PATCH /{id}/status, GET /{id}/export |
| Messages | `/api/v1/messages` | GET /threads, POST /threads, GET /threads/{id}/messages, POST /broadcast |
| Analytics | `/api/v1/analytics` | GET /hours-by-user, /hours-by-job, /hours-over-time |
| Audit | `/api/v1/audit` | GET / (admin), GET /session/{id} |

---

## Docker Compose Services

| Service | Image | Network | External Ports |
|---|---|---|---|
| `postgres` | postgres:16-alpine | internal | none (dev: 5432) |
| `redis` | redis:7-alpine | internal | none (dev: 6379) |
| `backend` | ./backend | internal | none — Nginx proxies |
| `celery_worker` | ./backend | internal | none |
| `celery_beat` | ./backend | internal | none |
| `nginx` | nginx:1.25-alpine | internal + external | 80, 443 |

Postgres and Redis have **no external port bindings in production**. All inter-service traffic uses the internal Docker network.

---

## Nginx Configuration Summary

```nginx
# HTTP → HTTPS redirect
server { listen 80; return 301 https://$host$request_uri; }

server {
    listen 443 ssl http2;
    # TLSv1.2 + TLSv1.3 only
    # Security headers: X-Frame-Options DENY, HSTS, nosniff
    # Rate limit: 10r/min on /api/v1/auth/login

    location /           { try_files $uri $uri/ /index.html; }  # SPA fallback
    location ~* \.(js|css|...)$ { expires 1y; }                  # Asset caching
    location /api/       { proxy_pass http://backend:8000; }     # API proxy
    location /uploads/   { alias /app/uploads/; expires 30d; }   # Job images
}
```

---

## Celery Beat Schedule

```python
app.conf.beat_schedule = {
    "auto-close-sessions": {
        "task": "tasks.auto_close_midnight_sessions",
        "schedule": crontab(hour=23, minute=59),    # 23:59 NZT daily
    },
    "generate-timesheets": {
        "task": "tasks.generate_period_timesheets",
        "schedule": crontab(hour=0, minute=30, day_of_week=1),  # Monday 00:30 NZT
    },
    "daily-db-backup": {
        "task": "tasks.backup_database",
        "schedule": crontab(hour=2, minute=0),      # 02:00 NZT daily
    },
}
app.conf.timezone = "Pacific/Auckland"
```

---

## Key Implementation Details

### Authentication Security
- **Refresh token** → HttpOnly, Secure, SameSite=Lax cookie (never localStorage); scoped to `/api/v1/auth/refresh` path only
- **Access token** → Zustand memory only (15 min lifetime); never persisted to disk
- **Password hashing** → argon2-cffi

### Clock-In Race Condition Prevention

```python
async with db.begin():
    existing = await db.execute(
        select(ClockSession)
        .where(ClockSession.user_id == user_id, ClockSession.clock_out.is_(None))
        .with_for_update()  # Row-level lock prevents concurrent clock-ins
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Already clocked in")
    db.add(ClockSession(...))
```

### Timezone Handling
- All `DateTime` columns use `timezone=True` → PostgreSQL `TIMESTAMPTZ` (stored in UTC)
- API always returns UTC ISO 8601 strings — no server-side timezone conversion
- Frontend converts for display using `date-fns-tz`:

```typescript
import { toZonedTime, format } from 'date-fns-tz'
const AUCKLAND = 'Pacific/Auckland'

export const toAuckland = (utc: string): string =>
  format(toZonedTime(new Date(utc), AUCKLAND), 'dd/MM/yyyy HH:mm', { timeZone: AUCKLAND })
```

### Email Idempotency (SendGrid via Celery)

```python
# Prevents duplicate emails on task retry
key = f"email_sent:{message_id}:{recipient_id}"
if redis_client.set(key, "1", nx=True, ex=86400):
    sendgrid_client.send(...)  # Only executes if key didn't already exist
```

---

## Implementation Phases

### Phase 0 — Infrastructure Foundation
**Goal:** All containers start healthy. Health endpoint responds.

1. Update `.gitignore` for Python, Docker, env files
2. `docker-compose.yml` + `docker-compose.override.yml`
3. `backend/Dockerfile` + `backend/pyproject.toml` (fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic-settings, python-jose, argon2-cffi, celery[redis], sendgrid, python-multipart)
4. `app/main.py` — FastAPI app + `GET /health`
5. `app/config.py`, `app/database.py`
6. `alembic/env.py` — async SQLAlchemy config
7. `frontend/` scaffold (Vite + React + TS), install tailwindcss, react-router-dom, @tanstack/react-query, zustand, axios, shadcn/ui
8. `nginx/conf.d/strong-air.conf` — HTTP only for dev
9. `.env.example`, `Makefile`

**✓ Verified when:** `docker compose up` → all healthy → `curl http://localhost/health` returns 200

---

### Phase 1 — Authentication & User Lifecycle
**Goal:** Register → pending → admin approves → verified. JWT flow complete.

**Backend:** User model + migration → auth service (argon2, JWT) → dependencies → auth + users routers → rate limiting middleware

**Frontend:** authStore (Zustand) → Axios client with token interceptors → Login, Register, PendingApproval pages → ProtectedRoute → App routing

**✓ Verified when:** Full auth flow works in browser; pending users redirected; tokens refresh silently; rate limit enforced

---

### Phase 2 — Jobs & Assignments
**Goal:** Admin creates jobs (with image upload) and assigns workers.

**Backend:** Job + JobAssignment models + migration → storage service (UUID filenames, MIME validation, 10MB max) → job + assignment services + routers

**Frontend:** JobListPage, JobFormPage (with image upload), JobDetailPage → UserManagementPage, PendingUsersPage

**✓ Verified when:** Admin creates job with image; assigns worker; worker sees only their assigned jobs

---

### Phase 3 — Clock In / Clock Out
**Goal:** Workers clock in/out. Admins edit sessions with audit trail. Auto-close at midnight NZT.

**Backend:** ClockSession + AuditLog models + migration → clock service (SELECT FOR UPDATE, atomic transactions) → audit service → clock router → Celery app + clock tasks (midnight auto-close)

**Frontend:** clockStore (Zustand) → timezone utils → ClockWidget (job selector, elapsed timer) → ClockPage

**✓ Verified when:** Clock in/out works; duplicate clock-in returns 409; auto-close fires at midnight; admin edit creates audit log with before/after snapshot

---

### Phase 4 — Timesheets
**Goal:** Auto-generated timesheets per pay period. Admin can approve/reject/export.

**Backend:** Timesheet model + migration → timesheet service (idempotent generation via ON CONFLICT, CSV export) → timesheets router → Celery beat task (Monday 00:30 NZT)

**Frontend:** MyTimesheetsPage (worker) → TimesheetReviewPage (admin) → TimesheetTable component → exportCsv util

**✓ Verified when:** Totals match session sums; idempotent regeneration; admin approves/rejects; CSV downloads correctly

---

### Phase 5 — Messaging & Email
**Goal:** Threaded messaging with SendGrid notifications via Celery. No duplicate sends on retry.

**Backend:** MessageThread + Message + MessageRecipient models + migration → message service (broadcast resolves job assignments) → messages router → email tasks (Redis SET NX idempotency)

**Frontend:** InboxPage (unread badges) → ThreadPage (history + reply) → MessageComposer → admin broadcast UI (individual / job group / all)

**✓ Verified when:** Message → email received; job broadcast reaches all assigned users; task retry doesn't resend

---

### Phase 6 — Analytics Dashboard
**Goal:** 3 chart types with filters. Response <2s for 500 users over 2 years of data.

**Backend:** analytics service (raw SQL, not ORM; Redis cache 60s TTL) → analytics router

**Frontend:** AnalyticsPage → HoursBarChart (users) → HoursBarChart (jobs) → HoursLineChart (time series) → FilterPanel (date range + multi-select)

**✓ Verified when:** Charts render; filters work; <2s response with production-scale seed data

---

### Phase 7 — Audit Log UI
**Goal:** Admin can view full audit trail for all time session edits.

**Backend:** audit router (paginated, filterable)

**Frontend:** AuditLogPage — timestamp, actor, entity, before/after values, reason

**✓ Verified when:** Edit a session → appears in audit log with full before/after data

---

### Phase 8 — Production Hardening & DevOps
**Goal:** VPS-ready, HTTPS, automated backups, log rotation.

1. SSL via Let's Encrypt (`scripts/generate-certs.sh` + Certbot)
2. Nginx log rotation (`/etc/logrotate.d/nginx`)
3. FastAPI structured logging (JSON + X-Request-ID header)
4. Celery log rotation
5. Daily DB backup (`scripts/backup-db.sh` via Celery beat at 02:00 NZT, keeps 14 days)
6. Deploy script (`scripts/deploy.sh`): pull → build → migrate → restart
7. First-run superadmin seed (`scripts/init-db.sh`)
8. Security audit: all endpoints require auth; Postgres/Redis not publicly exposed
9. Load test analytics endpoint with realistic dataset

**✓ Verified when:** HTTPS live; HTTP redirects; daily backup runs; deploy script zero-downtime; analytics <2s under load

---

## Testing Strategy

### Backend (`pytest` + `pytest-asyncio` + `httpx`)

| File | Coverage |
|---|---|
| `test_auth.py` | Register, login, refresh, rate limit, approval flow |
| `test_clock.py` | Clock in/out, double-clock 409, unassigned job 403, race condition, admin edit + audit, auto-close |
| `test_timesheets.py` | Correct totals, idempotency, approve/reject, CSV export |
| `test_analytics.py` | Correct totals, filters, Redis cache hit, <2s with load |
| `test_messages.py` | Thread creation, broadcast resolver, email idempotency, mark-read |

### Frontend (`Vitest` + `React Testing Library` + `MSW`)
- Auth redirect logic in `ProtectedRoute`
- Clock widget state machine (idle → clocked in → clocked out)
- Role-gated menu item rendering
- Analytics filter → chart update flow

### End-to-End
Each phase ends with a manual smoke test against the local Docker Compose stack matching the `✓ Verified when` criteria before proceeding to the next phase.
