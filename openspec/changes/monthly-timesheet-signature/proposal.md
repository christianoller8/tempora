# Proposal: Monthly Timesheet Signature

## Intent

RD-ley 8/2019 and the 2026 control-horario reform require an auditable, employee-acknowledged registro de jornada. Today employees clock in/out but never confirm their monthly record, leaving the audit trail one-sided. This change lets each employee review and digitally confirm (sign) their monthly timesheet, producing an immutable timestamped acknowledgment and locking that month read-only for them. Managers/admins gain a confirmation-status overview to chase pending sign-offs. "Signature" = a DB record (employeeId, year, month, confirmedAt), not cryptographic.

## Scope

### In Scope
- New `TimesheetSignature` model (append-only, org-scoped, RLS).
- Employee monthly summary endpoint + "Confirm [Month] timesheet" action.
- Confirmation locks that employee's month: clock-in/out and self time-corrections for a confirmed month MUST be rejected.
- Manager/admin endpoint listing confirmed vs pending employees per month.
- `AuditLog` row (action=`APPROVE`, entityType=`TimesheetSignature`) on confirm.
- Frontend feature: monthly review screen, confirm button, locked-state UI; manager confirmation-status view.
- Shared Zod schemas + enum additions.

### Out of Scope
- Cryptographic/qualified e-signatures (eIDAS).
- Manager override/un-lock of a confirmed month (deferred; needs amendment workflow).
- PDF export of the signed timesheet (reporting handles exports later).
- Reminder notifications for pending confirmations (future enhancement).

## Capabilities

### New Capabilities
- `timesheet-signature`: employee monthly review, confirmation record, month-lock enforcement, and manager confirmation-status reporting.

### Modified Capabilities
- `time-tracking`: clock-in/out and self time-corrections MUST be rejected for a month the employee has confirmed (lock enforcement).
- `audit-compliance`: signature confirmation MUST produce an `AuditLog` entry.

## Approach

- DB: add `TimesheetSignature` model — `id, organizationId, employeeId, year, month, confirmedAt, createdAt`, `@@unique([organizationId, employeeId, year, month])`, org-leading indexes, RLS, INSERT-only (no UPDATE/DELETE for app role), matching TimeEntry/AuditLog conventions.
- Backend: new `timesheet-signature` module (controller/router/service/tests) reusing reporting's monthly aggregation for the summary. Confirm is transactional with the audit write. Add a lock guard in `time-tracking` service consulted on clock-in/out and self-corrections.
- Frontend: new `timesheet` feature (data-access store/api, monthly review + confirm UI, locked banner) and a manager confirmation-status table.
- Shared: extend enums + add Zod schemas for confirm request/response and status list.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modified | Add `TimesheetSignature` model + Organization/Employee relations |
| `backend/prisma/migrations/` | New | Migration + RLS/privilege grants |
| `backend/src/modules/timesheet-signature/` | New | Module: confirm, summary, status |
| `backend/src/modules/time-tracking/` | Modified | Reject ops for confirmed months |
| `backend/src/server.ts` | Modified | Register router |
| `packages/shared/src/schemas/` | New/Modified | Signature Zod schemas |
| `frontend/src/app/features/timesheet/` | New | Review + confirm + manager status UI |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Lock guard misses an edit path, letting confirmed months change | Med | Centralize lock check in one service helper; cover with tests for every mutating time-tracking path |
| Confirming a month with an open (uncosed) TimeEntry | Med | Reject confirmation if any OPEN entry exists in the month; surface clear error |
| Regression in the 245 passing backend tests | Med | Additive schema + new module; run full suite before merge |
| RLS/privilege drift on new table | Low | Mirror TimeEntry migration template for grants and RLS policy |

## Rollback Plan

Additive change. To revert: drop the `TimesheetSignature` table via down-migration, remove the `timesheet-signature` module + router registration, revert the time-tracking lock guard, and remove the frontend `timesheet` feature route. No existing data is mutated, so rollback is non-destructive.

## Dependencies

- Existing reporting monthly-hours aggregation (reuse for the summary).
- Existing `AuditLog` write path and RLS migration template.

## Success Criteria

- [ ] An employee can view their monthly summary and confirm it; a `TimesheetSignature` row is created with server `confirmedAt`.
- [ ] After confirmation, clock-in/out and self time-corrections for that month return HTTP 409/422.
- [ ] Re-confirming the same month is idempotent or rejected (no duplicates) per the unique constraint.
- [ ] Managers/admins can list confirmed vs pending employees for a given month, center-scoped.
- [ ] Each confirmation produces one `AuditLog` row.
- [ ] All 245 backend tests still pass plus new module tests.
