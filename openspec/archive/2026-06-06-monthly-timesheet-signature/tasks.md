# Tasks: Monthly Timesheet Signature

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 750–950 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → DB + Shared + Lock guard + Backend module + Tests · PR 2 → Frontend feature |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB schema + migration + RLS + shared schemas + backend module (service/controller/router) + lock guard injection + all backend tests | PR 1 | Base: main. Ships a fully tested backend; frontend deferred. |
| 2 | Frontend feature: store, API service, review component, status component, badge, route wiring, locked-UI | PR 2 | Base: PR 1 branch (stacked) or main after merge. Depends on PR 1 endpoints being live. |

---

## Phase 1: DB + Shared Package Foundation

- [x] 1.1 Add `TimesheetSignature` model to `backend/prisma/schema.prisma` — fields: `id (uuid, gen_random_uuid)`, `organizationId`, `employeeId`, `year Int`, `month Int`, `confirmedAt Timestamptz(6) @default(now())`, `createdAt Timestamptz(6) @default(now())`; relations to `Organization` and `Employee`; `@@unique([organizationId, employeeId, year, month])`; `@@index([organizationId])`; `@@index([organizationId, year, month])`; `@@map("timesheet_signatures")`. Acceptance: FR-TSS-001, FR-TSS-002, NFR-TSS-005.
- [x] 1.2 Add back-references to `Organization` model (`timesheetSignatures TimesheetSignature[]`) and `Employee` model (`timesheetSignatures TimesheetSignature[]`) in `backend/prisma/schema.prisma`. Acceptance: schema compiles without errors.
- [x] 1.3 Run `prisma migrate dev --name add_timesheet_signatures` from `backend/` to generate migration in `backend/prisma/migrations/`. Acceptance: migration file created, DB schema updated.
- [x] 1.4 Add RLS + privilege block for `timesheet_signatures` to `backend/prisma/rls/001_rls_policies.sql` — `GRANT SELECT, INSERT` only (no UPDATE/DELETE), enable RLS, `FORCE ROW LEVEL SECURITY`, `tenant_isolation` policy on `organizationId`. Mirror the `audit_logs` block exactly. Acceptance: FR-TSS-013, FR-TSS-014, NFR-TSS-006; AC-TSS-014.
- [x] 1.5 Create `packages/shared/src/schemas/timesheet-signature.schema.ts` with: `ConfirmTimesheetSchema`, `TimesheetSummaryQuerySchema`, `ConfirmationStatusQuerySchema`, `TimesheetSignatureResponseSchema`, `TimesheetSummaryResponseSchema`, `ConfirmationStatusRowSchema`. Acceptance: FR-TSS-017.
- [x] 1.6 Add `export * from './timesheet-signature.schema.js';` to `packages/shared/src/schemas/index.ts`. Acceptance: schemas available from shared package root.
- [x] 1.7 Rebuild shared dist: run the build script in `packages/shared/` and commit updated `dist/` artifacts. Acceptance: `packages/shared/dist/` reflects new exports.

## Phase 2: Backend Module — timesheet-signature

- [x] 2.1 Create `backend/src/modules/timesheet-signature/timesheet-signature.service.ts` with exported functions: `assertMonthNotConfirmed(employeeId, date, orgId, db)` (throws `ApiError(409, 'MONTH_LOCKED', ...)` when confirmed); `assertNoOpenEntry(employeeId, year, month, db)` (throws `ApiError(422, 'OPEN_ENTRIES_EXIST', ...)`); `confirmMonth(employeeId, year, month, actorId, orgId, db)` (flow: check open entries → findUnique → create + audit in transaction → handle P2002 race); `getMonthlySummary(employeeId, year, month, orgId, db)`; `listConfirmationStatus(year, month, db)`. Acceptance: FR-TSS-004, FR-TSS-005, FR-TSS-006, FR-TSS-007, FR-TSS-009; AC-TSS-002, AC-TSS-003, AC-TSS-004, AC-TSS-013.
- [x] 2.2 Create `backend/src/modules/timesheet-signature/timesheet-signature.controller.ts` — three thin handlers: `handleGetSummary` (GET `/summary`, EMPLOYEE forced to own `employeeId`), `handleConfirm` (POST `/confirm`, validates body with `ConfirmTimesheetSchema`), `handleGetStatus` (GET `/status`, ADMIN/MANAGER only). Shape responses as `{ data: ... }`. Acceptance: FR-TSS-003, FR-TSS-010, FR-TSS-011; AC-TSS-009, AC-TSS-010.
- [x] 2.3 Create `backend/src/modules/timesheet-signature/timesheet-signature.router.ts` — mount three routes with `requireRole` guards as specified in design §4. Static paths only (`/summary`, `/confirm`, `/status`). Acceptance: FR-TSS-012, NFR-TSS-010.
- [x] 2.4 Register the new router in `backend/src/app.ts`: `import { timesheetSignatureRouter } from './modules/timesheet-signature/timesheet-signature.router'` and `app.use('/timesheet-signatures', timesheetSignatureRouter)` (after `tenantContext` is applied, before `errorHandler`). Acceptance: all three endpoints reachable.

## Phase 3: Lock Guard Injection into time-tracking

- [x] 3.1 Import `assertMonthNotConfirmed` from `../../timesheet-signature/timesheet-signature.service` in `backend/src/modules/time-tracking/time.service.ts`. Acceptance: import compiles cleanly, no circular dependency.
- [x] 3.2 Inject `await assertMonthNotConfirmed(employeeId, new Date(), orgId, db)` into `clockIn` in `time.service.ts` — after the existing OPEN-entry check, before `db.timeEntry.create`. Acceptance: FR-TSS-007, FR-TSS-008; AC-TSS-005.
- [x] 3.3 Inject `await assertMonthNotConfirmed(employeeId, openEntry.clockIn, orgId, db)` into `clockOut` — after the `openEntry` lookup, before the OPEN→CLOSED update. Month derived from `openEntry.clockIn`. Acceptance: FR-TSS-007; AC-TSS-006.
- [x] 3.4 Inject `await assertMonthNotConfirmed(employeeId, entry.clockIn, orgId, db)` into `createCorrection` (self-corrections only) — after the `timeEntry` lookup, before `db.timeCorrection.create`. Acceptance: FR-TSS-007; AC-TSS-007. Note: `approveCorrection` and `rejectCorrection` MUST NOT be guarded (ADR-3).

## Phase 4: Backend Tests

- [x] 4.1 Create `backend/src/modules/timesheet-signature/timesheet-signature.service.test.ts` — unit tests: `confirmMonth` creates row + 1 AuditLog(APPROVE); re-confirm returns existing row + `created: false` + no second AuditLog; 422 on OPEN entries; P2002 race returns existing row; `getMonthlySummary` returns correct shape for confirmed and unconfirmed months; `listConfirmationStatus` returns all employees with correct flags; `assertMonthNotConfirmed` throws 409 on confirmed, passes on unconfirmed (UTC boundary cases). Covers: AC-TSS-001, AC-TSS-002, AC-TSS-003, AC-TSS-004, AC-TSS-013; NFR-TSS-001.
- [x] 4.2 Create `backend/src/modules/timesheet-signature/timesheet-signature.controller.test.ts` — HTTP-level tests: POST `/confirm` returns 201 on create, 200 on re-confirm; EMPLOYEE cannot confirm another employee's month; GET `/status` returns 403 for EMPLOYEE, 200 (scoped) for MANAGER. Covers: FR-TSS-012; AC-TSS-009, AC-TSS-010, AC-TSS-011; NFR-TSS-010.
- [x] 4.3 Extend `backend/src/modules/time-tracking/time.service.test.ts` — add lock-guard integration tests: `clockIn` on confirmed month → 409 MONTH_LOCKED; `clockOut` on confirmed month entry → 409; `createCorrection` on confirmed month → 409; `approveCorrection`/`rejectCorrection` on confirmed month → NOT blocked. Covers: FR-TSS-007, FR-TSS-008; AC-TSS-005, AC-TSS-006, AC-TSS-007, AC-TSS-008.
- [x] 4.4 Run the full backend test suite and confirm all 245 pre-existing tests still pass alongside new tests. Acceptance: NFR-TSS-001; no regressions.

## Phase 5: Frontend Feature

- [x] 5.1 Create `frontend/src/app/features/timesheet/data-access/timesheet.api.ts` — `HttpClient`-based service with `getSummary(year, month, employeeId?)`, `confirmMonth(year, month)`, `getConfirmationStatus(year, month, centerId?)`. Acceptance: FR-TSS-015, FR-TSS-016.
- [x] 5.2 Create `frontend/src/app/features/timesheet/data-access/timesheet.store.ts` — `SignalStore` with state `{ summary, statusList, selectedYear, selectedMonth, loading, error, confirmedOverride }`; `isConfirmed()` method + computed `canConfirm`; methods `loadSummary`, `confirmMonth`, `loadStatus`. Pattern mirrors `absences.store.ts` (TS 5.9 explicit interface workaround). Acceptance: FR-TSS-015, FR-TSS-016; AC-TSS-012.
- [x] 5.3 Create `frontend/src/app/features/timesheet/ui/confirmation-badge.component.ts` — standalone presentational pill component showing confirmed/pending status. `ChangeDetectionStrategy.OnPush`, WCAG-AA. Acceptance: FR-TSS-015.
- [x] 5.4 Create `frontend/src/app/features/timesheet/feature/timesheet-review.component.ts` — employee monthly review: month selector (reactive form), summary stats, "Confirm [Month] timesheet" button (disabled when `hasOpenEntry` or already confirmed), locked read-only banner (`@if (isConfirmed())`), PrimeNG toast for success/error. Standalone, OnPush, inject, native control flow. Acceptance: FR-TSS-015; AC-TSS-012.
- [x] 5.5 Create `frontend/src/app/features/timesheet/feature/timesheet-status.component.ts` — manager/admin PrimeNG `p-table` listing employees with confirmation status for selected month; summary chips (total/confirmed/pending); month selector. Standalone, OnPush. Acceptance: FR-TSS-016; AC-TSS-009, AC-TSS-011.
- [x] 5.6 Register lazy routes `/timesheet` (all authenticated roles) and `/timesheet-status` (ADMIN/MANAGER guard) in app router; added navigation links in shell for all roles. Acceptance: routes are reachable, role guard enforced.
- [x] 5.7 Write store unit tests (14 tests): `confirmMonth()` sets `confirmedOverride=true`; `isConfirmed()` derives from `confirmedOverride` then `summary.confirmed`; `canConfirm` is false when `hasOpenEntry` or already confirmed; error path sets `error`, keeps `confirmed` unchanged; `loadSummary`/`loadStatus` success/error paths covered. All 14 tests passing. Acceptance: NFR-TSS-001 (frontend coverage).

---

## Dependency Notes

- Tasks 1.1–1.4 MUST complete before any backend service code (Phase 2) — Prisma client must be regenerated after migration.
- Task 1.5–1.7 (shared schemas) MUST complete before controller validation in 2.2 — schemas are imported from `@tempora/shared`.
- Phase 2 (2.1–2.4) MUST complete before Phase 3 (lock guard) — `assertMonthNotConfirmed` must exist before it is imported into `time.service.ts`.
- Phase 3 MUST complete before Phase 4 lock-integration tests (4.3).
- Phase 5 is independent of Phases 3–4 but depends on Phase 2 endpoints being available (5.1 imports API shape from shared schemas).
- Task 4.4 (full suite run) is the final gate before any PR is submitted.
- PR 1 boundary: Tasks 1.1–4.4 (backend complete + tested).
- PR 2 boundary: Tasks 5.1–5.7 (frontend complete + tested).
