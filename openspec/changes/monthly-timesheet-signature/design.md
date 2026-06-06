# Design: Monthly Timesheet Signature

> Technical design for the `monthly-timesheet-signature` change. Reflects existing Tempora conventions: org-scoped RLS, immutable/insert-only compliance tables, in-transaction audit writes, thin controllers + auth-agnostic services, SignalStore data-access, and shared Zod schemas.

## 1. Architecture Decisions (ADRs)

### ADR-1 — Signature is an append-only DB record, not a cryptographic signature

**Decision.** A confirmation is a single row in a new `TimesheetSignature` table (`employeeId, year, month, confirmedAt`). No hashing, no PKI, no eIDAS. The table follows the existing `AuditLog`/`TimeEntry` compliance pattern: INSERT-only at the DB privilege level (no UPDATE/DELETE for `tempora_app`), org-scoped RLS, `organizationId`-leading indexes.

**Rationale.** RD-ley 8/2019 requires an *auditable, employee-acknowledged* record — not a qualified e-signature. The legal weight comes from immutability + the paired `AuditLog` row + server-authoritative timestamp, all of which Tempora already enforces for `TimeEntry`. A cryptographic signature adds key management, revocation, and trust-anchor complexity with zero added compliance value at this stage.

**Alternatives considered.**
- *HMAC/digest over the month's entries.* Rejected: introduces a key-rotation and re-validation burden; the immutable `TimeEntry` rows + audit trail already prove tamper-evidence at the DB layer.
- *eIDAS qualified signature.* Rejected: explicitly out of scope; requires external trust providers and a legal mandate we do not have.

### ADR-2 — Lock enforcement lives in a single shared service helper, consulted by `time-tracking`

**Decision.** Add one helper, `assertMonthNotConfirmed(employeeId, date, orgId, db)`, exported from the new module (`timesheet-signature.service.ts`). The `time-tracking` service calls it at the top of every mutating path: `clockIn`, `clockOut`, and `createCorrection` (self-corrections). On a confirmed month it throws `ApiError(409, 'MONTH_LOCKED', ...)`.

**Rationale.** The proposal's top risk is "lock guard misses an edit path." Centralizing the check in ONE function — rather than scattering `findFirst` calls or adding Express middleware — means every mutating path is provably guarded and testable in isolation. A service-call (not middleware) is correct because the lock decision is *data-dependent* (which employee, which month derived from the entry's clock-in date), and the existing `time.service` functions already own employee/date resolution. Middleware would not have the resolved `employeeId` or the entry's month for `clockOut`/corrections.

**Alternatives considered.**
- *Express middleware on the time routes.* Rejected: middleware runs before the service resolves `employeeId` (admins may proxy-clock other employees via body), and `clockOut`/correction lock decisions depend on the *target entry's* month, not the request body.
- *DB trigger rejecting inserts for confirmed months.* Rejected: harder to surface a clean 409 with a domain message; duplicates business logic in SQL; the team's convention keeps business rules in the service layer (triggers are reserved for the narrow immutability guard).

### ADR-3 — Lock scope: clock-in and self-corrections only; manager corrections unaffected

**Decision.** The lock blocks `clockIn`, `clockOut`, and employee-initiated `createCorrection` for a confirmed month. It does NOT block manager/admin correction *approval* (`approveCorrection`/`rejectCorrection`) of corrections that already exist, and it does NOT block reporting reads.

**Rationale.** Confirmation is the *employee's* acknowledgment that their own record is final — it freezes their self-service edits. Manager decisions on already-submitted corrections are a separate governance path. The proposal scopes the lock to "clock-in/out and self time-corrections"; the out-of-scope note defers any manager unlock/amendment workflow.

**Alternatives considered.**
- *Lock everything including manager approvals.* Rejected: would strand any correction submitted before confirmation in a permanently un-decidable state; contradicts the proposal's "no manager unlock" being about *re-opening*, not *deciding pending items*.

### ADR-4 — Re-confirm is idempotent via the unique constraint + read-back

**Decision.** Confirm is `INSERT ... ` guarded by a prior `findUnique` on `@@unique([organizationId, employeeId, year, month])`. If a row exists, return it with HTTP 200 (no second audit row, no error). The unique constraint is the hard backstop against a race; the read-back makes the happy path a clean 200/201.

**Rationale.** The success criteria require "idempotent or rejected (no duplicates)." Returning the existing record is friendlier than a 409 and matches REST idempotency expectations for a confirm action. The DB constraint guarantees correctness even under concurrent requests; if two requests race past the read, the second INSERT hits `P2002` which the service maps to a final read-back returning the winning row.

**Alternatives considered.**
- *409 Conflict on re-confirm.* Rejected: forces the frontend to special-case an expected, harmless action.
- *Upsert.* Rejected: `confirmedAt` must NOT move on re-confirm (the original acknowledgment time is the legally meaningful one), and the table is INSERT-only by privilege.

### ADR-5 — Open-entry guard: reject confirmation while an OPEN TimeEntry exists in the month

**Decision.** Before inserting the signature, the service checks for any `TimeEntry` with `status = 'OPEN'` whose `clockIn` falls in the target month for that employee. If found, throw `ApiError(422, 'OPEN_ENTRY_IN_MONTH', ...)`.

**Rationale.** Proposal risk: "Confirming a month with an open (unclosed) TimeEntry." An open shift means the record is not yet final; signing it would lock the employee out of clocking out (ADR-2 lock), creating a deadlock. Rejecting confirmation with a clear message is the only safe option.

### ADR-6 — Summary endpoint reuses reporting's monthly aggregation, scoped to one employee

**Decision.** The employee monthly summary endpoint returns the same per-employee hours shape as `reporting.monthlyHoursReport`, filtered to the requesting employee plus the confirmation status for that month. We extract/reuse the existing SQL aggregation rather than re-implementing it.

**Rationale.** Dependency listed in the proposal. Single source of truth for "hours in a month" avoids drift between what the employee confirms and what reports show managers.

## 2. DB Schema

### Prisma model (add to `backend/prisma/schema.prisma`, in a new TIMESHEET SIGNATURE section)

```prisma
// ----------------------------- TIMESHEET SIGNATURE -----------------------------

// APPEND-ONLY. No @updatedAt. No cascade. App role has INSERT + SELECT only
// (no UPDATE/DELETE) — mirrors AuditLog. confirmedAt is immutable once written.
model TimesheetSignature {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @db.Uuid
  employeeId     String   @db.Uuid
  year           Int
  month          Int
  confirmedAt    DateTime @default(now()) @db.Timestamptz(6)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  employee     Employee     @relation(fields: [employeeId], references: [id])

  @@unique([organizationId, employeeId, year, month])
  @@index([organizationId])
  @@index([organizationId, year, month])
  @@map("timesheet_signatures")
}
```

Relation back-references to add:
- `Organization`: `timesheetSignatures TimesheetSignature[]`
- `Employee`: `timesheetSignatures TimesheetSignature[]`

Notes: `year`/`month` stored as plain `Int` (matches `ShiftSchedule.year/month`). No `confirmedBy` column — the acting user is captured in the paired `AuditLog.actorUserId`. `month` is validated 1–12 in the Zod layer (DB stays permissive, like `ShiftSchedule`).

### Migration

- Migration name: `add_timesheet_signatures`
- Generated by `prisma migrate dev --name add_timesheet_signatures` (creates `timesheet_signatures` table).
- **RLS + privileges**: add to `backend/prisma/rls/001_rls_policies.sql` (idempotent, re-runnable), mirroring the `audit_logs` block exactly:
  ```sql
  -- Timesheet signatures: append-only — INSERT + SELECT only, no UPDATE/DELETE ever.
  GRANT SELECT, INSERT ON timesheet_signatures TO tempora_app;

  ALTER TABLE timesheet_signatures ENABLE ROW LEVEL SECURITY;
  ALTER TABLE timesheet_signatures FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON timesheet_signatures;
  CREATE POLICY tenant_isolation ON timesheet_signatures
    USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
    WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
  ```

## 3. Backend Module Structure

New module `backend/src/modules/timesheet-signature/`:

| File | Responsibility |
|------|----------------|
| `timesheet-signature.service.ts` | `confirmMonth`, `getMonthlySummary`, `listConfirmationStatus`, and the exported guard `assertMonthNotConfirmed`. Auth-agnostic; receives `orgId`, `actorId`, `db`. In-transaction audit write on confirm. |
| `timesheet-signature.controller.ts` | Thin handlers; resolve `employeeId`/role via `getUser()`, self-scope EMPLOYEE, call service, shape JSON `{ data }`. |
| `timesheet-signature.router.ts` | Express routes + `requireRole` guards (see §4). |
| `timesheet-signature.service.test.ts` | Service-layer tests (see §8). |
| `timesheet-signature.controller.test.ts` | HTTP-level tests (idempotency, 409 lock, role scoping). |

Service skeleton (signatures only):

```ts
// Guard reused by time-tracking (ADR-2). Throws 409 MONTH_LOCKED if confirmed.
export async function assertMonthNotConfirmed(
  employeeId: string, date: Date, orgId: string, db: TenantClient,
): Promise<void>;

export async function confirmMonth(
  employeeId: string, year: number, month: number,
  actorId: string, orgId: string, db: TenantClient,
): Promise<{ signature: TimesheetSignature; created: boolean }>;

export async function getMonthlySummary(
  employeeId: string, year: number, month: number, orgId: string, db: TenantClient,
): Promise<{ hours: MonthlyHoursRow | null; confirmed: boolean; confirmedAt: string | null; hasOpenEntry: boolean }>;

export async function listConfirmationStatus(
  year: number, month: number, centerId: string | undefined, db: TenantClient,
): Promise<{ employeeId: string; firstName: string; lastName: string; confirmed: boolean; confirmedAt: string | null }[]>;
```

`confirmMonth` flow: (1) `assertNoOpenEntry` (ADR-5) → (2) `findUnique` on unique key; if found return `{ signature, created: false }` → (3) `db.timesheetSignature.create` → (4) `auditWriter.write(db, actorId, orgId, { action: 'APPROVE', entityType: 'TimesheetSignature', entityId, after: { employeeId, year, month, confirmedAt } })` → return `{ signature, created: true }`. On `P2002` (race), re-read and return `created: false`.

Registration in `backend/src/app.ts` (where other routers mount): `app.use('/timesheet-signatures', authenticate, tenantContext, timesheetSignatureRouter)`. No event-bus wiring needed (no SSE for this feature per scope).

## 4. API Endpoints

All under `/timesheet-signatures`. `authenticate` + `tenantContext` applied at mount. Responses follow the `{ data: ... }` convention.

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| GET | `/timesheet-signatures/summary?year=&month=&employeeId=` | All roles; EMPLOYEE forced to own `employeeId` | query: `year`, `month`, optional `employeeId` (admin/manager) | `200 { data: { year, month, employeeId, hours: { regularHours, overtimeHours, partTimeDeviation } \| null, confirmed, confirmedAt, hasOpenEntry } }` |
| POST | `/timesheet-signatures/confirm` | All roles; EMPLOYEE confirms own month only | body: `{ year, month }` | `201 { data: signature }` on create; `200 { data: signature }` if already confirmed (ADR-4); `422 OPEN_ENTRY_IN_MONTH` (ADR-5) |
| GET | `/timesheet-signatures/status?year=&month=&centerId=` | `requireRole(['ADMIN','MANAGER'])`; MANAGER scoped to own center | query: `year`, `month`, optional `centerId` | `200 { data: [{ employeeId, firstName, lastName, confirmed, confirmedAt }] }` |

Route ordering: static paths (`/summary`, `/confirm`, `/status`) only — no `/:id` route, so no ordering hazard.

Controller scoping (mirrors `absences.controller`/`time.controller`): EMPLOYEE always operates on `user.employeeId` (fail-closed to `'__none__'` if absent); ADMIN/MANAGER may pass `employeeId`. MANAGER `/status` center scoping resolved in controller from the manager's own record (same approach as `reporting` AC-REP-2).

## 5. Lock Guard — exact injection points

The guard `assertMonthNotConfirmed(employeeId, date, orgId, db)` (exported from `timesheet-signature.service.ts`) is called inside `backend/src/modules/time-tracking/time.service.ts` at the START of each mutating function, BEFORE any write:

1. **`clockIn`** — after the existing OPEN-entry check, before `db.timeEntry.create`. Month derived from `new Date()` (server now). A confirmed *current* month blocks new clock-ins.
2. **`clockOut`** — after the OPEN-entry lookup (`openEntry`), before the OPEN→CLOSED update. Month derived from `openEntry.clockIn` (the entry being closed). Edge case: this means an employee cannot confirm a month with an OPEN entry (prevented by ADR-5), so clock-out is never deadlocked.
3. **`createCorrection`** — after the `timeEntry` existence lookup, before `db.timeCorrection.create`. Month derived from the target `entry.clockIn`. This blocks *self* corrections on a confirmed month.

Implementation of the guard:
```ts
export async function assertMonthNotConfirmed(employeeId, date, orgId, db) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const sig = await db.timesheetSignature.findUnique({
    where: { organizationId_employeeId_year_month: { organizationId: orgId, employeeId, year, month } },
  });
  if (sig) throw new ApiError(409, 'MONTH_LOCKED', `Month ${year}-${month} is confirmed and locked for this employee`);
}
```

`time.service.ts` imports the guard from the new module (one-directional dependency: `time-tracking` → `timesheet-signature`; the signature module depends on `reporting` for the summary, no cycle with time-tracking). NOT injected as middleware (ADR-2). Manager approval paths (`approveCorrection`/`rejectCorrection`) are intentionally NOT guarded (ADR-3).

Date convention: the guard uses UTC month extraction to match how `reporting` and exports slice `clockIn` (`toISOString().slice(...)`). The summary/status SQL must use the same UTC basis (`EXTRACT` on the stored timestamptz) so "confirmed month" and "hours in month" agree.

## 6. Frontend Structure

New feature folder `frontend/src/app/features/timesheet/` (lazy-loaded route), following the absences feature layout:

```
features/timesheet/
  data-access/
    timesheet.api.ts          # HttpClient calls: getSummary, confirm, getStatus
    timesheet.store.ts        # SignalStore (providedIn: 'root')
  feature/
    timesheet-review.component.ts   # employee: monthly summary + Confirm button + locked banner
    timesheet-status.component.ts   # manager/admin: confirmed-vs-pending table (PrimeNG p-table)
  ui/
    confirmation-badge.component.ts # presentational: confirmed/pending pill
```

SignalStore shape (`timesheet.store.ts`):
```ts
type TimesheetState = {
  summary: MonthlySummaryDto | null;   // { hours, confirmed, confirmedAt, hasOpenEntry }
  status: ConfirmationStatusRow[];     // manager view
  selectedYear: number;
  selectedMonth: number;
  loading: boolean;
  error: string | null;
};
```
Computed: `isConfirmed = summary()?.confirmed ?? false`, `canConfirm = !isConfirmed() && !summary()?.hasOpenEntry`.
Methods: `loadSummary(year, month, employeeId?)`, `confirm(year, month)` (on success patch `summary.confirmed = true`), `loadStatus(year, month, centerId?)`. Follows the existing async/`firstValueFrom`/try-catch + explicit exported interface pattern from `absences.store.ts` (TS 5.9 workaround).

Component rules (per frontend CLAUDE.md): standalone, `ChangeDetectionStrategy.OnPush`, `inject()`, native control flow, signals, reactive forms for the month selector, AXE/WCAG-AA. The locked banner uses an `@if (isConfirmed())` block with an accessible status message; the Confirm button is disabled (with reason) when `hasOpenEntry`.

Route guard: `timesheet-status` route protected by an existing role guard for ADMIN/MANAGER; `timesheet-review` for all authenticated roles.

## 7. Shared Schemas (`packages/shared`)

New file `packages/shared/src/schemas/timesheet-signature.schema.ts`:

```ts
export const ConfirmTimesheetSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const TimesheetSummaryQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const ConfirmationStatusQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  centerId: z.string().uuid().optional(),
});

export const TimesheetSignatureResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int(),
  confirmedAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
});

export const TimesheetSummaryResponseSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  employeeId: z.string().uuid(),
  hours: z.object({
    regularHours: z.number(),
    overtimeHours: z.number(),
    partTimeDeviation: z.number(),
  }).nullable(),
  confirmed: z.boolean(),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
  hasOpenEntry: z.boolean(),
});

export const ConfirmationStatusRowSchema = z.object({
  employeeId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  confirmed: z.boolean(),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
});
```

Export from `packages/shared/src/schemas/index.ts`. No enum additions strictly required (reuses existing `AuditAction.APPROVE`); if a notification/event type is added later it would go in `constants/enums.ts`, but it is out of scope here. Rebuild `packages/shared/dist` after edits (the dist artifacts are committed in this repo).

## 8. Testing Strategy

**Backend service (`timesheet-signature.service.test.ts`)** — primary safety net:
- `confirmMonth` creates a row with server `confirmedAt` and one `AuditLog` (`APPROVE`, `TimesheetSignature`).
- Re-confirm returns existing row, `created: false`, NO second audit row (ADR-4).
- `confirmMonth` rejects with 422 `OPEN_ENTRY_IN_MONTH` when an OPEN entry exists in the month (ADR-5).
- Unique-constraint race: simulate `P2002` → returns existing row, no throw.
- `getMonthlySummary` returns hours + `confirmed`/`confirmedAt`/`hasOpenEntry` correctly for confirmed and unconfirmed months.
- `listConfirmationStatus` returns all employees with confirmed flag; MANAGER center scoping filters correctly.
- `assertMonthNotConfirmed` throws 409 `MONTH_LOCKED` for a confirmed month, passes for an unconfirmed one (UTC boundary cases: last day of month, first day).

**Lock integration in `time.service.test.ts`** (extend existing) — proves the guard is wired on every path (proposal's top risk):
- `clockIn` on a confirmed current month → 409 MONTH_LOCKED.
- `clockOut` whose OPEN entry's `clockIn` is in a confirmed month → 409 (note: only reachable via ADR-5 edge; assert the message).
- `createCorrection` on an entry in a confirmed month → 409.
- Manager `approveCorrection`/`rejectCorrection` on a confirmed month → NOT blocked (ADR-3 regression guard).

**Controller tests (`timesheet-signature.controller.test.ts`)**:
- POST `/confirm` returns 201 on first confirm, 200 on re-confirm.
- EMPLOYEE cannot confirm another employee's month (employeeId forced to own).
- GET `/status` returns 403 for EMPLOYEE; 200 scoped for MANAGER.

**Frontend (store unit tests)**: `confirm()` flips `isConfirmed`; `canConfirm` false when `hasOpenEntry`; error path sets `error` and keeps `confirmed` unchanged.

**Regression**: run the full backend suite (245 + new) before merge — schema change is additive, RLS block is idempotent, so existing tests must stay green.
