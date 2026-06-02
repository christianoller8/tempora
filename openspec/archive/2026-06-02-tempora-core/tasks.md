# Tasks: Tempora Core

**Change:** tempora-core
**Date:** 2026-05-31
**Status:** ready-for-apply

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~8 000 – 11 000 across all 5 phases |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (Phase 1 Foundation) → PR2 (Phase 2 Shifts) → PR3 (Phase 3 Time Tracking) → PR4 (Phase 4 Absences + Rules) → PR5 (Phase 5 Reporting + Notifications) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (user decision required before apply) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Monorepo wiring + shared schemas + DB + backend core | PR 1 | Base = main; includes Prisma schema, RLS, all middleware, IAM, Org, Employee modules |
| 2 | Shifts (templates, cuadrante, swaps) | PR 2 | Base = PR 1 branch; backend + frontend shifts feature |
| 3 | Time Tracking (clock-in/out, corrections, SSE, live dashboard) | PR 3 | Base = PR 2 branch |
| 4 | Absences + Rules Engine (full) | PR 4 | Base = PR 3 branch |
| 5 | Reporting + Notifications + Compliance export | PR 5 | Base = PR 4 branch |

---

## Phase 1 — Foundation

### 1.1 Monorepo root wiring

- [x] TASK-P1-1: Create root `package.json` with npm workspaces (`packages/shared`, `backend`, `frontend`), shared `devDependencies`, and root scripts (`build:shared`, `dev:backend`, `dev:frontend`, `db:up`, `db:migrate`) — satisfies ADR-1; acceptance: `npm install` resolves all three workspaces
- [x] TASK-P1-2: Create `docker-compose.yml` at repo root with `postgres:17` service (`tempora_owner`, healthcheck, pgdata volume, `./backend/prisma/init` mount) — satisfies dev environment; acceptance: `docker compose up -d postgres` reaches healthy state
- [x] TASK-P1-3: Create `backend/prisma/init/01-init.sql` — enables `pgcrypto`, creates `tempora_app` role with `LOGIN`, `CONNECT`, and `USAGE ON SCHEMA public` — run once on container init

### 1.2 `packages/shared` scaffold

- [x] TASK-P1-4: Create `packages/shared/package.json` with name `@tempora/shared`, dual CJS/ESM `exports` map (`.`, `./schemas`, `./constants`), `tsup` build script, and `zod ^3.24.0` runtime dependency — acceptance: package is addressable as `@tempora/shared`
- [x] TASK-P1-5: Create `packages/shared/tsconfig.json` (target ES2022, module NodeNext, outDir `dist`, strict) — acceptance: `tsc --noEmit` passes with zero errors
- [x] TASK-P1-6: Create `packages/shared/src/constants/` — `roles.ts` (`ROLES` const array), `permissions.ts` (`PERMISSIONS` map), `enums.ts` (Prisma enum mirrors as `z.enum` arrays), `error-codes.ts` — acceptance: all constants importable from `@tempora/shared/constants`
- [x] TASK-P1-7: Create `packages/shared/src/schemas/common.schema.ts` — `PaginationQuerySchema`, `PaginatedResultSchema<T>` factory, `ErrorEnvelopeSchema`, `UuidSchema`, `IsoDateSchema`, `IsoDateTimeSchema` — acceptance: each schema parses a valid sample input
- [x] TASK-P1-8: Create `packages/shared/src/schemas/auth.schema.ts` — `LoginRequestSchema`, `LoginResponseSchema`, `RefreshResponseSchema`, `MeResponseSchema` — acceptance: schemas compile and infer correct TypeScript types
- [x] TASK-P1-9: Create `packages/shared/src/schemas/organization.schema.ts` — `CreateOrganizationSchema`, `CreateCenterSchema`, `CreateDepartmentSchema`, and `.partial()` update variants — acceptance: unit import resolves
- [x] TASK-P1-10: Create `packages/shared/src/schemas/employee.schema.ts` — `CreateEmployeeSchema` (validates `contractedHoursPerWeek` required when `contractType = TIEMPO_PARCIAL`), `UpdateEmployeeSchema`, `EmployeeResponseSchema`, `WorkingCalendarSchema` — acceptance: part-time validation enforced by schema
- [x] TASK-P1-11: Create `packages/shared/src/schemas/shift.schema.ts` — `ShiftTemplateSchema`, `RotationPatternSchema`, `CreateScheduleSchema`, `PublishScheduleSchema`, `ShiftAssignmentSchema`, `CreateSwapSchema`, `ApproveSwapSchema`
- [x] TASK-P1-12: Create `packages/shared/src/schemas/time-entry.schema.ts` — `ClockInSchema`, `ClockOutSchema`, `TimeEntryResponseSchema`, `CreateCorrectionSchema`, `ApproveCorrectionSchema`, `OvertimeQuerySchema`
- [x] TASK-P1-13: Create `packages/shared/src/schemas/absence.schema.ts` — `CreateAbsenceSchema`, `ApproveAbsenceSchema`, `AbsenceBalanceQuerySchema`
- [x] TASK-P1-14: Create `packages/shared/src/schemas/rule.schema.ts` — `RuleSetSchema`, `RuleCheckResultSchema` (severity, code, message, meta) — acceptance: type used by both rules engine and frontend warning display
- [x] TASK-P1-15: Create `packages/shared/src/schemas/index.ts` and `packages/shared/src/types/index.ts` re-exporting all schemas and `z.infer` types; create `packages/shared/src/index.ts` barrel — acceptance: `import { LoginRequest } from '@tempora/shared'` resolves after `npm run build -w @tempora/shared`

### 1.3 Backend scaffold

- [x] TASK-P1-16: Create `backend/package.json` with workspace dependency on `@tempora/shared`, Express 5, Prisma, `argon2`, `jsonwebtoken`, `cookie-parser`, `zod`, `tsconfig-paths`, `nodemon`, `vitest`, `ts-node` — acceptance: `npm install` from repo root links all deps
- [x] TASK-P1-17: Create `backend/tsconfig.json` (target ES2022, module CommonJS, strict, `@tempora/shared` path alias to shared src) and `backend/nodemon.json` (watches `src` + `../packages/shared/src`, exec `ts-node -r tsconfig-paths/register src/server.ts`)
- [x] TASK-P1-18: Create `backend/src/config/env.ts` — Zod-validated typed `env` object covering all required variables (DATABASE_URL, JWT secrets, CORS_ORIGIN, FIELD_ENCRYPTION_KEY, PORT); process exits on first invalid variable — acceptance: boot throws with descriptive error if `JWT_ACCESS_SECRET` is missing
- [x] TASK-P1-19: Create `backend/src/db/prisma.ts` (PrismaClient singleton) and `backend/src/db/tenant.ts` (`withTenant<T>(orgId, fn)` opens a Prisma tx, calls `set_config('app.current_org', orgId, true)`, runs fn, returns result) — acceptance: unit test verifies the `set_config` call is made inside the transaction
- [x] TASK-P1-20: Create `backend/src/db-context.ts` — `AsyncLocalStorage<{db, user}>`, `getDb()`, `getUser()` helpers that throw if called outside tenant context — acceptance: `getDb()` throws `'No tenant context'` when called without a wrapping ALS store

### 1.4 Prisma schema

- [x] TASK-P1-21: Create `backend/prisma/schema.prisma` with the full schema from design §2 — all enums (`Role`, `EmployeeCategory`, `ContractType`, `ShiftType`, `ScheduleStatus`, `AbsenceType`, `EntryStatus`, `CorrectionStatus`, `SwapStatus`, `AbsenceStatus`, `RuleViolation`, `AuditAction`) — acceptance: `prisma validate` passes
- [x] TASK-P1-22: Add all models to `schema.prisma` — `Organization`, `Center`, `Department`, `User`, `TokenBlocklist`, `Employee`, `WorkingCalendar`, `RuleSet`, `ShiftTemplate`, `RotationPattern`, `ShiftSchedule`, `ShiftAssignment`, `CambioTurno`, `TimeEntry`, `TimeCorrection`, `Absence`, `AuditLog` — with all composite indexes leading with `organizationId` — acceptance: `prisma validate` passes, `prisma generate` produces typed client
- [ ] TASK-P1-23: Run `prisma migrate dev --name init` — creates the first migration file; commit `backend/prisma/migrations/` — acceptance: migration applies cleanly against the Docker Postgres instance [DEFERRED: requires Docker running]

### 1.5 RLS + immutability SQL [COMPLIANCE]

- [x] TASK-P1-24: Create `backend/prisma/migrations/rls/001_rls_policies.sql` — enables RLS + `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy on every tenant-owned table (see design §8.1); grants `SELECT/INSERT/UPDATE/DELETE` on all tables to `tempora_app` first, then revokes UPDATE/DELETE on `audit_logs` and limits `time_entries` — acceptance: running the SQL against a migrated DB produces no errors
- [x] TASK-P1-25: Create `backend/prisma/migrations/rls/002_time_entry_trigger.sql` — `enforce_timeentry_immutability` trigger function + `trg_timeentry_immutable` trigger (BEFORE UPDATE OR DELETE on `time_entries`) allowing only `OPEN→CLOSED` transition as specified in design §8.2 — acceptance: SQL executes; `DELETE` on a time_entry raises exception [COMPLIANCE]
- [x] TASK-P1-26: Create a Prisma migration runner script `backend/src/db/run-rls.ts` that executes the RLS SQL files in order using the `DIRECT_DATABASE_URL` (owner role); add `db:rls` npm script — acceptance: `npm run db:rls` idempotently applies RLS policies

### 1.6 Backend core middleware

- [x] TASK-P1-27: Create `backend/src/types/express.d.ts` (module augmentation: `req.user: AuthUser`) and `backend/src/types/auth.ts` (`AuthUser` interface with `userId`, `organizationId`, `role`, `employeeId?`, `jti`)
- [x] TASK-P1-28: Create `backend/src/middleware/error.ts` — `ApiError` class (status, code, message, details?), global Express 5 error handler returning `{ code, message, details? }` envelope — acceptance: unknown errors map to 500, `ApiError` preserves status
- [x] TASK-P1-29: Create `backend/src/utils/async-handler.ts` — wraps async Express route handlers to forward rejections to `next`
- [x] TASK-P1-30: Create `backend/src/middleware/validate.ts` — `validate(schema)` middleware factory that calls `schema.safeParse()` on `req.body`/`req.query`/`req.params` and calls `next(ApiError(422))` on failure — acceptance: invalid body returns `{ code: 'VALIDATION_ERROR', details: [...] }`
- [x] TASK-P1-31: Create `backend/src/middleware/require-role.ts` — `requireRole(roles[])` and `requirePermission(permission)` middleware using `PERMISSIONS` from `@tempora/shared`; returns 403 on insufficient role — acceptance: `requireRole(['ADMIN'])` rejects a MANAGER token
- [x] TASK-P1-32: Create `backend/src/middleware/auth.ts` — `authenticate` middleware (Bearer header → cookie fallback for SSE), verifies JWT via `verifyAccessToken`, populates `req.user`; returns 401 on missing/expired/invalid token — acceptance: AC-AUTH-2 and AC-AUTH-7 pass
- [x] TASK-P1-33: Create `backend/src/middleware/tenant-context.ts` — wraps the remaining request chain inside `withTenant(req.user.organizationId, ...)` + `requestContext.run(...)`, so all downstream services call `getDb()` to obtain the scoped Prisma client — acceptance: a query outside this middleware returns zero rows from any RLS-guarded table

### 1.7 Audit writer [COMPLIANCE]

- [x] TASK-P1-34: Create `backend/src/audit/audit-writer.ts` — `AuditWriter` class with `write(db, actor, event, req?)` method that does a Prisma INSERT on `auditLog` within the caller's tenant transaction — `AuditEvent` type covers `action`, `entityType`, `entityId`, `before?`, `after?` — acceptance: write call inserts exactly one row (AC-AUDIT-1)

### 1.8 IAM module

- [x] TASK-P1-35: Create `backend/src/modules/iam/password.ts` — `hashPassword(plain)` and `verifyPassword(plain, hash)` using argon2id; plaintext MUST NOT be returned — satisfies FR-AUTH-7
- [x] TASK-P1-36: Create `backend/src/modules/iam/jwt.ts` — `signAccessToken(payload)` (15-min TTL, embeds `jti`, `org`, `role`, `emp` claims), `signRefreshToken(payload)` (7-day TTL), `verifyAccessToken(token)`, `verifyRefreshToken(token)` using `jsonwebtoken` and secrets from `env` — satisfies FR-AUTH-1, FR-AUTH-2
- [x] TASK-P1-37: Create `backend/src/modules/iam/iam.service.ts` — `login(email, password)` (argon2 verify, issue access+refresh tokens, write login audit), `refresh(refreshToken)` (blocklist check, re-issue), `logout(jti)` (insert into `token_blocklist`), `isBlocklisted(jti)` — satisfies FR-AUTH-3, FR-AUTH-4, FR-AUTH-8 [COMPLIANCE]
- [x] TASK-P1-38: Create `backend/src/modules/iam/iam.controller.ts` and `iam.router.ts` — routes: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`; login sets httpOnly Secure cookie; `/me` requires `authenticate` — satisfies FR-AUTH-1, FR-AUTH-10; acceptance: AC-AUTH-1 through AC-AUTH-7

### 1.9 Organization module

- [x] TASK-P1-39: Create `backend/src/modules/organization/organization.service.ts` — `createOrganization`, `createCenter`, `createDepartment` (all require ADMIN role), `listCenters`, `listDepartments` (MANAGER can read own org), soft-delete for center/department (checks for active employees before delete) — satisfies FR-ORG-1 through FR-ORG-7
- [x] TASK-P1-40: Create `backend/src/modules/organization/organization.controller.ts` and `organization.router.ts` — routes: `GET/POST/PATCH /organizations`, `GET/POST/PATCH/DELETE /centers`, `GET/POST /centers/:id/departments`; validate with shared schemas; `requireRole` guard on write routes — acceptance: AC-ORG-1 through AC-ORG-5

### 1.10 Employee module

- [x] TASK-P1-41: Create `backend/src/modules/employees/working-calendar.service.ts` — `createCalendar`, `listCalendars`, `assignCalendar(employeeId, calendarId)` — satisfies FR-EMP-5
- [x] TASK-P1-42: Create `backend/src/modules/employees/employees.service.ts` — `createEmployee` (validates part-time hours, required primaryCenter), `updateEmployee`, `terminateEmployee` (soft-delete + token blocklist via IAM service), `listEmployees` (active-only by default), `getContract` — satisfies FR-EMP-1 through FR-EMP-10 [COMPLIANCE]
- [x] TASK-P1-43: Create `backend/src/modules/employees/employees.controller.ts` and `employees.router.ts` — routes: `GET/POST/PATCH /employees`, `GET /employees/:id`, `GET /employees/:id/contract`, `POST /employees/:id/terminate`; ADMIN-only writes; audit on create/update/terminate — acceptance: AC-EMP-1 through AC-EMP-6

### 1.11 Express app assembly

- [x] TASK-P1-44: Create `backend/src/app.ts` — `createApp()` assembles the full middleware chain (CORS, json, cookie-parser, public routes, `authenticate`, `tenantContext`, all feature routers, `errorHandler`) per design §3.4 and §3.5 — acceptance: `GET /healthz` returns `{ status: 'ok' }` without authentication
- [x] TASK-P1-45: Create `backend/src/server.ts` — `http.createServer(createApp())`, listen on `env.PORT`, graceful SIGTERM/SIGINT shutdown (`sseHub.closeAll()`, `prisma.$disconnect()`) — acceptance: server starts and `/healthz` responds

### 1.12 Frontend scaffold (Angular)

- [x] TASK-P1-46: Update `frontend/package.json` — add `@ngrx/signals`, `@ngrx/operators`, `primeng`, `primeicons`, `@primeuix/themes`, `@tempora/shared`; update `frontend/tsconfig.json` with `@tempora/shared` path alias — acceptance: `ng build` passes with no type errors
- [x] TASK-P1-47: Update `frontend/src/app/app.config.ts` — provide `provideHttpClient(withInterceptors([authInterceptor]))`, `provideRouter(routes, withComponentInputBinding())`, `API_BASE_URL` injection token, PrimeNG theme configuration — acceptance: app bootstraps without runtime errors
- [x] TASK-P1-48: Create `frontend/src/app/core/http/api.tokens.ts` (`API_BASE_URL` InjectionToken), `api-error.ts` (maps error envelope → typed `AppError`), `api.service.ts` (typed `get/post/patch/delete` wrappers using `HttpClient`)

### 1.13 Frontend core auth [TEST]

- [x] TASK-P1-49: Create `frontend/src/app/core/auth/auth.store.ts` — `AuthStore` (SignalStore) with `accessToken`, `user`, `role` signals; `login(dto)`, `refresh()` (with `shareReplay` deduplication for concurrent 401s), `logoutLocal()` methods backed by `auth.service.ts` — satisfies AC-AUTH-3 silent refresh [TEST]
- [x] TASK-P1-50: Create `frontend/src/app/core/auth/auth.interceptor.ts` — `HttpInterceptorFn` attaches `Authorization: Bearer` header; catches 401, calls `auth.refresh()`, retries; calls `auth.logoutLocal()` if refresh fails — acceptance: AC-AUTH-3 [TEST]
- [x] TASK-P1-51: Create `frontend/src/app/core/auth/auth.guard.ts` (`canActivate: authenticated?`) and `role.guard.ts` (`roleGuard(roles[])` factory using `AuthStore.role()` vs `PERMISSIONS`) — acceptance: unauthenticated navigation redirects to `/auth/login`; wrong-role access redirects
- [x] TASK-P1-52: Create `frontend/src/app/app.routes.ts` — public shell route (`/auth/login`), authenticated shell route (guarded by `authGuard`) with lazy feature children (`dashboard`, `employees`, `shifts`, `time-tracking`, `absences`, `reports`, `admin`) per design §5.5
- [x] TASK-P1-53: Create `frontend/src/app/core/layout/shell.component.ts` (authenticated shell: nav + router-outlet) and `public-shell.component.ts` (unauthenticated layout); both `OnPush`, standalone
- [x] TASK-P1-54: Create `frontend/src/app/features/auth/feature/login.component.ts` — Reactive Form with email + password fields, calls `AuthStore.login()`, redirects on success, shows error on failure — acceptance: login flow end-to-end with real backend

---

## Phase 2 — Shifts

### 2.1 Backend: ShiftTemplate + RotationPattern

- [x] TASK-P2-1: Create `backend/src/modules/shifts/templates.service.ts` — `createTemplate`, `listTemplates`, `updateTemplate`, `deleteTemplate` (admin only); validate `startTime`/`endTime` format; set `crossesMidnight` if `endTime < startTime` — satisfies FR-SHIFT-1
- [x] TASK-P2-2: Create `backend/src/modules/shifts/rotations.service.ts` — `createPattern`, `listPatterns`, `updatePattern`, `deletePattern`; validate `cycle` array length matches `cycleLength` — satisfies FR-SHIFT-2
- [x] TASK-P2-3: Create `backend/src/modules/shifts/shifts.router.ts` and `shifts.controller.ts` — routes for `/shift-templates` and `/rotation-patterns`; admin/manager guard on writes — acceptance: AC-SHIFT-1 precondition (templates creatable)

### 2.2 Backend: ShiftSchedule (cuadrante)

- [x] TASK-P2-4: Create `backend/src/modules/shifts/schedules.service.ts` — `createSchedule` (creates in DRAFT), `getSchedule`, `listSchedules`; manager can only create for own center — satisfies FR-SHIFT-3, FR-SHIFT-6; acceptance: AC-SHIFT-1
- [x] TASK-P2-5: Create `schedules.service.ts: publishSchedule(scheduleId)` — runs Rules Engine check on all assignments in the draft, blocks if any BLOCK violations exist, transitions status to PUBLISHED (immutable after), emits `SHIFT_PUBLISHED` SSE event via `eventBus.publish`, writes PUBLISH audit row — satisfies FR-SHIFT-4, FR-SHIFT-5, FR-SHIFT-7 [COMPLIANCE]; acceptance: AC-SHIFT-2, AC-SHIFT-3, AC-SHIFT-4

### 2.3 Backend: ShiftAssignment + Rules Engine (core)

- [x] TASK-P2-6: Create `backend/src/modules/rules/types.ts` — `RuleSeverity`, `RuleCheckResult`, `RuleSetConfig`, `RuleContext`, `Rule`, `RuleEngine` interfaces (from design §6)
- [x] TASK-P2-7: Create `backend/src/modules/rules/rules/min-rest.ts` — `minRest12h` pure rule: gap between previous shift end and candidate start < `ruleSet.minRestHours` → `block`; handles overnight shifts and cross-midnight gaps — satisfies FR-RULES-2, AC-RULES-1
- [x] TASK-P2-8: Create `backend/src/modules/rules/rules/max-daily.ts` — `maxDaily9h` pure rule: effective hours in one work day > `ruleSet.maxDailyHours` → `warn` (or `block` if configured) — satisfies FR-RULES-2
- [x] TASK-P2-9: Create `backend/src/modules/rules/rules/max-annual-ot.ts` — `maxAnnualOt80h` pure rule: `annualOvertimeHours + candidateOT > ruleSet.maxAnnualOvertime` → `block` — satisfies FR-RULES-2, AC-RULES-3
- [x] TASK-P2-10: Create `backend/src/modules/rules/rules/weekly-rest.ts` — `weeklyRest` pure rule: consecutive rest in the rolling 7-day window < `ruleSet.weeklyRestDays × 24` hours → `warn` — satisfies FR-RULES-2, AC-RULES-4
- [x] TASK-P2-11: Create `backend/src/modules/rules/index.ts` — `REGISTRY` array + `ruleEngine.check(context, ruleSet)` that maps all rules, filters nulls, returns `RuleCheckResult[]` — satisfies FR-RULES-1 (pure, no I/O), FR-RULES-3; acceptance: AC-RULES-5 (no DB writes), AC-RULES-6
- [x] TASK-P2-12: Create `backend/src/modules/shifts/assignments.service.ts` — `createAssignment` (validates schedule is DRAFT, fetches RuleSetConfig, assembles RuleContext from recent assignments, calls `ruleEngine.check`, rejects with 422 on BLOCK, persists assignment, writes audit row) — satisfies FR-SHIFT-5, FR-RULES-5 [COMPLIANCE]; acceptance: AC-RULES-1, AC-RULES-2

### 2.4 Backend: CambioTurno (swaps)

- [x] TASK-P2-13: Create `backend/src/modules/shifts/swaps.service.ts` — `requestSwap` (records requester + target assignments at creation time per FR-SHIFT-8), `approveSwap` (runs Rules Engine on the post-swap state, blocks on BLOCK, swaps assignments, emits `SWAP_APPROVED` event, writes audit rows for both assignments), `rejectSwap` — satisfies FR-SHIFT-8 through FR-SHIFT-11 [COMPLIANCE]; acceptance: AC-SHIFT-5, AC-SHIFT-6, AC-SHIFT-7
- [x] TASK-P2-14: Add swap routes to `shifts.router.ts` — `POST /swaps`, `POST /swaps/:id/approve`, `POST /swaps/:id/reject`, `GET /swaps`; manager/admin guard on approve/reject

### 2.5 Frontend: Shifts feature

- [x] TASK-P2-15: Create `frontend/src/app/features/shifts/data-access/shifts.api.ts` — typed API calls for templates, schedules, assignments, swaps using `ApiService`
- [x] TASK-P2-16: Create `frontend/src/app/features/shifts/data-access/schedules.store.ts` — SignalStore with `withEntities<ShiftSchedule>`, `loadSchedules`, `createSchedule`, `publishSchedule` methods; handles warnings from Rules Engine response [TEST]
- [x] TASK-P2-17: Create `frontend/src/app/features/shifts/ui/cuadrante-grid.component.ts` — presentational PrimeTable wrapper with frozen employee column, one column per day; `input()` employees + assignments; `output()` assignment click — acceptance: renders a 31-column grid for a monthly schedule
- [x] TASK-P2-18: Create `frontend/src/app/features/shifts/feature/cuadrante.component.ts` — smart container; injects `SchedulesStore`; orchestrates load, create, assign, publish flow; shows rule violation warnings via toast [TEST]
- [x] TASK-P2-19: Create `frontend/src/app/features/shifts/feature/swap-request.component.ts` and `swap-approval.component.ts` — request form (select target assignment), approval queue for managers; both use `SchedulesStore` [TEST]

---

## Phase 3 — Time Tracking

### 3.1 Backend: TimeEntry (immutable clock-in/out) [COMPLIANCE]

- [x] TASK-P3-1: Create `backend/src/modules/time-tracking/time.service.ts: clockIn(employeeId)` — checks for existing OPEN entry (returns 409 if found), inserts new `TimeEntry` with server-generated `clockIn`, writes CREATE audit row — satisfies FR-TIME-1, FR-TIME-2, FR-TIME-3 [COMPLIANCE]; acceptance: AC-TIME-1, AC-TIME-3
- [x] TASK-P3-2: Create `time.service.ts: clockOut(employeeId)` — finds the OPEN entry, computes effective hours, sets `overtime = true` if > 9h (FR-TIME-4), performs the trigger-guarded UPDATE (`clockOut`, status CLOSED), upserts `OvertimeEntry` accumulator, calls `ruleEngine.check` for overtime cap, emits `CLOCK_OUT` SSE event, writes audit row — satisfies FR-TIME-2, FR-TIME-4, FR-TIME-8, FR-TIME-9 [COMPLIANCE]; acceptance: AC-TIME-2, AC-TIME-7
- [x] TASK-P3-3: Create `time.service.ts: listEntries(filter)` — supports filtering by employee, date range, approval status (FR-TIME-10); acceptance: AC-TIME-4 (UPDATE attempt throws via trigger)

### 3.2 Backend: TimeCorrection workflow

- [x] TASK-P3-4: Create `time.service.ts: createCorrection(dto)` — validates linked TimeEntry exists, creates `TimeCorrection` in PENDING — satisfies FR-TIME-5; acceptance: AC-TIME-5
- [x] TASK-P3-5: Create `time.service.ts: approveCorrection(id, approverId)` / `rejectCorrection(id)` — transitions CorrectionStatus, writes AuditLog row with before/after values (FR-TIME-7) [COMPLIANCE]; acceptance: AC-TIME-6
- [x] TASK-P3-6: Create `backend/src/modules/time-tracking/time.router.ts` and `time.controller.ts` — routes: `POST /time-entries/clock-in`, `POST /time-entries/clock-out`, `GET /time-entries`, `POST /time-corrections`, `POST /time-corrections/:id/approve`, `POST /time-corrections/:id/reject`

### 3.3 Backend: SSE hub

- [x] TASK-P3-7: Create `backend/src/sse/events.ts` — `SseEventType` union, `SseEvent` interface (type, organizationId, targetUserId?, targetRole?, payload, emittedAt) — mirrored in `packages/shared/src/schemas/`
- [x] TASK-P3-8: Create `backend/src/sse/event-bus.ts` — `OrgEventBus` class with lazy per-org `EventEmitter` registry, `for(orgId)`, `publish(orgId, event)` methods — satisfies FR-NOTIF-3 (fan-out by org)
- [x] TASK-P3-9: Create `backend/src/sse/sse-hub.ts` — `SseHub` class: `register(orgId, userId, role, res)`, `unregister(client)`, `shouldDeliver(client, event)` (org scope + user/role targeting), `closeAll()` — satisfies FR-NOTIF-2, FR-NOTIF-3
- [x] TASK-P3-10: Create `backend/src/modules/notifications/notifications.controller.ts` — `stream(req, res)` handler: writes SSE headers, registers client with `sseHub`, subscribes to `eventBus`, sends 25s keep-alive, cleans up on `req.close` — satisfies FR-NOTIF-1; acceptance: AC-NOTIF-1, AC-NOTIF-2
- [x] TASK-P3-11: Create `backend/src/modules/notifications/notifications.router.ts` — `GET /notifications/stream` (authenticate, no tenantContext; cookie-based auth fallback active)

### 3.4 Frontend: Time tracking feature

- [x] TASK-P3-12: Create `frontend/src/app/core/sse/sse.service.ts` — `SseService` with `EventSource` (`withCredentials: true`), `connected` signal, `lastEvent` signal, auto-reconnect on error, `disconnect()` on `DestroyRef` — satisfies FR-NOTIF-6; acceptance: connects, receives events [TEST]
- [x] TASK-P3-13: Create `frontend/src/app/features/time-tracking/data-access/time.store.ts` — SignalStore with clock state, `clockIn()`, `clockOut()`, `loadEntries()` methods; `effect()` reacts to `SseService.lastEvent()` for `CLOCK_IN`/`CLOCK_OUT` events [TEST]
- [x] TASK-P3-14: Create `frontend/src/app/features/time-tracking/ui/clock-widget.component.ts` — presentational: shows current status (OPEN/CLOSED), elapsed time, clock-in/out buttons; `input()` state, `output()` action events [TEST]
- [x] TASK-P3-15: Create `frontend/src/app/features/time-tracking/feature/clock.component.ts` — smart container; injects `TimeStore`; renders `ClockWidgetComponent`; handles correction request form (POST /time-corrections) [TEST]
- [x] TASK-P3-16: Create `frontend/src/app/features/time-tracking/feature/live-dashboard.component.ts` — manager view; subscribes to SSE `CLOCK_IN`/`CLOCK_OUT` events via `TimeStore`; renders PrimeTable of employees with real-time status — satisfies FR-TIME-9, AC-TIME-8 [TEST]

---

## Phase 4 — Absences + Rules Engine (full)

### 4.1 Backend: Absence CRUD + GDPR [GDPR]

- [x] TASK-P4-1: Create `backend/src/modules/absences/crypto.ts` — `encryptCause(plaintext, key)` and `decryptCause(ciphertext, key)` using AES-256-GCM with `FIELD_ENCRYPTION_KEY` from env — satisfies `causeEncrypted` column design; acceptance: round-trip encrypt/decrypt matches [GDPR]
- [x] TASK-P4-2: Create `backend/src/modules/absences/absences.service.ts: createAbsence(dto)` — validates absence type, checks for overlapping absences (422 if overlap), checks vacation balance (422 if zero), encrypts IT cause if present, creates record; IT absences by manager/admin go straight to APPROVED — satisfies FR-ABS-1, FR-ABS-2, FR-ABS-3; acceptance: AC-ABS-1, AC-ABS-3, AC-ABS-6 [GDPR]
- [x] TASK-P4-3: Create `absences.service.ts: approveAbsence(id)` / `rejectAbsence(id)` — transitions status, decrements vacation balance on approve (FR-ABS-5), writes audit row [COMPLIANCE]; acceptance: AC-ABS-2
- [x] TASK-P4-4: Create `absences.service.ts: getAbsence(id)` — decrypts `causeEncrypted` when present, writes `AuditLog action=READ, entityType=Absence` BEFORE returning cause field [GDPR] [COMPLIANCE]; acceptance: AC-ABS-4, AC-AUDIT-3
- [x] TASK-P4-5: Create `absences.service.ts: getBalance(employeeId, year)` — computes vacation days used vs entitled for the year — satisfies FR-ABS-5, FR-ABS-7
- [x] TASK-P4-6: Create `backend/src/modules/absences/absences.router.ts` and `absences.controller.ts` — routes: `GET/POST /absences`, `GET /absences/:id` (triggers GDPR audit), `POST /absences/:id/approve`, `POST /absences/:id/reject`, `GET /absences/balance` — acceptance: AC-ABS-5 (absence visible in coverage report source data)

### 4.2 Backend: RuleSet admin

- [x] TASK-P4-7: Create RuleSet CRUD in `organization.service.ts` (or dedicated `ruleset.service.ts`) — `createRuleSet`, `updateRuleSet`, `listRuleSets`; ADMIN only; default ruleset falls back to statutory values — satisfies FR-RULES-2, FR-RULES-4; acceptance: AC-RULES-2 (org-specific rest override)
- [x] TASK-P4-8: Add RuleSet routes to `organization.router.ts` — `GET/POST/PATCH /rule-sets`; ADMIN guard

### 4.3 Backend: Rules Engine extended (absence constraints)

- [x] TASK-P4-9: Extend `assignments.service.ts` and `time.service.ts` — before invoking `ruleEngine.check`, load any approved absences for the employee in the period and include them in the `RuleContext` so absence days are excluded from weekly-rest and max-daily calculations — satisfies FR-RULES-6 (full integration)

### 4.4 Frontend: Absences feature

- [x] TASK-P4-10: Create `frontend/src/app/features/absences/data-access/absences.store.ts` — SignalStore: `loadAbsences`, `createAbsence`, `approveAbsence`, `rejectAbsence`, `balance` computed signal [TEST]
- [x] TASK-P4-11: Create `frontend/src/app/features/absences/feature/absence-request.component.ts` — Reactive Form: type selector (enum), date-range picker, optional cause field (shown only for IT); calls `AbsencesStore.createAbsence()` [TEST]
- [x] TASK-P4-12: Create `frontend/src/app/features/absences/feature/absence-approval.component.ts` — manager approval queue: PrimeTable of pending absences, approve/reject actions; reads `AbsencesStore` [TEST]
- [x] TASK-P4-13: Create `frontend/src/app/features/absences/feature/absence-balance.component.ts` — displays vacation balance from `GET /absences/balance`; presentational [TEST]

### 4.5 Frontend: Admin RuleSet config

- [x] TASK-P4-14: Create `frontend/src/app/features/admin/feature/rulesets.component.ts` — admin form to create/update per-org `RuleSet` (minRestHours, maxDailyHours, maxAnnualOvertime, weeklyRestDays, params JSON editor) [TEST]

---

## Phase 5 — Reporting + Notifications + Compliance

### 5.1 Backend: Report queries

- [ ] TASK-P5-1: Create `backend/src/modules/reporting/reporting.service.ts: monthlyHoursReport(orgId, year, month, centerId?)` — queries approved TimeEntries + TimeCorrections (approved only, FR-REP-6), computes regular hours, overtime hours, part-time deviation (contracted × weeks vs actual); GDPR: excludes `causeEncrypted` — satisfies FR-REP-1, FR-REP-6, FR-REP-8 [GDPR]
- [ ] TASK-P5-2: Create `reporting.service.ts: overtimeReport(orgId, year, employeeId?)` — sums `OvertimeEntry` accumulator per employee, flags 80h cap exceeded — satisfies FR-REP-2; acceptance: AC-REP-4
- [ ] TASK-P5-3: Create `reporting.service.ts: absenteeismReport(orgId, startDate, endDate, centerId?)` — counts approved absence days by type per employee; excludes IT cause field — satisfies FR-REP-3; acceptance: AC-REP-6 [GDPR]
- [ ] TASK-P5-4: Create `reporting.service.ts: coverageGapsReport(orgId, centerId, year, month)` — joins ShiftAssignments with approved Absences, returns shifts with absent employees and no replacement — satisfies FR-REP-4; acceptance: AC-REP-5
- [ ] TASK-P5-5: Create `backend/src/modules/reporting/exporters/xlsx.ts` — `toXlsx(rows, columns)` using `exceljs`; returns a `Buffer` — satisfies FR-REP-5; acceptance: AC-REP-1 (valid XLSX buffer)
- [ ] TASK-P5-6: Create `backend/src/modules/reporting/exporters/pdf.ts` — `toPdf(rows, columns, title)` using `pdfkit`; returns a `Buffer` — satisfies FR-REP-5; acceptance: AC-REP-7 (non-empty PDF with correct Content-Type)
- [ ] TASK-P5-7: Create `backend/src/modules/reporting/reporting.router.ts` and `reporting.controller.ts` — routes: `GET /reports/monthly-hours`, `/reports/overtime`, `/reports/absenteeism`, `/reports/coverage`; all support `?format=pdf|xlsx`; manager scoped to own center (FR-REP-7); acceptance: AC-REP-2, AC-REP-3

### 5.2 Backend: Notification persistence

- [ ] TASK-P5-8: Add `Notification` model to `schema.prisma` — `id`, `organizationId`, `userId`, `type`, `payload (Json)`, `read (Boolean)`, `createdAt`; run `prisma migrate dev --name notifications` — satisfies FR-NOTIF-8
- [ ] TASK-P5-9: Create `backend/src/modules/notifications/notifications.service.ts` — `persist(event)` saves a `Notification` row when an SSE event is emitted; `listNotifications(userId)`, `markRead(id, userId)` — satisfies FR-NOTIF-8, FR-NOTIF-9; acceptance: AC-NOTIF-6 (replay uses persisted rows)
- [ ] TASK-P5-10: Add notification routes — `GET /notifications` (paginated), `PATCH /notifications/:id/read`; integrate `persist()` call into `eventBus.publish` path so all events are stored — satisfies FR-NOTIF-7 (Last-Event-ID replay from persisted rows)

### 5.3 Backend: Compliance export [COMPLIANCE]

- [ ] TASK-P5-11: Create `reporting.service.ts: complianceExport(orgId, year)` — returns append-only `TimeEntry` and `AuditLog` rows (approved + immutable) in a structured XLSX for labor inspector access; requires ADMIN role; writes audit row for the export action itself — satisfies 2026 control-horario reform remote-access requirement [COMPLIANCE]
- [ ] TASK-P5-12: Add `GET /reports/compliance` route — ADMIN only, XLSX output; acceptance: returned XLSX contains at least all closed TimeEntries for the period with no causeEncrypted fields exposed [GDPR] [COMPLIANCE]

### 5.4 Frontend: Reports feature

- [ ] TASK-P5-13: Create `frontend/src/app/features/reports/data-access/reports.api.ts` — typed API calls for each report endpoint; handles binary blob response for PDF/XLSX download using `responseType: 'blob'`
- [ ] TASK-P5-14: Create `frontend/src/app/features/reports/feature/reports.component.ts` — filter form (year, month, center, employee), report type selector, results PrimeTable, export buttons (PDF/XLSX trigger file download); ADMIN/MANAGER only [TEST]

### 5.5 Frontend: Notification center

- [ ] TASK-P5-15: Create `frontend/src/app/features/notifications/data-access/notifications.store.ts` — SignalStore: `unreadCount` computed signal; `loadNotifications()`, `markRead(id)` methods; subscribes to `SseService.lastEvent()` for `NOTIFICATION_READ` multi-tab sync [TEST]
- [ ] TASK-P5-16: Create `frontend/src/app/features/notifications/ui/notification-bell.component.ts` — presentational: bell icon with unread count badge; `input()` count, `output()` open event [TEST]
- [ ] TASK-P5-17: Create `frontend/src/app/features/notifications/feature/notification-list.component.ts` — dropdown/panel listing notifications; marks as read on click; integrates `NotificationsStore` [TEST]
- [ ] TASK-P5-18: Integrate `NotificationBellComponent` into `shell.component.ts` nav bar — acceptance: bell shows unread count, clicking opens the list, marking read updates count in real time via SSE

---

## Parallel / Sequential Dependency Map

```
P1 (all tasks sequential within phase — shared is prerequisite to backend, backend to frontend)
  └─ P2 (requires P1 complete — Rules Engine core is P2, used by P3/P4)
       └─ P3 (requires P2 — SSE hub must exist before live dashboard)
            └─ P4 (requires P3 — absence data feeds rules engine full integration)
                 └─ P5 (requires P4 — reports need absences + corrections data)
```

Within P2, tasks P2-6 through P2-11 (Rules Engine rules) are independent of each other and can be implemented in parallel. Within P5, the four report queries (P5-1 through P5-4) are independent of each other.

---

## Task Count Summary

| Phase | Backend Tasks | Frontend Tasks | Total |
|-------|--------------|----------------|-------|
| P1 — Foundation | 45 | 9 | 54 |
| P2 — Shifts | 14 | 5 | 19 |
| P3 — Time Tracking | 11 | 5 | 16 |
| P4 — Absences + Rules (full) | 9 | 5 | 14 |
| P5 — Reporting + Notifications | 12 | 6 | 18 |
| **Total** | **91** | **30** | **121** |

---

## Spec Requirements Coverage

| Spec Requirement | Tasks |
|---|---|
| FR-AUTH-1..10 | P1-35 through P1-38 |
| FR-AUDIT-1..8 | P1-34, P1-37, P1-42, P2-5, P2-12, P3-2, P3-5, P4-4 |
| FR-ORG-1..7 | P1-39, P1-40 |
| FR-EMP-1..10 | P1-41, P1-42, P1-43 |
| FR-SHIFT-1..11 | P2-1 through P2-14 |
| FR-RULES-1..8 | P2-6 through P2-12, P4-7 through P4-9 |
| FR-TIME-1..10 | P3-1 through P3-6 |
| FR-ABS-1..8 | P4-1 through P4-6 |
| FR-NOTIF-1..9 | P3-7 through P3-11, P5-8 through P5-10 |
| FR-REP-1..10 | P5-1 through P5-7, P5-11, P5-12 |
