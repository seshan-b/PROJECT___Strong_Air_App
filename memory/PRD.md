# Strong Air - Product Requirements Document

## Original Problem Statement
Build a production-ready MVP web application called Strong Air - a workforce management platform with admin panel, user registration/approval, job creation/assignment, clock-in/clock-out tracking, admin dashboard with charts, and internal messaging system.

## Architecture
- **Frontend**: React 18 + TypeScript, Tailwind CSS, Recharts
- **Backend**: FastAPI (Python), SQLAlchemy async + asyncpg
- **Database**: PostgreSQL 16
- **Auth**: JWT (access + refresh tokens) with bcrypt hashing
- **Deployment**: Docker Compose + Nginx (reference configs included)

## User Personas
1. **Super Admin**: Full system control — manage users, jobs, analytics, messaging
2. **Worker**: View assigned jobs, clock in/out, view hours, messaging, profile

## Core Requirements
- [x] User registration with admin approval (pending → verified)
- [x] JWT authentication with access + refresh tokens
- [x] Role-based access control (superadmin, admin, user)
- [x] Job CRUD with worker assignment
- [x] Clock in/out with single-session enforcement
- [x] Admin analytics dashboard (3 chart types with date filters)
- [x] Internal messaging system with unread badges
- [x] Worker dashboard with clock widget + elapsed timer
- [x] Worker profile management
- [x] Seed script with demo data

## What's Been Implemented (Jan 2026)
### Backend
- FastAPI server with 6 router modules (auth, users, jobs, clock, messages, analytics)
- PostgreSQL with 7 tables (users, jobs, job_assignments, clock_sessions, message_threads, messages, message_recipients)
- JWT authentication with string-based sub field
- Role-based middleware (require_role, require_verified)
- Analytics aggregation queries with date filtering
- Database seed script with 7 demo accounts + sample data

### Frontend
- Login/Register pages with hero image split layout
- Admin dashboard with 5 stat cards + 3 Recharts charts
- User management with approve/reject/suspend + search + filter
- Job management with CRUD, assignment modal, archive
- Clock sessions view with filters
- Worker dashboard with clock widget, job selector, live elapsed timer
- Worker hours page with summary
- Worker profile page
- Shared messaging system with thread list, unread badges, reply
- Dark sidebar navigation with role-based links
- Responsive layout with Manrope + IBM Plex Sans typography

### DevOps Reference Files
- Docker Compose configuration
- Nginx reverse proxy config
- Backend + Frontend Dockerfiles

## Prioritized Backlog
### P0 (Critical)
- All core features implemented ✅

### P1 (High)
- Mobile-responsive bottom nav for worker view
- Password reset flow
- Pagination for large datasets (users, sessions)

### P2 (Medium)
- Admin session editing with audit trail
- Timesheet auto-generation
- CSV export for clock sessions
- Email notifications (SendGrid integration)

### P3 (Low/Future)
- Real-time WebSocket for messaging
- Push notifications
- Leave management module
- Payroll integration
- Multi-timezone support for international teams

## Next Tasks
1. Mobile responsive improvements for worker app
2. Pagination for users/sessions lists
3. Password reset functionality
4. Session edit + audit logging
