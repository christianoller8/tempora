# Design: Absence Management

Architecture-level HOW for the absence-management change. Gap-closing on an
existing module; no rebuild. Contract-first (shared enums/schemas), then
backend service threading, then frontend DTO/store/UI, then cuadrante overlay.

---

## 1. Architecture Approach

- **Pattern**: layered, contract-first. The source of truth for absence types
  and the response shape is `@tempora/shared`. The Prisma DB enum and the
  frontend DTO are downstream mirrors that MUST stay in sync.
- **Boundaries unchanged**: GDPR invariants (`causeEncrypted` never listed,
  READ-audited on single-get) are NOT touched. `decisionComment` is a NEW,
  SEPARATE plaintext channel — never encrypted, never in AuditLog body diffs.
- **Additive-only migration**: extend the existing `AbsenceType` DB enum and add
  a nullable column. No row mutation, clean rollback.
- **Presentational grid stays dumb**: `CuadranteGridComponent` receives a new
  `absences` input and renders from it. No new data fetching in the grid; the
  smart `CuadranteComponent` owns the fetch.

### Critical discovery (load-bearing)

`AbsenceType` in `prisma/schema.prisma` (lines 67-74) is a **DB-level PostgreSQL
enum**, NOT a string column. Therefore adding types REQUIRES an `ALTER TYPE ...
ADD VALUE` migration — updating the Zod enum alone is insufficient. A POST with a
new type would otherwise fail at the DB write with a Postgres enum error even
though Zod validation passes.

Second discovery: the router (`absences.router.ts`) does NOT wire any Zod
body-validation middleware into the approve/reject routes. `ApproveAbsenceSchema`
exists in shared but is unused at the route layer. Adding `comment` to the body
is therefore purely additive at the controller — no middleware change required.
The existing `ApproveAbsenceSchema` (which only has `absenceId`) is stale and
should be corrected for contract hygiene, but it is not on the request path.

Third discovery: `AuthUser.employeeId` is OPTIONAL (`types/auth.ts`). The
self-scoping guard MUST handle an EMPLOYEE whose token has no `employeeId` by
forcing a filter that returns zero rows (fail-closed), never an unfiltered list.

---

## 2. File Layout

### Backend / shared

| File | Action | Change |
|------|--------|--------|
| `packages/shared/src/constants/enums.ts` | Modify | Append 3 values to `ABSENCE_TYPE_VALUES` |
| `packages/shared/src/schemas/absence.schema.ts` | Modify | `DecisionSchema` (comment), `decisionComment` on response |
| `backend/prisma/schema.prisma` | Modify | Add enum values + `decisionComment String?` |
| `backend/prisma/migrations/<ts>_add_absence_comment_types/migration.sql` | Create | `ALTER TYPE` x3 + `ADD COLUMN` |
| `backend/src/modules/absences/absences.service.ts` | Modify | `comment?` on approve/reject; EMPLOYEE list scoping param |
| `backend/src/modules/absences/absences.controller.ts` | Modify | Read `comment` from body; self-scope list/get/create |
| `backend/src/modules/absences/absences.router.ts` | No change | Optional: wire corrected schema (out of scope unless trivial) |

### Frontend

| File | Action | Change |
|------|--------|--------|
| `frontend/.../absences/data-access/absences.api.ts` | Modify | DTO `type` widened, `decisionComment`, approve/reject `comment` arg |
| `frontend/.../absences/data-access/absences.store.ts` | Modify | `approveAbsence(id, comment?)`, `rejectAbsence(id, comment?)` |
| `frontend/.../absences/feature/absence-request.component.ts` | Modify | 9-type label map, comment textarea in decision flow, comment in history |
| `frontend/.../shifts/ui/cuadrante-grid.component.ts` | Modify | New `absences` input, `absenceMap`, absence chip render, click guard |
| `frontend/.../shifts/feature/cuadrante.component.ts` | Modify | Fetch APPROVED absences in `loadAll()`, pass to grid |

---

## 3. Database Migration

Path: `backend/prisma/migrations/<timestamp>_add_absence_comment_types/migration.sql`

```sql
-- Additive enum extension (DB-level Prisma enum "AbsenceType").
-- Postgres requires ADD VALUE outside a transaction in older versions; Prisma
-- migrate runs these idempotently. IF NOT EXISTS guards re-runs.
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'ASUNTOS_PROPIOS';
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'PERMISO_NO_RETRIBUIDO';
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'MATERNIDAD_PATERNIDAD';

-- Additive nullable column. No existing rows modified.
ALTER TABLE "absences" ADD COLUMN IF NOT EXISTS "decisionComment" TEXT;
```

Notes:
- Enum `ADD VALUE` and `ADD COLUMN` are non-destructive. Rollback drops the
  column; unused enum values are inert.
- Postgres pre-12 forbids `ADD VALUE` inside a transaction block. If the project
  Postgres < 12 or Prisma wraps the migration, split the three `ALTER TYPE`
  statements into their own migration file ahead of the column add. Verify the
  Postgres version at apply time; default assumption is >= 12 (transaction-safe).
- The Prisma `schema.prisma` enum block and the `decisionComment String?` field
  MUST be updated to match so `prisma generate` produces the new client types.

---

## 4. Shared Schema Changes (exact)

`enums.ts` — `ABSENCE_TYPE_VALUES`:

```ts
export const ABSENCE_TYPE_VALUES = [
  'VACACIONES',
  'IT',
  'PERMISO_RETRIBUIDO',
  'AUSENCIA_INJUSTIFICADA',
  'LACTANCIA',
  'REDUCCION_JORNADA',
  'ASUNTOS_PROPIOS',          // NEW
  'PERMISO_NO_RETRIBUIDO',    // NEW
  'MATERNIDAD_PATERNIDAD',    // NEW
] as const;
```

`absence.schema.ts`:

```ts
// Replace stale ApproveAbsenceSchema (which only had absenceId and is unused on
// the route path) with a body schema for the decision endpoints.
export const DecisionAbsenceSchema = z.object({
  comment: z.string().max(500).optional(),
});

// AbsenceResponseSchema — add:
  decisionComment: z.string().nullable(),
```

Keep `ApproveAbsenceSchema` exported as an alias of `DecisionAbsenceSchema` if any
importer references it, to avoid breaking imports; otherwise rename. Grep before
deleting.

---

## 5. Backend Service Design

### `listAbsences(filter, db)` — scoping moved to controller

Decision: enforce self-scoping in the **controller** (`handleListAbsences`),
NOT inside `listAbsences`, because the service has no access to the auth user and
is also called internally (e.g. balance). The controller overrides `employeeId`:

```ts
// handleListAbsences
const user = getUser();
let employeeId = q.employeeId;
if (user.role === 'EMPLOYEE') {
  // Fail-closed: an EMPLOYEE with no linked employeeId sees nothing.
  employeeId = user.employeeId ?? '__none__';
}
const absences = await listAbsences({ employeeId, status, type }, db);
```

`'__none__'` is a sentinel that matches no UUID, guaranteeing an empty result
when the token lacks `employeeId`. (Alternative: short-circuit `res.json({ data: [] })`.
The sentinel keeps a single code path; either is acceptable — pick one in tasks.)

`handleGetAbsence`: after fetch, if `user.role === 'EMPLOYEE'` and the record's
`employeeId !== user.employeeId`, throw `ApiError(404, 'NOT_FOUND', ...)` (404 not
403 to avoid leaking existence). The GDPR READ audit already fired inside the
service for `cause`; for a cross-employee block we must guard BEFORE calling
`getAbsence` to avoid auditing a read the employee is not allowed to perform.
Decision: in `handleGetAbsence`, do a lightweight ownership pre-check for EMPLOYEE
role is not possible without a read; simplest correct path is to let the service
take an optional `requesterEmployeeId` and throw 404 before any decrypt/audit.
Recommended: add `requesterEmployeeId?: string` param to `getAbsence`; when set
and mismatched, throw 404 BEFORE the audit/decrypt block.

`handleCreateAbsence`: already defaults `employeeId` to `user.employeeId`. Harden:
when `user.role === 'EMPLOYEE'`, ALWAYS override to `user.employeeId` and ignore
any `body.employeeId` (prevents an employee creating absences for others).

### `approveAbsence(id, approverId, orgId, db, comment?)`

```ts
const approved = await db.absence.update({
  where: { id },
  data: { status: 'APPROVED', approverId, decidedAt, decisionComment: comment ?? null },
});
```

Audit `after` MAY include `hasComment: comment != null` but MUST NOT include the
comment text verbatim if comments could carry operational PII — keep parity with
the existing pattern (audit records status/approver only). Decision: audit
unchanged; `decisionComment` is operational, not audited.

### `rejectAbsence(id, rejecterId, orgId, db, comment?)`

Identical pattern: `data: { status: 'REJECTED', approverId: rejecterId, decidedAt, decisionComment: comment ?? null }`.

### Controller wiring

```ts
// handleApproveAbsence / handleRejectAbsence
const body = req.body as { comment?: string };
const absence = await approveAbsence(id, user.userId, user.organizationId, db, body.comment);
```

---

## 6. Cuadrante Grid Design (presentational)

New input on `CuadranteGridComponent`:

```ts
import type { AbsenceDto } from '../../absences/data-access/absences.api';
readonly absences = input<AbsenceDto[]>([]); // APPROVED only, caller-filtered
```

New `absenceMap` computed, parallel to the existing `cellMap`, keyed
`employeeId:dateStr`. Because absences span a date range, expand each absence to
its covered days within the displayed month:

```ts
readonly absenceMap = computed(() => {
  const map = new Map<string, { label: string; bg: string; text: string; border: string; typeLabel: string }>();
  const y = this.year(), m = this.month();
  for (const a of this.absences()) {
    if (a.status !== 'APPROVED') continue;
    const cfg = ABSENCE_CONFIG[a.type] ?? ABSENCE_FALLBACK;
    // iterate each day from startDate..endDate, clamp to displayed month
    let cur = new Date(a.startDate);
    const end = new Date(a.endDate);
    for (; cur <= end; cur.setDate(cur.getDate() + 1)) {
      if (cur.getFullYear() !== y || cur.getMonth() + 1 !== m) continue;
      const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      map.set(`${a.employeeId}:${dateStr}`, cfg);
    }
  }
  return map;
});

getAbsence(employeeId: string, dateStr: string) {
  return this.absenceMap().get(`${employeeId}:${dateStr}`) ?? null;
}
```

Color mapping — distinct from shift colors (which use blues/oranges/purples).
Absences use a muted amber family per spec, with abbreviated labels per FR-ABS-29:

```ts
const ABSENCE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; typeLabel: string }> = {
  VACACIONES:             { label: 'VAC',  ... amber },
  IT:                     { label: 'BAJA', ... amber },
  PERMISO_RETRIBUIDO:     { label: 'PR',   ... amber },
  AUSENCIA_INJUSTIFICADA: { label: 'AI',   ... amber },
  LACTANCIA:              { label: 'LAC',  ... amber },
  REDUCCION_JORNADA:      { label: 'RJ',   ... amber },
  ASUNTOS_PROPIOS:        { label: 'AP',   ... amber },
  PERMISO_NO_RETRIBUIDO:  { label: 'PNR',  ... amber },
  MATERNIDAD_PATERNIDAD:  { label: 'MP',   ... amber },
};
// Amber family: bg rgba(245,158,11,0.20), text #fcd34d, border rgba(245,158,11,0.5)
```

Template — render absence chip with PRECEDENCE over shift/empty, and disable
interaction. The absence takes the cell visually; clicking it must NOT open the
dialog regardless of `editable()`:

```html
@let abs = getAbsence(emp.id, d.dateStr);
@let cell = getCell(emp.id, d.dateStr);
<td
  class="td-day"
  [class.is-weekend]="d.isWeekend"
  [class.is-today]="d.isToday"
  [class.editable]="editable() && !abs"
  (click)="editable() && !abs && onCellClick(emp.id, d.dateStr, cell?.assignment ?? null)"
  (keydown.enter)="editable() && !abs && onCellClick(...)"
  (keydown.space)="editable() && !abs && onCellClick(...)"
  [attr.tabindex]="editable() && !abs ? 0 : -1"
  ...>
  @if (abs) {
    <div class="absence-chip"
      [style.background]="abs.bg" [style.color]="abs.text" [style.border-color]="abs.border"
      [attr.aria-label]="abs.typeLabel" [title]="abs.typeLabel">{{ abs.label }}</div>
  } @else if (cell) {
    <div class="shift-chip" ...>{{ cell.label }}</div>
  } @else {
    <div class="cell-empty">+</div>
  }
</td>
```

Decision: absence **replaces** the cell rather than overlaying, keeping the
single-cell model simple. The spec calls coverage conflicts "visible"; with
absence taking precedence over shift, a manager seeing an absence chip on a day
where a shift would be assigned is the conflict signal. A true overlay (badge
corner) is deferred (out of scope) to keep the diff small.

`.absence-chip` CSS mirrors `.shift-chip` dimensions but `cursor: default` and no
hover scale, satisfying FR-ABS-30 (non-interactive).

---

## 7. Cuadrante Component Changes (smart)

- Inject `AbsencesApi` (`inject(AbsencesApi)`).
- Add `readonly absences = signal<AbsenceDto[]>([])`.
- In `loadAll()`, add the fetch to the existing `Promise.all` (or a follow-up
  call after schedule load). Month bounds:

```ts
const y = this.selectedYear(), m = this.selectedMonth();
const from = `${y}-${String(m).padStart(2,'0')}-01`;
const to   = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`;
const abs = await firstValueFrom(this.absencesApi.listAbsences({ status: 'APPROVED', from, to }));
this.absences.set(abs);
```

NOTE: current `AbsencesApi.listAbsences` params accept `{ employeeId, status, type }`
only — no `from`/`to`. Backend `ListAbsencesFilter` also lacks date range. Two
options:
- (a) Add `from`/`to` to API params + backend filter (preferred; trims payload).
- (b) Fetch all APPROVED and filter client-side in `absenceMap` (already clamps
  to month). Cheaper to implement, slightly larger payload.

Decision: go with (b) for the minimal diff — `absenceMap` already clamps to the
displayed month, so fetching `{ status: 'APPROVED' }` and letting the grid filter
is correct and avoids backend filter changes. Revisit (a) if payload grows.

- Bind in template: `[absences]="absences()"` on `<app-cuadrante-grid>`.

---

## 8. AbsenceDto Update (frontend)

```ts
import type { AbsenceType } from '@tempora/shared'; // or inline union of 9 values

export interface AbsenceDto {
  id: string;
  employeeId: string;
  type: AbsenceType;            // widened from 6 to 9 values
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  cause?: string;
  decisionComment: string | null; // NEW
}
```

API methods:

```ts
approveAbsence(id: string, comment?: string): Observable<AbsenceDto> {
  return this.api.post<{ data: AbsenceDto }>(`/absences/${id}/approve`,
    comment ? { comment } : {}).pipe(map(r => r.data));
}
rejectAbsence(id: string, comment?: string): Observable<AbsenceDto> { /* same */ }
```

Store methods gain optional `comment` and forward it. The exported
`AbsencesStore` interface type updates to `approveAbsence(id, comment?)` /
`rejectAbsence(id, comment?)`.

UI (`absence-request.component.ts`):
- Extend `ABSENCE_TYPE_LABELS` to all 9 types; `AbsenceType` local union widens.
- Add a `decisionComment` textarea in the pending-approval row flow (per
  FR-ABS-26 a textarea must be present in the decision UI). Simplest: a small
  inline textarea or a confirm dialog capturing the comment before
  `approve(id, comment)` / `reject(id, comment)`.
- Render `abs.decisionComment` in history rows when present (employee + all lists).

---

## 9. ADR-style Decisions

| ID | Decision | Rationale | Rejected alternative |
|----|----------|-----------|----------------------|
| D1 | Extend DB enum via `ALTER TYPE ADD VALUE` | `AbsenceType` is a real Postgres enum; Zod-only change would 500 on write | String column migration (destructive, larger blast radius) |
| D2 | Self-scoping in controller, not service | Service is auth-agnostic and reused by balance; controller owns the user | Pass user into service (leaks auth into domain layer) |
| D3 | Fail-closed sentinel for EMPLOYEE without employeeId | `employeeId` is optional on `AuthUser`; never return unfiltered | Default to userId (wrong id space, could leak) |
| D4 | `decisionComment` plaintext, not audited, not encrypted | Operational note, not special-category data; keeps GDPR `cause` path isolated | Encrypt like cause (overkill, conflates channels) |
| D5 | Absence replaces grid cell + precedence over shift | Single-cell model stays simple; chip is the conflict signal | Corner-badge overlay (more CSS/markup, deferred) |
| D6 | Fetch all APPROVED, clamp client-side in grid | `absenceMap` already clamps to month; no backend filter change | Add from/to to API + backend filter (more surface now) |
| D7 | get-by-id ownership guard before audit/decrypt | Avoid GDPR READ audit for a read the employee may not perform; 404 not 403 | Guard after fetch (would audit an unauthorized read) |

---

## 10. Review Workload Forecast

Estimated changed lines (net additions, excluding tests):

| Area | ~Lines |
|------|--------|
| shared enums + schema | 12 |
| prisma schema + migration | 12 |
| backend service (approve/reject/get params) | 25 |
| backend controller (scoping + comment) | 30 |
| frontend api + store + DTO | 35 |
| absence-request UI (labels + comment textarea + history) | 60 |
| cuadrante-grid (input + map + config + template + CSS) | 70 |
| cuadrante component (fetch + bind) | 20 |
| **Subtotal (impl)** | **~264** |

Tests (Strict TDD) add an estimated 150-220 lines across backend (enum accept,
approve/reject comment, self-scoping 403/empty, get-by-id 404) and frontend
(grid absence rendering, click guard, label map).

**Total estimate: ~420-480 lines including tests.**

`400-line budget risk: Medium-High` (impl alone is under 400; tests push it over).
`Chained PRs recommended: Optional` — a clean split is **PR1 = shared + backend +
migration** (contract + server), **PR2 = frontend (store/UI/cuadrante)**. PR2
depends on PR1's shared build. If single-PR is required, flag `size:exception`.
`Decision needed before apply: Yes` if delivery strategy is ask-on-risk.

---

## 11. Risks / Open Items

- Postgres version for `ALTER TYPE ADD VALUE` transaction safety (verify at apply; split migration if < 12).
- `@tempora/shared` must be rebuilt before backend + frontend typecheck (existing dependency, noted in proposal).
- Confirm no importer of stale `ApproveAbsenceSchema` before renaming (grep at apply time).
- FR-ABS-32 (role-appropriate UI / orphaned `absence-approval.component.ts`) is
  partially addressed by the existing `absence-request.component.ts` which already
  branches on role; full consolidation/removal of the orphan is a tasks-phase
  decision (wire-in vs delete).
