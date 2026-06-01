# Tempora

> Work time tracking and shift management software for the private healthcare and social-care sector.

---

## What is Tempora?

Tempora is a fullstack web application designed specifically for private clinics, hospitals and care homes in Spain. It covers compliance with **Royal Decree-Law 8/2019** (mandatory digital working time records) and is tailored to the collective agreements of the private healthcare sector in Andalusia.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 · TypeScript 5.9 strict · Signals · OnPush · SCSS · PrimeNG |
| State | @ngrx/signals (SignalStore) |
| Backend | Node.js 24 · Express 5.2 · TypeScript 6.0 |
| Database | PostgreSQL 17 (Docker) · Prisma ORM 6 |
| Security | JWT 15min + httpOnly Refresh cookie · Multi-tenant RLS · Row-Level Security |
| Testing | Vitest (frontend + backend) · Playwright (e2e) |
| Real-time | Server-Sent Events (SSE) |
| Monorepo | npm workspaces · `@tempora/shared` (Zod schemas as single source of truth) |

---

## Architecture

```
tempora/
├── frontend/          # Angular 21 SPA
├── backend/           # Express 5 REST API + SSE
├── packages/
│   └── shared/        # Shared Zod types and schemas (CJS + ESM)
├── openspec/          # SDD artifacts (explore, spec, design, tasks)
├── docs/              # Project documentation
└── docker-compose.yml # PostgreSQL 17
```

### Multi-tenancy

Each organisation's data is fully isolated using PostgreSQL **Row Level Security (RLS)**. Tenant context is injected per request via `AsyncLocalStorage` — fail-closed: no context means zero rows visible.

### Roles

| Role | Permissions |
|---|---|
| `ADMIN` | Full organisation management |
| `MANAGER` | Shift management, approvals, reports |
| `EMPLOYEE` | Clock in/out, own records, requests |

---

## Features

- **Time tracking** — responsive web clock-in with geolocation and geofencing
- **Shift management** — schedules, rotating shifts, 12h/24h on-call shifts
- **Absences and holidays** — request and approval workflow
- **Shift swaps** — employee-to-employee requests with manager approval
- **Legal compliance** — immutable records, change log, PDF/Excel export
- **Documents** — per-employee folder with expiry alerts
- **Preventive AI** — legal risk alerts, schedule suggestions, overtime predictions
- **Notifications** — email and web push

---

## Prerequisites

- Node.js 18+
- Docker Desktop
- npm 9+

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/tempora.git
cd tempora
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Start the database

```bash
docker compose up -d
```

### 4. Configure environment variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://tempora_owner:devpassword@localhost:5432/tempora
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
CORS_ORIGIN=http://localhost:4200
COOKIE_SECURE=false
COOKIE_SAMESITE=strict
```

### 5. Run migrations

```bash
# From the project root
NODE_OPTIONS="--use-system-ca" npm run db:migrate
npm run db:rls -w backend
```

### 6. Start development servers

```bash
# Backend (port 3000)
npm run dev -w backend

# Frontend (port 4200)
npm run start -w frontend
```

---

## Testing

```bash
# Backend tests
npm run test -w backend

# Frontend tests
npm run test -w frontend
```

Current status: **27/27 tests passing** (P1 Foundation)

---

## Development Roadmap (SDD Phases)

| Phase | Content | Status |
|---|---|---|
| **P1 — Foundation** | Monorepo, Prisma, RLS, Auth, Org, Employees, Angular core | ✅ Complete |
| **P2 — Shifts** | Shift templates, schedules, rotations, Rules Engine, swaps | 🔄 In progress |
| **P3 — Time Tracking** | Clock in/out, geolocation, geofencing, corrections | ⏳ |
| **P4 — Absences + Rules** | Absences, holidays, collective agreements | ⏳ |
| **P5 — Reporting + Compliance** | Reports, exports, notifications, digital signature | ⏳ |

---

## Legal Compliance

- ✅ Immutable records (append-only enforced at database level)
- ✅ Full audit log with author and timestamp on every change
- ✅ Data stored on servers within the European Economic Area
- ✅ Compliant with RDL 8/2019 and 2025 digital time-tracking reform
- ✅ Automatic validation of minimum 12h rest between shifts (healthcare collective agreement)
- ✅ Annual working hours tracking (1,800h cap — dependency sector agreement)

---

## Development Ecosystem

This project uses **[Gentle-AI](https://github.com/Gentleman-Programming/gentle-ai)** as its AI-powered development ecosystem:

- **SDD** (Spec-Driven Development) for structured planning before any code is written
- **Engram** for persistent memory across sessions
- **Strict TDD** enabled on both frontend and backend
- **GGA** (Guardian Angel) for automatic AI code review on every commit

---

*Tempora — from Latin "tempora", plural of tempus (time)*
