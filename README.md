# Strong Air - Workforce Management Platform

A production-ready MVP web application for construction workforce management with admin panel, job tracking, clock-in/out system, analytics dashboard, and internal messaging.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI (Python), SQLAlchemy async, Pydantic v2 |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh tokens), bcrypt |
| Deployment | Docker + Docker Compose, Nginx |

## Features

- **User Management**: Registration with admin approval, role-based access (Super Admin, Admin, Worker)
- **Job Management**: Create, edit, archive jobs with worker assignment
- **Clock System**: Clock in/out with one-session-per-user enforcement, duration tracking
- **Analytics Dashboard**: Hours by user (bar), hours by job (bar), hours over time (line), date filtering
- **Messaging**: Threaded messages, unread badges, multi-recipient support
- **Profile**: Workers can update their details

## Quick Start (Docker)

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your SECRET_KEY

# Start all services
docker compose up -d

# Seed demo data
docker compose exec backend python seed.py

# Access at http://localhost
```

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@strongair.com | admin123 |
| Admin | manager@strongair.com | manager123 |
| Worker | john@strongair.com | worker123 |
| Worker | sarah@strongair.com | worker123 |
| Worker | mike@strongair.com | worker123 |
| Worker | lisa@strongair.com | worker123 |
| Pending | newworker@strongair.com | worker123 |

## API Endpoints

| Module | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/api/auth` | POST /register, /login, /refresh; GET /me |
| Users | `/api/users` | GET /, /pending; PATCH /{id}/approve, /me; POST /admin |
| Jobs | `/api/jobs` | GET /, /{id}, /my/assigned; POST /, /{id}/assign |
| Clock | `/api/clock` | POST /in, /out; GET /active, /sessions |
| Messages | `/api/messages` | GET /threads, /unread-count; POST /threads, /threads/{id}/reply |
| Analytics | `/api/analytics` | GET /summary, /hours-by-user, /hours-by-job, /hours-over-time |

## Project Structure

```
/app/
├── backend/
│   ├── server.py          # FastAPI application
│   ├── database.py        # SQLAlchemy async engine
│   ├── models.py          # ORM models
│   ├── schemas.py         # Pydantic schemas
│   ├── auth.py            # JWT + password utilities
│   ├── seed.py            # Demo data seeder
│   ├── routers/           # API route modules
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/           # Axios API client
│   │   ├── types/         # TypeScript interfaces
│   │   ├── pages/         # Route pages (admin, worker, auth)
│   │   ├── components/    # Shared components
│   │   └── App.tsx        # Main router
│   ├── Dockerfile
│   └── package.json
├── nginx/                 # Nginx config
├── docker-compose.yml     # Production stack
└── README.md
```
