# Proposal: Tempora Core Architecture

**Change:** tempora-core
**Date:** 2026-05-31
**Status:** proposed
**Reviewer gate:** Team lead approval required before any code is written.

---

## 1. Executive Summary

Tempora is a multi-tenant SaaS for **time tracking and shift management** targeting the Spanish private and socio-healthcare sector (residencias, clínicas privadas, centros de día). It solves a regulated, high-friction problem: healthcare operators must legally record daily clock-in/out (`registro de jornada`, Art. 34.9 ET + RD-ley 8/2019), build and publish complex rotating shift schedules (cuadrantes) across centers and units, and stay compliant with collective agreements that vary by client. Existing tools are either generic time-clocks that ignore healthcare shift complexity, or rigid ERPs that don't model the Spanish socio-sanitary categories (TCAE, celador, enfermería) and legal rest constraints.

The architecture is a **TypeScript monorepo** (npm workspaces) with an Angular 21 SPA, an Express 5 REST backend, and a shared package of **Zod schemas** that act as the single source of truth for validation and types across both ends. Persistence is **PostgreSQL with Prisma**, with multi-tenancy enforced both at the application layer (`organization_id` on every row) and at the database layer (**Row Level Security**) as a defense-in-depth safety net. Authentication is **stateless JWT** with a revocation blocklist; live updates use **Server-Sent Events**.

The defining architectural constraint is **regulatory immutability**: the 2026 control-horario reform mandates digital-only, unalterable records with remote Labor Inspection access. Tempora is therefore designed **append-only from day one** — time entries are never mutated; corrections are new records linked to an immutable audit log. Delivery is phased to land a compliant foundation first (auth, org, employees) before layering shifts, time tracking, absences, the rules engine, and reporting.

---

## 2. Architecture Decisions (ADRs)

### ADR-1: Monorepo with npm workspaces + `packages/shared`

- **Decision:** Single Git repo, npm workspaces, three packages: `frontend`, `backend`, `packages/shared`. No Turborepo/Nx initially.
- **Alternatives:** Separate repos with a published types package; Turborepo/Nx from day one; tRPC monorepo.
- **Rationale:** A shared Zod-schema package eliminates type drift between client and server, which is the single biggest correctness risk in a compliance domain. npm workspaces are zero-config and already supported by the installed toolchain; Turborepo/Nx add build orchestration we don't need at this scale yet. tRPC was rejected because the Angular client story is immature and it couples transport to TypeScript, blocking a future mobile/native client.
- **Consequences:** One install, one version line. `packages/shared` must be built/resolvable by both an esbuild Angular build and ts-node CommonJS backend. We commit to keeping schemas framework-agnostic (no Angular/Express imports in `shared`).

### ADR-2: PostgreSQL + Prisma ORM

- **Decision:** PostgreSQL as the database; Prisma as ORM and migration tool.
- **Alternatives:** PostgreSQL + Drizzle; PostgreSQL + raw `pg`; MySQL.
- **Rationale:** PostgreSQL gives us RLS (required for tenant isolation), rich constraints, partial indexes, and `tstzrange` exclusion constraints for shift-overlap detection. Prisma offers type-safe queries, a mature migration workflow, and an auditable schema file — valuable in a regulated domain. Drizzle is compelling but too new to bet a regulated product on; raw `pg` is verbose and error-prone for type mapping.
- **Consequences:** We accept Prisma's RLS caveat — Prisma does not natively set `SET app.current_org`; we must inject the tenant context per request via a transaction/middleware wrapper (see ADR-6). Migrations become the audit-of-record for schema changes.

### ADR-3: REST API + shared Zod schemas

- **Decision:** Resource-oriented REST over HTTP/JSON. Request/response shapes validated by Zod schemas exported from `packages/shared`.
- **Alternatives:** tRPC; OpenAPI-first with codegen; GraphQL.
- **Rationale:** REST is proven, cache-friendly, mobile-friendly, and easy to expose to a future Labor Inspection integration. Sharing Zod schemas gives us tRPC-like type safety without the coupling. OpenAPI codegen is deferred — it adds a third artifact to maintain; we can generate OpenAPI **from** Zod later (`zod-to-openapi`) when compliance docs demand it.
- **Consequences:** Every endpoint validates input with the shared schema at the boundary. We commit to a consistent error envelope and HTTP status conventions. Type safety is enforced by discipline (import the schema) rather than transport.

### ADR-4: JWT auth — short-lived access + httpOnly refresh + blocklist

- **Decision:** 15-min access JWT (Authorization header), 7-day refresh token in an httpOnly, Secure, SameSite cookie, and a `token_blocklist` table for revocation (logout, role change, termination).
- **Alternatives:** Server sessions + Redis; OAuth2/OIDC; long-lived JWT only.
- **Rationale:** Stateless access tokens avoid a DB lookup per request. httpOnly refresh cookies mitigate XSS token theft. The blocklist closes JWT's revocation gap — mandatory because terminating an employee's access immediately is a security and labor requirement. Sessions+Redis add infrastructure; OAuth2/OIDC is overkill for most private clinics (kept as an enterprise SSO add-on).
- **Consequences:** We must run periodic cleanup of expired blocklist rows, and check the blocklist on refresh and on sensitive operations. CSRF protection required for the refresh cookie flow.

### ADR-5: Real-time via Server-Sent Events (SSE)

- **Decision:** SSE for server→client push.
- **Alternatives:** WebSockets; long-polling; short-polling.
- **Rationale:** Every identified live use case is **unidirectional** (server→client): shift-swap notifications, cuadrante publication, live clock-in dashboard. SSE runs over plain HTTP/1.1+, auto-reconnects, and passes through proxies easily. WebSockets add bidirectional complexity we don't need; polling wastes resources.
- **Consequences:** One persistent connection per client; we need an in-process (later Redis) pub/sub fan-out keyed by `organization_id` + user/role. SSE is capped at ~6 connections per domain on HTTP/1.1 — acceptable for a single-tab back-office app; revisit if we add HTTP/2.

### ADR-6: Multi-tenancy — shared DB + `organization_id` + PostgreSQL RLS

- **Decision:** Single shared database. Every tenant-owned table carries a non-null `organization_id`. RLS policies enforce `organization_id = current_setting('app.current_org')`. The backend sets `app.current_org` per request inside a Prisma transaction from the authenticated JWT claim.
- **Alternatives:** Database-per-tenant; schema-per-tenant; app-layer filtering only.
- **Rationale:** Shared DB scales to many small clinics economically. RLS is a database-level guarantee that survives application query bugs — critical when the data is GDPR special-category health data. DB-per-tenant is operationally heavy for many small tenants; app-layer-only filtering is one forgotten `WHERE` clause away from a cross-tenant leak.
- **Consequences:** All tenant queries must run within the tenant-context transaction wrapper; a query outside it returns zero rows by default (fail-closed). We commit to composite indexes leading with `organization_id`. Super-admin/cross-tenant operations need an explicit, audited bypass role.

### ADR-7: Backend module system — keep CommonJS

- **Decision:** Keep `"type": "commonjs"`; run with ts-node + nodemon in dev, compile with `tsc` for prod.
- **Alternatives:** Migrate to ESM (`"type": "module"`); use `tsx`/`tsup` bundling.
- **Rationale:** The backend has no `src/` yet, so there's no migration cost — but CommonJS remains the most frictionless path for ts-node, Prisma, and the Express 5 ecosystem, avoiding ESM interop headaches (dual-package hazard, `__dirname`, import-assertion churn). `packages/shared` will be authored as TypeScript and consumed via path/workspace resolution, so it interops with both CJS backend and esbuild frontend.
- **Consequences:** We forgo top-level `await` and native ESM-only deps in the backend. Revisit if a critical dependency goes ESM-only. `shared` must emit CJS-compatible output (or be consumed as source).

### ADR-8: Frontend state — `@ngrx/signals`

- **Decision:** `@ngrx/signals` (SignalStore) for feature and entity state; plain Angular signals for trivial local component state.
- **Alternatives:** Built-in signals only; classic NgRx (Store/Effects/Actions); Akita.
- **Rationale:** `@ngrx/signals` gives structured, testable stores built directly on Angular's reactivity, with `withEntities`/`withComputed`/`withMethods` for the entity-heavy domain (employees, shifts, time entries) — without classic NgRx boilerplate. It aligns with the project's signal-first conventions (`computed()`, `inject()`).
- **Consequences:** One state primitive across the app. Team learns SignalStore patterns. Cross-feature shared state lives in `core/`-provided stores.

### ADR-9: UI component library — **PrimeNG**

- **Decision:** Adopt **PrimeNG** as the primary component library, themed to a clean clinical palette; build domain-specific components (cuadrante grid, clock widget) in-house.
- **Alternatives:** Angular Material; fully custom design system; Tailwind + headless.
- **Rationale:** Tempora is a **data-dense back-office** for healthcare administrators and unit managers, not a consumer app. PrimeNG ships production-grade **Table (filtering, virtual scroll, frozen columns, CSV/Excel export), DatePicker/Calendar, Tree, Schedule/Timeline, Dialog, Toast** components that map directly to cuadrante grids, monthly schedules, and HR reports — features Angular Material lacks out of the box or requires heavy CDK assembly to build. Excel/CSV export and rich tables are core requirements here, not nice-to-haves. PrimeNG follows Angular's standalone/signals direction and offers WCAG-oriented accessibility needed for a workplace tool.
- **Consequences:** We adopt PrimeNG's theming and depend on its release cadence with Angular 21. We standardize on its form controls (consistent with Reactive Forms). Bespoke domain widgets (shift grid) still need custom work; PrimeNG provides the primitives, not the cuadrante itself.

### ADR-10: Offline strategy — MVP-out, post-MVP Service Worker + IndexedDB

- **Decision:** No offline support in MVP. Post-MVP, add an Angular Service Worker plus an IndexedDB write-queue for clock-in/out under poor connectivity.
- **Alternatives:** Offline-first PWA from day one; no offline ever.
- **Rationale:** Offline-first dramatically complicates the **append-only/immutability** model (conflict resolution, server-authoritative timestamps for legal records). Shipping it MVP would jeopardize the compliance core. But nurses in low-connectivity facilities are a real need, so it's a planned Phase-6 capability, not a discard.
- **Consequences:** Clock-in timestamps are server-authoritative in MVP. The queue design must later reconcile client capture time vs server receipt time without violating immutability (store both, server time is legal record).

---

## 3. System Architecture Overview

```
                        ┌──────────────────────────────────────────┐
                        │           Angular 21 SPA (browser)        │
                        │  Screaming arch · @ngrx/signals · PrimeNG │
                        │  Reactive Forms · OnPush · standalone     │
                        └───────────────┬───────────────┬──────────┘
                       HTTPS REST/JSON  │               │  SSE stream
                  (access JWT in header)│               │ (notifications)
                                        ▼               ▼
                        ┌──────────────────────────────────────────┐
                        │         Express 5 API (CommonJS)          │
                        │  ┌────────────────────────────────────┐   │
                        │  │ Middleware: auth → tenant-context  │   │
                        │  │ → Zod validate → controller        │   │
                        │  └────────────────────────────────────┘   │
                        │  Bounded-context modules · Rules engine   │
                        │  SSE hub (per-org fan-out) · Audit writer │
                        └───────────────┬───────────────┬──────────┘
                          Prisma Client │               │ refresh-token
                       (tenant tx: SET  │               │ httpOnly cookie
                        app.current_org)│               ▼
                                        ▼        ┌─────────────────┐
                        ┌──────────────────────┐ │ token_blocklist │
                        │   PostgreSQL          │ └─────────────────┘
                        │   RLS per org_id      │
                        │   append-only audit   │
                        └──────────────────────┘

        packages/shared (Zod schemas + inferred types) ── imported by ──▶ frontend & backend
```

**Auth flow:** Login → backend verifies credentials → issues access JWT (15 min) + sets httpOnly refresh cookie (7 d). Each API call sends the access JWT; auth middleware verifies it, extracts `organization_id` + `role`, opens a Prisma tenant transaction (`SET app.current_org`). On 401, the client silently calls `/auth/refresh` (cookie sent automatically), which checks the blocklist and re-issues an access token. Logout adds the token jti to `token_blocklist`.

---

## 4. Monorepo Structure

```
TEMPORA/
  packages/
    shared/
      src/
        schemas/          ← Zod schemas (auth, employee, shift, time-entry, ...)
        types/            ← inferred + domain types
        constants/        ← roles, shift types, categories, error codes
        index.ts
      package.json
      tsconfig.json
  frontend/               ← Angular 21 SPA
    src/app/
      core/               ← auth, http interceptors, guards, SSE client
      shared/             ← UI primitives, pipes, directives (PrimeNG wrappers)
      features/           ← lazy-loaded: auth, employees, shifts, time-tracking,
                            absences, reports, admin (each: data-access/feature/ui)
  backend/                ← Express 5 API (CommonJS, ts-node)
    src/
      modules/            ← iam, organization, employees, shifts, time-tracking,
                            absences, rules, reporting, notifications
      middleware/         ← auth, tenant-context, validate, error
      db/                 ← prisma client, tenant-tx wrapper
      sse/                ← SSE hub
      audit/              ← append-only audit writer
      app.ts · server.ts
    prisma/
      schema.prisma · migrations/
    tsconfig.json
  openspec/               ← SDD artifacts
  package.json            ← npm workspaces root
  docker-compose.yml      ← PostgreSQL (dev)
```

---

## 5. Bounded Context Map

| Context | Responsibility | Communicates with |
|---|---|---|
| **IAM** | Users, authentication, JWT issue/refresh/revoke, role checks (`admin`/`manager`/`employee`) | Owns `User`; links to Employee. Provides identity to all contexts |
| **Organization** | Organizations (tenants), Centers, Departments/Units; tenant lifecycle | Root of every tenant scope; Employees & Shifts reference it |
| **Employees** | Employee profiles, categories, contracts, working calendars, center assignment | Reads Organization; referenced by Shifts, TimeTracking, Absences |
| **Shifts** | ShiftTemplates, ShiftAssignments, RotationPatterns, ShiftSchedule (cuadrante), swap requests | Validates against Rules Engine; emits Notifications on publish/swap |
| **TimeTracking** | TimeEntries (immutable), TimeCorrections, overtime, approval workflow | Reads Shifts (scheduled vs actual); writes Audit; emits live-dashboard SSE |
| **Absences** | Vacaciones, IT, permisos, lactancia, reducción de jornada; approval | Reads Employees; consulted by Rules Engine & Reporting |
| **Rules Engine** | Per-organization configurable validation: 12h rest, 9h/day, 80h/yr overtime, weekly rest, convenio rules | Invoked synchronously by Shifts & TimeTracking; never mutates state |
| **Reporting** | Monthly hours, overtime, absenteeism, coverage gaps; PDF/XLSX export; 4-yr retention reads | Reads all transactional contexts (read-only projections) |
| **Notifications** | SSE hub; per-org/user/role event fan-out | Consumes events from Shifts & TimeTracking |

Communication is **in-process module calls** (modular monolith). The Rules Engine is a pure, side-effect-free domain service. Notifications is the only async-ish path (event → SSE push).

---

## 6. Conceptual Data Model

Every tenant-owned entity has `organization_id` (NOT NULL, RLS-guarded) and `created_at`/`updated_at`. **TimeEntry and AuditLog are append-only — no UPDATE/DELETE.**

```
Organization (1)──< Center (N)──< Department/Unit (N)
       │
       ├──< Employee (N) ── category, contractType, contractedHoursPerWeek,
       │        │            workingCalendarId, primaryCenterId
       │        │
       │        ├──1:1── User (auth entity: email, passwordHash, role, employeeId?)
       │        ├──< ShiftAssignment (N) >── ShiftTemplate
       │        ├──< TimeEntry (N)  [IMMUTABLE]
       │        └──< Absence (N)
       │
       ├──< ShiftTemplate (N) ── name, startTime, endTime, categoryRequirements
       ├──< RotationPattern (N) ── cycle definition (e.g., 5-on-2-off)
       ├──< ShiftSchedule/Cuadrante (N) ── center, unit, month, status(draft|published)
       │        └──< ShiftAssignment (N) ── employee + template + date + unit
       │
       ├──< WorkingCalendar (N) ── annual jornada, festivos
       ├──< RuleSet (N) ── convenio config (rest hours, max hours, overtime caps)
       └──< AuditLog (N)  [APPEND-ONLY] ── actor, action, entity, before/after, ts

TimeEntry (immutable) ──< TimeCorrection (N) ── proposes new values + justification,
                                                manager-approved, links original entry
CambioTurno/SwapRequest ── requesterAssignment, targetAssignment, status, approverId
```

**Key modeling commitments:**
- `User` is the auth entity; `Employee` is the HR entity. One-to-one, but `admin` users may exist without an Employee.
- An Employee has a `primaryCenterId` but ShiftAssignments may reference any center in the org → **multi-center managers supported from day one**.
- `RuleSet` is per-organization → **configurable convenio rules from day one**.
- Corrections never overwrite `TimeEntry`; they create a linked `TimeCorrection` + an `AuditLog` row.

---

## 7. API Surface Overview

All routes are tenant-scoped via JWT; all bodies validated with shared Zod schemas. Representative (non-exhaustive):

| Context | Routes |
|---|---|
| **Auth** | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| **Organization** | `GET/POST/PATCH /organizations` · `/centers` · `/centers/:id/departments` |
| **Employees** | `GET/POST/PATCH /employees` · `GET /employees/:id` · `GET /employees/:id/calendar` · `GET /employees/:id/contract` |
| **Shifts** | `/shift-templates` · `/rotation-patterns` · `/schedules` (cuadrantes) · `POST /schedules/:id/publish` · `/assignments` · `POST /swaps` · `POST /swaps/:id/approve` |
| **TimeTracking** | `POST /time-entries/clock-in` · `POST /time-entries/clock-out` · `GET /time-entries` · `POST /time-corrections` · `POST /time-corrections/:id/approve` · `GET /overtime` |
| **Absences** | `GET/POST /absences` · `POST /absences/:id/approve` · `GET /absences/balance` |
| **Reports** | `GET /reports/monthly-hours` · `/reports/overtime` · `/reports/absenteeism` · `/reports/coverage` · `?format=pdf|xlsx` |
| **Notifications** | `GET /notifications/stream` (SSE) · `GET /notifications` · `PATCH /notifications/:id/read` |

**Conventions:** consistent error envelope `{ code, message, details? }`; pagination via `?page&pageSize`; write endpoints return the created/updated resource; sensitive reads are audit-logged.

---

## 8. Frontend Feature Map

Lazy-loaded routes; visibility gated by role guards.

| Route (lazy) | admin | manager (own center) | employee |
|---|:--:|:--:|:--:|
| `/auth` (login) | ✓ | ✓ | ✓ |
| `/dashboard` | full org | own center | own schedule |
| `/employees` | CRUD | read | — |
| `/shifts/templates` · `/rotations` | CRUD | read | — |
| `/shifts/cuadrante` | CRUD + publish | CRUD + publish (own center) | view |
| `/shifts/swaps` | approve | approve | request |
| `/time-tracking/clock` | view all | view center | clock self |
| `/time-tracking/corrections` | approve | approve | request |
| `/absences` | manage | approve (center) | request |
| `/reports` | export | export (center) | — |
| `/admin` (orgs, centers, rulesets) | full | — | — |

Route structure: `/(auth)` public shell + authenticated shell with a role-aware nav. Each feature: `data-access/` (SignalStore + API), `feature/` (smart containers), `ui/` (PrimeNG-based presentational). A `roleGuard` + `tenantGuard` protect authenticated routes.

---

## 9. Compliance & Security Architecture

**Audit log (append-only):** A single `AuditLog` table records `actor`, `action`, `entityType`, `entityId`, `before`, `after`, `ip`, `timestamp`. Written for every mutation of time entries, corrections, approvals, employee changes, and **every read of special-category data**. No UPDATE/DELETE — enforced by RLS policy + DB privileges (app role has INSERT only on audit). Retention ≥ 4 years (RD-ley 8/2019); soft-delete only on business entities; audit never purged.

**Time-record immutability:** `TimeEntry` rows are insert-only. Corrections are separate, justified, manager-approved records. This satisfies the 2026 control-horario reform (digital-only, unalterable, inspector-readable). A future read-only inspector export endpoint is reserved.

**GDPR / LOPD-GDD:** Health data (sick-leave causes, IT) is special category (Art. 9 GDPR / LO 3/2018). Mitigations: column-level encryption for sensitive fields, access-logging on every special-category read, data-minimization in reports, consent/retention metadata per record, and a documented DPO/access-request path. Reports default to aggregated/anonymized where possible.

**JWT security model:** 15-min access token (jti, org_id, role claims); httpOnly+Secure+SameSite refresh cookie; `token_blocklist` checked on refresh and revoked on logout/role-change/termination; CSRF token on the refresh flow; passwords hashed with argon2/bcrypt.

**PostgreSQL RLS:** Every tenant table has a policy `USING (organization_id = current_setting('app.current_org')::uuid)`. Backend opens a Prisma transaction setting `app.current_org` from the verified JWT before any query → fail-closed (no context = no rows). A separate, audited `super_admin` bypass role handles cross-tenant operations. Indexes lead with `organization_id`.

---

## 10. Phased Delivery Plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **P1 — Foundation** | Monorepo wiring, `packages/shared`, Prisma + RLS scaffold, Docker Postgres, JWT auth (login/refresh/logout/blocklist), Organization/Center/Department, Employee management, role guards, audit log + tenant-context wrapper | A user can log in, an admin can manage org structure and employees; every write audited; RLS verified by cross-tenant test |
| **P2 — Shifts** | ShiftTemplates, RotationPatterns, ShiftAssignments, ShiftSchedule/cuadrante (draft→publish), swap requests + approval | A manager builds and publishes a monthly cuadrante; employees see their schedule; swaps flow end-to-end |
| **P3 — Time Tracking** | Clock-in/out (server-authoritative, immutable), TimeCorrections + approval, overtime tracking, approval workflow, live dashboard (SSE) | Employees clock in/out; managers approve corrections; immutability + audit proven; live dashboard updates |
| **P4 — Absences + Rules Engine** | Absence types + approval + balances; configurable per-org RuleSet (12h rest, 9h/day, 80h/yr OT, weekly rest, convenio params); synchronous validation in Shifts & TimeTracking | Shift/time operations are blocked/flagged by org-specific rules; absences integrated into coverage |
| **P5 — Reporting + Notifications + Compliance** | Monthly hours, overtime, absenteeism, coverage reports; PDF/XLSX export; notification center; inspector/compliance export; retention controls | HR exports payroll-ready reports; compliance export available; notifications delivered via SSE |
| **P6 — Offline (post-MVP)** | Service Worker + IndexedDB clock-in/out queue, reconciliation respecting server-authoritative time | Nurses clock in offline; records reconcile without violating immutability |

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Health data = GDPR special category (time tied to sick leave) | CRITICAL | Field encryption, access-log every read, DPO path, data minimization, RLS isolation |
| 2026 reform: digital-only, unalterable records | HIGH | Append-only `TimeEntry` + audit from P1; DB privileges block UPDATE/DELETE; inspector export reserved |
| Convenio variability across clients | HIGH | Per-org `RuleSet`; Rules Engine parameterized, not hard-coded (P4) |
| Shift conflict detection complexity (rest, max hours, category minimums) | HIGH | Dedicated pure Rules Engine; server-side enforcement; Postgres exclusion constraints for overlaps |
| Backend `src/` entirely missing | HIGH | P1 scaffolds full backend skeleton before feature work |
| Cross-tenant data leak | HIGH | RLS fail-closed + app `organization_id` filter (defense in depth); cross-tenant test gate |
| Prisma ↔ RLS context wiring | MEDIUM | Mandatory tenant-tx wrapper; lint/test that no query runs outside it |
| `"type": "commonjs"` vs ESM ecosystem | MEDIUM | Stay CommonJS (ADR-7); revisit only if a critical dep is ESM-only |
| Type drift frontend/backend | MEDIUM | `packages/shared` Zod schemas as single source of truth before first endpoint |
| Multi-center manager scope | MEDIUM | Modeled day one (assignments reference any center; manager scoped by guard) |
| Part-time contracted vs actual hours | MEDIUM | `contractedHoursPerWeek` on Employee; deviation report in P5 |
| Offline for low-connectivity nurses | LOW-MED | Deferred to P6; server-authoritative time preserved in MVP |

---

## Capabilities

> Contract with sdd-spec. Each new capability becomes `openspec/specs/<name>/spec.md`.

### New Capabilities
- `iam-auth`: JWT login/refresh/logout, blocklist revocation, roles, role/tenant guards
- `organization-structure`: organizations, centers, departments/units, tenancy lifecycle
- `employee-management`: employees, categories, contracts, working calendars, center assignment
- `shift-management`: templates, rotation patterns, assignments, cuadrante publish, swaps
- `time-tracking`: immutable clock-in/out, corrections, overtime, approval workflow
- `absence-management`: absence types, approval, balances
- `rules-engine`: per-org configurable legal/convenio validation
- `reporting`: hours/overtime/absenteeism/coverage reports, PDF/XLSX export, retention
- `notifications-sse`: SSE hub, per-org/user/role event fan-out
- `audit-compliance`: append-only audit log, RLS tenant isolation, GDPR access logging

### Modified Capabilities
- None (greenfield).

## Rollback Plan

Each phase is an independent slice landing behind its own PR(s); no phase corrupts prior phases. P1 establishes migrations as the schema-of-record — every change is a reversible Prisma migration. If a phase regresses, revert its PR(s) and roll back its migrations (`prisma migrate resolve`/down). Append-only tables are never destructively migrated; deprecations are additive. Feature flags gate P5 notifications/SSE if rollout is risky.

## Success Criteria

- [ ] Monorepo builds; `packages/shared` consumed by both frontend and backend with no type drift
- [ ] RLS proven: a cross-tenant query returns zero rows in an automated test
- [ ] Auth: access/refresh/blocklist flow works; revoked tokens rejected
- [ ] Time entries are demonstrably immutable; every mutation produces an audit row
- [ ] A manager can build, publish, and swap shifts in a cuadrante
- [ ] Rules Engine blocks a sub-12h-rest assignment using org-specific config
- [ ] HR can export a payroll-ready monthly-hours report (PDF + XLSX)
- [ ] No special-category data read occurs without an audit-log entry
