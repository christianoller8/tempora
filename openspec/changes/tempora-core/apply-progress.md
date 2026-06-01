# Apply Progress — tempora-core

## Completed (Batch 1A — P1-1 through P1-26)

- [x] TASK-P1-1: Root `package.json` with npm workspaces
- [x] TASK-P1-2: `docker-compose.yml` (postgres:17, healthcheck, pgdata volume)
- [x] TASK-P1-3: `backend/prisma/init/01-init.sql` (pgcrypto extension, tempora_app role)
- [x] TASK-P1-4: `packages/shared/package.json` (@tempora/shared, dual CJS/ESM exports, tsup)
- [x] TASK-P1-5: `packages/shared/tsconfig.json` (ES2022, NodeNext, strict)
- [x] TASK-P1-6: constants/ — roles.ts, permissions.ts, enums.ts, error-codes.ts
- [x] TASK-P1-7: `common.schema.ts` — Pagination, PaginatedResult, ErrorEnvelope, UuidSchema, IsoDate, IsoDateTime
- [x] TASK-P1-8: `auth.schema.ts` — LoginRequest, LoginResponse, RefreshResponse, MeResponse
- [x] TASK-P1-9: `organization.schema.ts` — CreateOrganization, CreateCenter, CreateDepartment, update variants
- [x] TASK-P1-10: `employee.schema.ts` — CreateEmployee (with TIEMPO_PARCIAL superRefine), UpdateEmployee, EmployeeResponse, WorkingCalendar
- [x] TASK-P1-11: `shift.schema.ts` — ShiftTemplate, RotationPattern, CreateSchedule, ShiftAssignment, CreateSwap, ApproveSwap
- [x] TASK-P1-12: `time-entry.schema.ts` — ClockIn, ClockOut, TimeEntryResponse, CreateCorrection, ApproveCorrection, OvertimeQuery
- [x] TASK-P1-13: `absence.schema.ts` — CreateAbsence, ApproveAbsence, AbsenceBalance
- [x] TASK-P1-14: `rule.schema.ts` — RuleSet, RuleCheckResult
- [x] TASK-P1-15: Barrel exports — schemas/index.ts, constants/index.ts, types/index.ts, src/index.ts
- [x] TASK-P1-16: `backend/package.json` updated with all required deps (Prisma, argon2, jsonwebtoken, cookie-parser, pg, zod, etc.)
- [x] TASK-P1-17: `backend/tsconfig.json` (CommonJS, @tempora/shared path alias) + `backend/nodemon.json`
- [x] TASK-P1-18: `backend/src/config/env.ts` — Zod-validated env, process.exit(1) on invalid
- [x] TASK-P1-19: `backend/src/db/prisma.ts` (singleton) + `backend/src/db/tenant.ts` (withTenant with set_config tx-local)
- [x] TASK-P1-20: `backend/src/db-context.ts` — AsyncLocalStorage, getDb(), getUser()
- [x] TASK-P1-21: `backend/prisma/schema.prisma` — all 13 enums
- [x] TASK-P1-22: `backend/prisma/schema.prisma` — all 17 models with composite indexes leading organizationId
- [x] TASK-P1-23: `prisma migrate dev --name init` — COMPLETE (migration `20260601105235_initial` applied against tempora-postgres Docker container)
- [x] TASK-P1-24: `backend/prisma/migrations/rls/001_rls_policies.sql` — RLS + FORCE RLS + tenant_isolation on all tenant tables, privileges
- [x] TASK-P1-25: `backend/prisma/migrations/rls/002_time_entry_trigger.sql` — enforce_timeentry_immutability trigger
- [x] TASK-P1-26: `backend/src/db/run-rls.ts` + `db:rls` npm script

## Completed (Batch 1B — P1-27 through P1-45)

- [x] TASK-P1-27: `backend/src/types/express.d.ts` — module augmentation `req.user: AuthUser`
- [x] TASK-P1-28: `backend/src/middleware/error.ts` — `ApiError` class + `errorHandler` (Express 5 4-arg)
- [x] TASK-P1-29: `backend/src/utils/async-handler.ts` — `asyncHandler(fn)` wrapper
- [x] TASK-P1-30: `backend/src/middleware/validate.ts` — `validate(schema, target?)` middleware factory
- [x] TASK-P1-31: `backend/src/middleware/require-role.ts` — `requireRole(roles[])` RBAC guard
- [x] TASK-P1-32: `backend/src/middleware/auth.ts` — `authenticate` (Bearer header → cookie fallback)
- [x] TASK-P1-33: `backend/src/middleware/tenant-context.ts` — `tenantContext` with ALS + withTenant
- [x] TASK-P1-34: `backend/src/audit/audit-writer.ts` — `AuditWriter.write(db, actorId, orgId, event, req?)`
- [x] TASK-P1-35: `backend/src/modules/iam/password.ts` — `hashPassword` / `verifyPassword` (argon2id)
- [x] TASK-P1-36: `backend/src/modules/iam/jwt.ts` — `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken` with jti
- [x] TASK-P1-37: `backend/src/modules/iam/iam.service.ts` — `login`, `refresh`, `logout`, `isBlocklisted`
- [x] TASK-P1-38: `backend/src/modules/iam/iam.controller.ts` + `iam.router.ts` — POST /auth/login, /refresh, /logout, GET /me
- [x] TASK-P1-39: `backend/src/modules/organization/organization.service.ts` — center + department CRUD with audit
- [x] TASK-P1-40: `backend/src/modules/organization/organization.controller.ts` + `organization.router.ts`
- [x] TASK-P1-41: `backend/src/modules/employees/working-calendar.service.ts` — `createCalendar`, `listCalendars`, `assignCalendar`
- [x] TASK-P1-42: `backend/src/modules/employees/employees.service.ts` — full employee CRUD with audit + termination
- [x] TASK-P1-43: `backend/src/modules/employees/employees.controller.ts` + `employees.router.ts`
- [x] TASK-P1-44: `backend/src/app.ts` — `createApp()` with full middleware stack
- [x] TASK-P1-45: `backend/src/server.ts` + `backend/src/modules/notifications/notifications.router.ts` (placeholder)

## Files Created/Modified

### Monorepo root
- `C:\Users\chris\desktop\TEMPORA\package.json` — created (npm workspaces root)
- `C:\Users\chris\desktop\TEMPORA\docker-compose.yml` — created

### packages/shared
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/constants/roles.ts`
- `packages/shared/src/constants/permissions.ts`
- `packages/shared/src/constants/enums.ts`
- `packages/shared/src/constants/error-codes.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/schemas/common.schema.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/schemas/organization.schema.ts`
- `packages/shared/src/schemas/employee.schema.ts`
- `packages/shared/src/schemas/shift.schema.ts`
- `packages/shared/src/schemas/time-entry.schema.ts`
- `packages/shared/src/schemas/absence.schema.ts`
- `packages/shared/src/schemas/rule.schema.ts`
- `packages/shared/src/types/index.ts`

### backend
- `backend/package.json` — updated with all required deps + `db:rls` script
- `backend/tsconfig.json` — created
- `backend/nodemon.json` — created
- `backend/prisma/schema.prisma` — created (enums + all 17 models)
- `backend/prisma/init/01-init.sql` — created
- `backend/prisma/migrations/rls/001_rls_policies.sql` — created
- `backend/prisma/migrations/rls/002_time_entry_trigger.sql` — created
- `backend/src/config/env.ts` — created
- `backend/src/db/prisma.ts` — created
- `backend/src/db/tenant.ts` — created
- `backend/src/db/run-rls.ts` — created
- `backend/src/db-context.ts` — created
- `backend/src/types/auth.ts` — created (AuthUser interface)
- `backend/src/types/express.d.ts` — created (P1-27)
- `backend/src/middleware/error.ts` — created (P1-28)
- `backend/src/utils/async-handler.ts` — created (P1-29)
- `backend/src/middleware/validate.ts` — created (P1-30)
- `backend/src/middleware/require-role.ts` — created (P1-31)
- `backend/src/middleware/auth.ts` — created (P1-32)
- `backend/src/middleware/tenant-context.ts` — created (P1-33)
- `backend/src/audit/audit-writer.ts` — created (P1-34)
- `backend/src/modules/iam/password.ts` — created (P1-35)
- `backend/src/modules/iam/jwt.ts` — created (P1-36)
- `backend/src/modules/iam/iam.service.ts` — created (P1-37)
- `backend/src/modules/iam/iam.controller.ts` — created (P1-38)
- `backend/src/modules/iam/iam.router.ts` — created (P1-38)
- `backend/src/modules/organization/organization.service.ts` — created (P1-39)
- `backend/src/modules/organization/organization.controller.ts` — created (P1-40)
- `backend/src/modules/organization/organization.router.ts` — created (P1-40)
- `backend/src/modules/employees/working-calendar.service.ts` — created (P1-41)
- `backend/src/modules/employees/employees.service.ts` — created (P1-42)
- `backend/src/modules/employees/employees.controller.ts` — created (P1-43)
- `backend/src/modules/employees/employees.router.ts` — created (P1-43)
- `backend/src/app.ts` — created (P1-44)
- `backend/src/server.ts` — created (P1-45)
- `backend/src/modules/notifications/notifications.router.ts` — created (P1-45 placeholder)

### frontend (Batch 1C)
- `frontend/package.json` — added @ngrx/signals, @ngrx/operators, primeng, primeicons, @primeuix/themes, @tempora/shared
- `frontend/tsconfig.json` — added @tempora/shared path alias
- `frontend/src/app/app.config.ts` — replaced (provideHttpClient + authInterceptor + API_BASE_URL)
- `frontend/src/app/app.routes.ts` — replaced (full route tree)
- `frontend/src/app/core/http/api.tokens.ts` — created
- `frontend/src/app/core/http/api-error.ts` — created
- `frontend/src/app/core/http/api.service.ts` — created
- `frontend/src/app/core/auth/auth.service.ts` — created
- `frontend/src/app/core/auth/auth.store.ts` — created
- `frontend/src/app/core/auth/auth.store.spec.ts` — created
- `frontend/src/app/core/auth/auth.interceptor.ts` — created
- `frontend/src/app/core/auth/auth.interceptor.spec.ts` — created
- `frontend/src/app/core/auth/auth.guard.ts` — created
- `frontend/src/app/core/auth/role.guard.ts` — created
- `frontend/src/app/core/layout/shell.component.ts` — created
- `frontend/src/app/core/layout/public-shell.component.ts` — created
- `frontend/src/app/features/auth/feature/login.component.ts` — created
- `frontend/src/app/features/dashboard/feature/dashboard.component.ts` — created (placeholder)
- `frontend/src/app/features/employees/feature/employees.component.ts` — created (placeholder)
- `frontend/src/app/features/shifts/feature/cuadrante.component.ts` — created (placeholder)
- `frontend/src/app/features/time-tracking/feature/clock.component.ts` — created (placeholder)
- `frontend/src/app/features/absences/feature/absence-request.component.ts` — created (placeholder)
- `frontend/src/app/features/reports/feature/reports.component.ts` — created (placeholder)
- `frontend/src/app/features/admin/feature/rulesets.component.ts` — created (placeholder)

## Completed (Batch 1C — P1-46 through P1-54)

- [x] TASK-P1-46: `frontend/package.json` + `frontend/tsconfig.json` — added NgRx signals/operators, PrimeNG, @tempora/shared; added @tempora/shared path alias
- [x] TASK-P1-47: `frontend/src/app/app.config.ts` — provideHttpClient + authInterceptor, provideRouter with ComponentInputBinding, API_BASE_URL token
- [x] TASK-P1-48: `core/http/api.tokens.ts` (API_BASE_URL InjectionToken), `api-error.ts` (toAppError), `api.service.ts` (typed get/post/patch/delete with withCredentials)
- [x] TASK-P1-49: `core/auth/auth.service.ts` + `auth.store.ts` (SignalStore: accessToken, user, role; login, refresh with shareReplay dedup, logoutLocal, logout; onInit re-hydrates) + `auth.store.spec.ts`
- [x] TASK-P1-50: `core/auth/auth.interceptor.ts` (Bearer header attach + 401 silent-refresh retry + logoutLocal on refresh failure) + `auth.interceptor.spec.ts`
- [x] TASK-P1-51: `core/auth/auth.guard.ts` (canActivate: isAuthenticated → /auth/login) + `core/auth/role.guard.ts` (roleGuard factory → /dashboard)
- [x] TASK-P1-52: `app.routes.ts` — full route tree: public /auth shell + authenticated shell guarded by authGuard; all feature routes lazy loadComponent; reports/admin with roleGuard; placeholder components for all 7 features
- [x] TASK-P1-53: `core/layout/shell.component.ts` (nav + @if role checks + logout) + `core/layout/public-shell.component.ts`
- [x] TASK-P1-54: `features/auth/feature/login.component.ts` — Reactive Form, nonNullable controls, accessibility labels, calls AuthStore.login(), navigates on success

## Phase 1 — COMPLETE ✅ (verified 2026-06-01, 27/27 tests passing)

### Post-verify fixes applied
- **CRIT-2 fixed**: `COOKIE_SAMESITE` default changed `'lax'` → `'strict'` in `backend/src/config/env.ts`
- **CRIT-1 fixed**: 6 test files written, 27 unit tests passing (`npm run test -w backend`):
  - `src/db/tenant.test.ts` — `withTenant` tx + set_config
  - `src/db-context.test.ts` — `getDb`/`getUser` ALS behaviour
  - `src/middleware/require-role.test.ts` — RBAC guard
  - `src/middleware/auth.test.ts` — authenticate middleware (401 paths + valid token)
  - `src/audit/audit-writer.test.ts` — AuditWriter.write row count + field correctness
  - `src/modules/employees/employee-schema.test.ts` — CreateEmployeeSchema TIEMPO_PARCIAL rule
- **RLS path fix**: `run-rls.ts` updated to look for SQL files at `prisma/rls/` (not `prisma/migrations/rls/` which caused Prisma P3015 errors)
- **RLS files recreated** at correct location: `backend/prisma/rls/001_rls_policies.sql`, `002_time_entry_trigger.sql`
- **`vitest.config.ts`** created at `backend/` (node environment, `src/**/*.test.ts` include)
- **`packages/shared/tsconfig.json`** — `"ignoreDeprecations": "6.0"` added
- **`employee.schema.ts`** — `CreateEmployeeBaseSchema` extracted so `.partial()` works before `superRefine` wraps into ZodEffects

## Notes

### Deviations from design

1. **`AuditWriter.write()` signature**: The design shows `write(db, actor, event, req?)` but the implementation adds `organizationId` as a required third parameter. This is necessary because `AuditLog.organizationId` is NOT NULL in the Prisma schema and cannot be inferred from inside the writer without an extra query. This is strictly additive — all callers already have `organizationId` available via `req.user.organizationId`.

2. **`iam.service.ts` function signatures**: The design description mentioned `db: PrismaClient` as a param but noted "use prisma singleton directly." The implementation uses the prisma singleton globally (no db param) since login/refresh/logout all run outside tenant context. This matches the corrected note in the task prompt.

3. **`refresh` audit action**: Mapped to `LOGIN` (same as `AuditAction.LOGIN`) because the schema's `AuditAction` enum has no `REFRESH` value. This is logged clearly in comments.

4. **`terminateEmployee` token blocklist**: Deactivates the user account (`isActive: false`) via the global prisma singleton rather than inserting JTIs directly. Individual JTI tracking per-user would require a session table not present in the schema. The `isActive: false` approach is the correct defense — `login` already checks `isActive: true`.

5. **`softDeleteCenter`**: The Center model has no `deletedAt` column. The "soft delete" from the task description is implemented as a hard delete guarded by an active-employee count check (same semantic guarantee, simpler schema). Note added in service comment.

6. **`server.ts`**: The task prompt specified `sseHub.closeAll()` in shutdown, but the SSE hub is not implemented until Phase 3. The placeholder server.ts omits this call. When P3 is implemented, add `sseHub.closeAll()` to the shutdown handler.

7. **`API_BASE_URL` location (Batch 1C)**: The task P1-47 description defined `API_BASE_URL` in app.config.ts, but P1-48 stated the canonical definition should be in `api.tokens.ts` (imported into app.config.ts). The canonical definition is in `api.tokens.ts`; `app.config.ts` imports it from there. This is the correct pattern per design §5.1.

8. **`standalone: true` omitted (Batch 1C)**: Angular 21 project CLAUDE.md explicitly prohibits setting `standalone: true` in `@Component` decorators (it is the default in Angular v20+). All components in Batch 1C follow this convention.

9. **Route structure — loadComponent for shells (Batch 1C)**: The task P1-52 description used `component:` for shell components, but design §5.5 uses `loadComponent:` for lazy-loaded shells. The implementation follows the design for consistency with the lazy-loading strategy.

10. **`auth.store.ts` — `refresh()` shareReplay pattern**: The in-flight deduplication uses a module-level variable (`refreshInFlight$`) reset in `tap` error/complete callbacks rather than a global `Subject`. This is equivalent in behavior but avoids an additional `BehaviorSubject` dependency in the store. The `shareReplay(1)` is applied to the hot observable chain.

### Design faithfulness
- All middleware follows design §3.4 ordering exactly.
- `tenantContext` pattern matches design §3.2 verbatim.
- `authenticate` follows design §3.3 exactly (Bearer header → access_token cookie fallback).
- `ApiError` shape `{ code, message, details? }` matches design error envelope.
- Audit rows written in-transaction with mutations (atomicity guarantee preserved).
- argon2id variant used, plaintext never returned or logged.
- JWT: jti via `randomUUID()`, separate secrets for access/refresh, TTLs from env.
