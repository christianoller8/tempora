# Apply Progress: monthly-timesheet-signature

**Change**: monthly-timesheet-signature
**Mode**: Strict TDD
**Batch**: PR 1 (Phases 1–4) + PR 2 (Phase 5) — COMPLETE
**Date**: 2026-06-06
**Status**: done

---

## Completed Tasks

### Phase 1: DB + Shared Package Foundation
- [x] 1.1 Added `TimesheetSignature` model to `backend/prisma/schema.prisma`
- [x] 1.2 Added back-references to `Organization.timesheetSignatures` and `Employee.timesheetSignatures`
- [x] 1.3 Ran `prisma migrate dev --name add_timesheet_signatures` — migration `20260606085425_add_timesheet_signatures` created; Prisma client regenerated
- [x] 1.4 Added RLS + privilege block for `timesheet_signatures` in `backend/prisma/rls/001_rls_policies.sql` (mirroring `audit_logs` pattern: GRANT SELECT, INSERT; ENABLE/FORCE RLS; DROP+CREATE tenant_isolation policy)
- [x] 1.5 Created `packages/shared/src/schemas/timesheet-signature.schema.ts` with all 6 schemas (ConfirmTimesheetSchema, TimesheetSummaryQuerySchema, ConfirmationStatusQuerySchema, TimesheetSignatureResponseSchema, TimesheetSummaryResponseSchema, ConfirmationStatusRowSchema) plus inferred types
- [x] 1.6 Added `export * from './timesheet-signature.schema.js';` to `packages/shared/src/schemas/index.ts`
- [x] 1.7 Rebuilt shared dist via `npm run build -w packages/shared` — all dist artifacts updated

### Phase 2: Backend Module
- [x] 2.1 Created `backend/src/modules/timesheet-signature/timesheet-signature.service.ts` — exports: `assertMonthNotConfirmed`, `assertNoOpenEntry`, `confirmMonth` (with P2002 race handling), `getMonthlySummary`, `listConfirmationStatus`
- [x] 2.2 Created `backend/src/modules/timesheet-signature/timesheet-signature.controller.ts` — thin handlers: `handleGetSummary`, `handleConfirm`, `handleGetStatus`; EMPLOYEE self-scoping enforced
- [x] 2.3 Created `backend/src/modules/timesheet-signature/timesheet-signature.router.ts` — 3 static routes with requireRole guard on /status
- [x] 2.4 Registered router in `backend/src/app.ts` — `app.use('/timesheet-signatures', timesheetSignatureRouter)`; mounted after tenantContext (global) and before errorHandler

### Phase 3: Lock Guard Injection
- [x] 3.1 Imported `assertMonthNotConfirmed` from `../timesheet-signature/timesheet-signature.service` in `backend/src/modules/time-tracking/time.service.ts`
- [x] 3.2 Injected guard into `clockIn` after OPEN-entry check, before `db.timeEntry.create`; month derived from `new Date()`
- [x] 3.3 Injected guard into `clockOut` after `openEntry` lookup, before OPEN→CLOSED update; month derived from `openEntry.clockIn`
- [x] 3.4 Injected guard into `createCorrection` after `timeEntry` lookup, before `db.timeCorrection.create`; month derived from `entry.clockIn`. `approveCorrection`/`rejectCorrection` intentionally NOT guarded (ADR-3)

### Phase 4: Backend Tests
- [x] 4.1 Created `backend/src/modules/timesheet-signature/timesheet-signature.service.test.ts` — 15 tests covering: assertMonthNotConfirmed (4 tests), assertNoOpenEntry (2), confirmMonth (4), getMonthlySummary (3), listConfirmationStatus (2)
- [x] 4.2 Created `backend/src/modules/timesheet-signature/timesheet-signature.controller.test.ts` — 6 tests covering: handleConfirm 201/200/EMPLOYEE-scoping, handleGetSummary EMPLOYEE-forced/MANAGER-override, handleGetStatus summary aggregation
- [x] 4.3 Extended `backend/src/modules/time-tracking/time.service.test.ts` — added 9 lock guard integration tests (clockIn/clockOut/createCorrection blocked + approveCorrection/rejectCorrection NOT blocked); also added `timesheetSignature: { findUnique: vi.fn().mockResolvedValue(null) }` to `makeMockDb` so existing tests pass transparently
- [x] 4.4 Full backend test suite: **275 tests passing** (245 pre-existing + 30 new including W-4 validation tests), zero regressions

### Phase 5: Frontend Feature
- [x] 5.1 Created `frontend/src/app/features/timesheet/data-access/timesheet.api.ts` — `HttpClient`-based service with `getSummary(year, month, employeeId?)`, `confirmMonth(year, month)`, `getConfirmationStatus(year, month, centerId?)`; DTOs exported: `TimesheetSummaryDto`, `TimesheetSignatureDto`, `ConfirmationStatusRowDto`
- [x] 5.2 Created `frontend/src/app/features/timesheet/data-access/timesheet.store.ts` — `SignalStore` with state `{ summary, statusList, selectedYear, selectedMonth, loading, error, confirmedOverride }`; `isConfirmed()` method (reads `confirmedOverride ?? summary.confirmed`); computed `canConfirm`; methods `loadSummary`, `confirmMonth`, `loadStatus`. `confirmMonth` re-throws on error for component toast handling.
- [x] 5.3 Created `frontend/src/app/features/timesheet/ui/confirmation-badge.component.ts` — standalone presentational pill, confirmed (green) or pending (amber), WCAG-AA compliant with `role="status"` and `aria-label`
- [x] 5.4 Created `frontend/src/app/features/timesheet/feature/timesheet-review.component.ts` — employee monthly review: month/year selector (reactive form), stats (regularHours, overtimeHours, totalAbsenceDays), ConfirmationBadge, locked banner when confirmed, "Confirm [Month] [Year] timesheet" button (disabled when `!canConfirm || loading`), PrimeNG toast for success/error
- [x] 5.5 Created `frontend/src/app/features/timesheet/feature/timesheet-status.component.ts` — manager/admin PrimeNG p-table listing employees with confirmation status; summary chips (Total/Confirmed/Pending); month/year selector; Refresh button
- [x] 5.6 Added lazy routes `/timesheet` (all authenticated) and `/timesheet-status` (ADMIN/MANAGER roleGuard) to `frontend/src/app/app.routes.ts`; updated `shell.component.ts` navItems for all 3 roles (EMPLOYEE: "My Timesheet", MANAGER/ADMIN: "My Timesheet" + "Timesheet Status")
- [x] 5.7 Created `frontend/src/app/features/timesheet/data-access/timesheet.store.spec.ts` — **14 tests passing**: initial state, isConfirmed (null/false/true), canConfirm (confirmed/openEntry/normal), loadSummary success/error, confirmMonth success/idempotent/error, loadStatus success/error, loading initial state

---

## Test Summary
- **Phase 4 backend tests written**: 30 (27 task + 3 W-4 validation)
- **Phase 5 frontend tests written**: 14
- **Total new tests**: 44
- **Total tests passing**: 275 (backend) + 114 (frontend) = 389
- **Regressions introduced**: 0

---

## Files Changed

### PR 1 — Backend
| File | Action | Details |
|------|--------|---------|
| `backend/prisma/schema.prisma` | Modified | Added `TimesheetSignature` model + back-references |
| `backend/prisma/migrations/20260606085425_add_timesheet_signatures/` | Created | Migration SQL |
| `backend/prisma/rls/001_rls_policies.sql` | Modified | RLS + GRANT INSERT/SELECT |
| `packages/shared/src/schemas/timesheet-signature.schema.ts` | Created | 6 Zod schemas |
| `packages/shared/src/schemas/index.ts` | Modified | Re-export |
| `packages/shared/dist/*` | Modified | Rebuilt |
| `backend/src/modules/timesheet-signature/timesheet-signature.service.ts` | Created | Service |
| `backend/src/modules/timesheet-signature/timesheet-signature.controller.ts` | Created | Controller |
| `backend/src/modules/timesheet-signature/timesheet-signature.router.ts` | Created | Router |
| `backend/src/modules/timesheet-signature/timesheet-signature.service.test.ts` | Created | 15 tests |
| `backend/src/modules/timesheet-signature/timesheet-signature.controller.test.ts` | Created | 6 tests |
| `backend/src/modules/time-tracking/time.service.ts` | Modified | Guard injection |
| `backend/src/modules/time-tracking/time.service.test.ts` | Modified | +9 tests |
| `backend/src/app.ts` | Modified | Router mount |

### PR 2 — Frontend
| File | Action | Details |
|------|--------|---------|
| `frontend/src/app/features/timesheet/data-access/timesheet.api.ts` | Created | API service |
| `frontend/src/app/features/timesheet/data-access/timesheet.store.ts` | Created | SignalStore |
| `frontend/src/app/features/timesheet/data-access/timesheet.store.spec.ts` | Created | 14 tests |
| `frontend/src/app/features/timesheet/ui/confirmation-badge.component.ts` | Created | Badge component |
| `frontend/src/app/features/timesheet/feature/timesheet-review.component.ts` | Created | Review component |
| `frontend/src/app/features/timesheet/feature/timesheet-status.component.ts` | Created | Status component |
| `frontend/src/app/app.routes.ts` | Modified | Routes |
| `frontend/src/app/core/layout/shell.component.ts` | Modified | Nav links |

### Test Fixes (Pre-existing)
| File | Fix |
|------|-----|
| `frontend/src/app/features/absences/data-access/absences.store.spec.ts` | Added `decisionComment: null` |
| `frontend/src/app/features/notifications/data-access/notifications.store.spec.ts` | Signal type cast |
| `frontend/src/app/features/shifts/data-access/schedules.store.spec.ts` | Matcher update |
| `frontend/src/app/features/shifts/feature/cuadrante.component.spec.ts` | Matcher + method refs |
| `frontend/src/app/features/shifts/feature/swap-approval.component.spec.ts` | Matcher update |
| `frontend/src/app/features/time-tracking/feature/clock.component.spec.ts` | Method rename + type |

---

## Deviations Resolved

1. In-transaction audit write follows `absences.service.ts` pattern
2. Lock guard uses correct employee ID for self-corrections
3. `getMonthlySummary` includes `contractedHoursPerWeek` for derivation
4. App router mount inherits global tenantContext
5. `isConfirmed()` implemented as method (ngrx/signals limitation workaround)
6. `confirmedOverride` state field tracks client-side confirmation without server round-trip
7. Routes use flat paths for consistency with other features

---

## Workload Summary

- Mode: Chained PR slice (stacked-to-main)
- PR 1: DB + Shared + Backend module + Lock guard + Backend tests — 275 passing
- PR 2: Frontend feature — 14 tests passing, 0 regressions
- Total new tests: 44
