# Tasks: Absence Management

Generated from spec + design artifacts.
Delivery strategy: ask-on-risk → 2 chained PRs (see Review Workload Forecast).

---

## Slice 1 — Shared + Backend + Migration (PR #1)

Tasks T01–T07. These are fully independent of any frontend change and can be reviewed/merged first.
The shared package rebuild must land before Slice 2 frontend typechecks succeed.

---

### [x] T01 — Extend `ABSENCE_TYPE_VALUES` in shared enums

**File:** `packages/shared/src/constants/enums.ts`

**Change:** Append three new values to `ABSENCE_TYPE_VALUES` as const:
- `'ASUNTOS_PROPIOS'`
- `'PERMISO_NO_RETRIBUIDO'`
- `'MATERNIDAD_PATERNIDAD'`

**Acceptance criteria:**
- FR-ABS-20: `ABSENCE_TYPE_VALUES` contains all nine values
- The type `AbsenceType` derived from this tuple (via `typeof … [number]`) widens automatically
- No existing enum consumers break (6-value subsets are still structurally valid)

**Estimated lines:** ~4
**Dependencies:** none
**Parallelism:** START HERE — unblocks T02, T03, T05, T06

---

### [x] T02 — Update shared absence schemas

**File:** `packages/shared/src/schemas/absence.schema.ts`

**Changes:**
1. Add `DecisionAbsenceSchema`: `z.object({ comment: z.string().max(500).optional() })`
2. Keep `ApproveAbsenceSchema` exported — grep for importers first; if none outside shared, alias it to `DecisionAbsenceSchema`; otherwise keep both
3. Add `decisionComment: z.string().nullable()` to `AbsenceResponseSchema`
4. `CreateAbsenceSchema` and `UpdateAbsenceSchema` pick up the new types automatically via the widened `AbsenceType` enum from T01

**Acceptance criteria:**
- FR-ABS-21: `CreateAbsenceSchema` accepts `MATERNIDAD_PATERNIDAD` without error
- FR-ABS-21: `CreateAbsenceSchema` rejects `UNKNOWN_TYPE` with a Zod validation error
- FR-ABS-25: `AbsenceResponseSchema` includes `decisionComment: z.string().nullable()`
- FR-ABS-24: `DecisionAbsenceSchema` accepts an empty body and `{ comment: "text" }`

**Estimated lines:** ~10
**Dependencies:** T01 (enum must be widened first)
**Parallelism:** Sequential after T01; can run in parallel with T03

---

### [x] T03 — Create Prisma migration SQL

**Files:**
- `backend/prisma/schema.prisma` — add 3 enum values to `AbsenceType` block + `decisionComment String?` field on `Absence` model
- `backend/prisma/migrations/<timestamp>_add_absence_comment_types/migration.sql` — create new migration file

**Migration SQL (exact):**
```sql
-- Extend DB-level Postgres enum (non-transactional in PG < 12; IF NOT EXISTS guards re-runs)
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'ASUNTOS_PROPIOS';
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'PERMISO_NO_RETRIBUIDO';
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'MATERNIDAD_PATERNIDAD';

-- Additive nullable column; no existing rows modified
ALTER TABLE "absences" ADD COLUMN IF NOT EXISTS "decisionComment" TEXT;
```

**schema.prisma changes:**
- Add `ASUNTOS_PROPIOS`, `PERMISO_NO_RETRIBUIDO`, `MATERNIDAD_PATERNIDAD` to the `enum AbsenceType` block
- Add `decisionComment String?` to the `model Absence` block

**Acceptance criteria:**
- FR-ABS-20: Prisma enum block contains all 9 types (so `prisma generate` produces the widened client)
- FR-ABS-23: `decisionComment` column is nullable, additive; zero existing rows are modified
- Migration file name follows existing project timestamp convention

**Estimated lines:** ~12 (schema: 5, migration SQL: 7)
**Dependencies:** T01 (enum values must exist in enums.ts before schema aligns)
**Parallelism:** Can run in parallel with T02

---

### [x] T04 — Apply Prisma migration

**Action:** Run `prisma migrate dev` (or `prisma db push` per project convention) against the dev DB.

**Pre-flight check:** Confirm Postgres version ≥ 12 before running; if < 12, split the three `ALTER TYPE` statements into a separate migration file (run outside a transaction block) ahead of the column add.

**Acceptance criteria:**
- FR-ABS-23: `decision_comment` column exists in `absences` table and is nullable
- FR-ABS-20: Postgres enum `AbsenceType` contains all 9 values
- `prisma generate` completes without error; generated client includes new types + field
- All existing 187 tests still pass after client regeneration

**Estimated lines:** 0 (command execution, no new code)
**Dependencies:** T03 must be committed; DB must be accessible
**Parallelism:** Sequential after T03

---

### [x] T05 — Update `absences.service.ts`

**File:** `backend/src/modules/absences/absences.service.ts`

**Changes:**
1. `approveAbsence(id, approverId, orgId, db, comment?)` — add optional `comment?: string` param; pass `decisionComment: comment ?? null` in the Prisma `update` data
2. `rejectAbsence(id, rejecterId, orgId, db, comment?)` — same pattern: `data: { status: 'REJECTED', approverId: rejecterId, decidedAt, decisionComment: comment ?? null }`
3. `getAbsence(id, db, requesterEmployeeId?)` — add optional `requesterEmployeeId?: string`; when set, after fetching the record (before the GDPR audit/decrypt block), if `record.employeeId !== requesterEmployeeId` throw `ApiError(404, 'NOT_FOUND', 'Absence not found')`. This satisfies D7 (guard before audit).

**Acceptance criteria:**
- FR-ABS-24: Approve/reject with `comment` persists `decisionComment`; without comment stores `null`
- FR-ABS-28: (Handled in controller via role guard, but service must not obstruct)
- No audit log entry includes the `decisionComment` text verbatim (existing audit call unchanged)

**Estimated lines:** ~25
**Dependencies:** T03 + T04 (Prisma client must know about `decisionComment`)
**Parallelism:** Sequential after T04; can run in parallel with T06 after T04

---

### [x] T06 — Update `absences.controller.ts`

**File:** `backend/src/modules/absences/absences.controller.ts`

**Changes:**

1. **`handleListAbsences`** — employee self-scoping:
   ```ts
   const user = getUser();
   let employeeId = q.employeeId;
   if (user.role === 'EMPLOYEE') {
     employeeId = user.employeeId ?? '__none__'; // fail-closed sentinel
   }
   ```

2. **`handleGetAbsence`** — ownership guard for EMPLOYEE role:
   Pass `requesterEmployeeId` to service when `user.role === 'EMPLOYEE'`:
   ```ts
   const requesterEmployeeId = user.role === 'EMPLOYEE' ? (user.employeeId ?? '__none__') : undefined;
   const absence = await getAbsence(id, db, requesterEmployeeId);
   ```

3. **`handleCreateAbsence`** — harden employeeId override:
   When `user.role === 'EMPLOYEE'`, always override `body.employeeId` with `user.employeeId` to prevent cross-employee creation.

4. **`handleApproveAbsence` / `handleRejectAbsence`** — extract comment from body:
   ```ts
   const body = req.body as { comment?: string };
   const absence = await approveAbsence(id, user.userId, user.organizationId, db, body.comment);
   ```

**Acceptance criteria:**
- FR-ABS-27: EMPLOYEE GET /absences returns only own records; empty list if no `employeeId` on token
- FR-ABS-27: ADMIN GET /absences returns all records (no scoping applied)
- FR-ABS-28: Approve/reject routes already gated by `requireRole(['ADMIN','MANAGER'])`; verify guard is in place
- FR-ABS-24: `comment` extracted from body and forwarded to service
- FR-ABS-23: EMPLOYEE cannot create absence for another employee

**Estimated lines:** ~30
**Dependencies:** T05 (service signatures must exist)
**Parallelism:** Sequential after T05

---

### [x] T07 — Backend typecheck + regression tests

**Actions:**
1. Run TypeScript compiler on backend + shared packages; zero errors
2. Run full test suite: all 187 existing tests must pass
3. Write new backend tests (Strict TDD) covering:
   - Enum accept: POST /absences with each new type → 201
   - Approve with comment → `decisionComment` persisted
   - Approve without comment → `decisionComment` is null
   - Reject with comment → `decisionComment` persisted
   - Employee GET /absences → returns only own records
   - Employee GET /absences with no employeeId on token → returns empty array
   - ADMIN GET /absences → returns all records
   - Employee GET /absences/:id for another employee's absence → 404
   - EMPLOYEE POST /absences/:id/approve → 403

**Acceptance criteria:**
- All 187 pre-existing tests pass
- New tests cover all AC scenarios above
- TypeScript: zero compiler errors in backend + shared

**Estimated lines:** ~90–120 (test code)
**Dependencies:** T06
**Parallelism:** Sequential after T06; PR #1 is ready to merge after this task passes

---

## Slice 2 — Frontend (PR #2)

Tasks T08–T13. Depends on Slice 1 shared build being available (T01+T02 must be merged and `@tempora/shared` rebuilt). Can be developed in parallel against the T01+T02 branch but typecheck/build only passes after Slice 1 merges.

---

### [x] T08 — Update `absences.api.ts` — DTO + approve/reject methods

**File:** `frontend/src/app/features/absences/data-access/absences.api.ts`

**Changes:**
1. Add `decisionComment: string | null` to `AbsenceDto` interface
2. Widen `type` field: `AbsenceType` from `@tempora/shared` (all 9 values) or inline the 9-value union
3. Update `approveAbsence(id: string, comment?: string)` method to post `comment ? { comment } : {}` as body
4. Update `rejectAbsence(id: string, comment?: string)` method with same pattern

**Acceptance criteria:**
- FR-ABS-25: `AbsenceDto` includes `decisionComment: string | null`
- FR-ABS-26: `approveAbsence` / `rejectAbsence` accept optional comment and include it in the POST body
- TypeScript: no implicit `any`; strict types throughout

**Estimated lines:** ~20
**Dependencies:** T01+T02 merged (shared types available)
**Parallelism:** START of Slice 2; unblocks T09, T10

---

### [x] T09 — Update `absences.store.ts` — comment forwarding

**File:** `frontend/src/app/features/absences/data-access/absences.store.ts`

**Changes:**
1. Update `approveAbsence(id: string, comment?: string)` signal/method to accept optional comment
2. Forward `comment` to `absencesApi.approveAbsence(id, comment)`
3. Same for `rejectAbsence(id: string, comment?: string)`

**Acceptance criteria:**
- FR-ABS-26: Store methods accept and forward optional comment to the API layer
- Existing store state management (signal updates on resolve) unchanged

**Estimated lines:** ~10
**Dependencies:** T08
**Parallelism:** Sequential after T08; can run in parallel with T10

---

### [x] T10 — Update `absence-request.component.ts`

**File:** `frontend/src/app/features/absences/feature/absence-request.component.ts`

**Changes:**
1. Extend `ABSENCE_TYPE_LABELS` map to all 9 types with Spanish display strings:
   ```ts
   ASUNTOS_PROPIOS: 'Asuntos Propios',
   PERMISO_NO_RETRIBUIDO: 'Permiso No Retribuido',
   MATERNIDAD_PATERNIDAD: 'Maternidad / Paternidad',
   ```
2. Add `commentControl = new FormControl('')` (or inline signal) in the decision flow for approve/reject actions
3. Render a textarea labeled "Comentario (opcional)" in the decision UI for ADMIN/MANAGER
4. Call `store.approveAbsence(id, commentControl.value || undefined)` / `store.rejectAbsence(...)`
5. In history rows: display `abs.decisionComment` when non-null (e.g. below the status badge)

**Acceptance criteria:**
- FR-ABS-22: All 9 absence type labels present with correct Spanish strings
- FR-ABS-26: Comment textarea present in decision UI; field is optional (empty submit allowed)
- FR-ABS-26: Employee history rows show `decisionComment` when present
- FR-ABS-32: EMPLOYEE sees request form + own history; ADMIN/MANAGER sees approval queue
- Accessibility: textarea has a visible label; passes AXE checks

**Estimated lines:** ~45
**Dependencies:** T09
**Parallelism:** Sequential after T09; can run in parallel with T11

---

### [x] T11 — Update `cuadrante-grid.component.ts`

**File:** `frontend/src/app/features/shifts/ui/cuadrante-grid.component.ts`

**Changes:**
1. Add import: `import type { AbsenceDto } from '../../absences/data-access/absences.api'`
2. Add signal input: `readonly absences = input<AbsenceDto[]>([])`
3. Add `ABSENCE_CONFIG` constant mapping all 9 types to `{ label, bg, text, border, typeLabel }` using amber family colors:
   - bg: `rgba(245,158,11,0.20)`, text: `#fcd34d`, border: `rgba(245,158,11,0.5)`
   - Labels: `VACACIONES→VAC`, `IT→BAJA`, `PERMISO_RETRIBUIDO→PR`, `AUSENCIA_INJUSTIFICADA→AI`, `LACTANCIA→LAC`, `REDUCCION_JORNADA→RJ`, `ASUNTOS_PROPIOS→AP`, `PERMISO_NO_RETRIBUIDO→PNR`, `MATERNIDAD_PATERNIDAD→MP`
4. Add `readonly absenceMap = computed(...)` — expands each absence across its date range, clamps to displayed month, keys on `employeeId:dateStr`
5. Add `getAbsence(employeeId, dateStr)` helper method
6. Update cell template: render absence chip with precedence over shift/empty; disable click/keydown/tabindex when `abs` is present
7. Add `.absence-chip` CSS: mirrors `.shift-chip` dimensions but `cursor: default`, no hover scale

**Acceptance criteria:**
- FR-ABS-29: Approved absence cells render with amber chip + abbreviated type label
- FR-ABS-29: PENDING absences do NOT appear in the grid (computed filters `status !== 'APPROVED'`)
- FR-ABS-30: Clicking an absence cell does NOT open the assignment dialog (click guard `editable() && !abs`)
- FR-ABS-30: Absence cell has `tabindex="-1"` (non-focusable)
- ChangeDetection: `OnPush` maintained; computed signals drive re-render

**Estimated lines:** ~80
**Dependencies:** T08 (AbsenceDto type must exist)
**Parallelism:** Can run in parallel with T10 after T08

---

### [x] T12 — Update `cuadrante.component.ts`

**File:** `frontend/src/app/features/shifts/feature/cuadrante.component.ts`

**Changes:**
1. `inject(AbsencesApi)` (or inject `AbsencesStore` if preferred — API direct is simpler for a read-only fetch)
2. Add `readonly absences = signal<AbsenceDto[]>([])`
3. In `loadAll()` (or equivalent month-load method), add:
   ```ts
   const abs = await firstValueFrom(this.absencesApi.listAbsences({ status: 'APPROVED' }));
   this.absences.set(abs);
   ```
   Note: fetch all APPROVED; `absenceMap` in the grid clamps to displayed month (D6 decision)
4. Bind in template: `[absences]="absences()"` on `<app-cuadrante-grid>`
5. Re-fetch when selected month changes (trigger already exists in `loadAll`)

**Acceptance criteria:**
- FR-ABS-31: Approved absences for the displayed month are fetched and passed to the grid on load
- FR-ABS-31: Month change triggers a re-fetch
- No data fetching inside the grid component (grid stays presentational per design)

**Estimated lines:** ~20
**Dependencies:** T11 (grid must accept the new `absences` input)
**Parallelism:** Sequential after T11

---

### [x] T13 — Angular build clean + smoke-test checklist

**Actions:**
1. Run `ng build` (or project build script) — zero errors, zero new warnings
2. Run Angular unit tests covering:
   - `CuadranteGridComponent`: renders absence chip for APPROVED absence; no chip for PENDING; click on absence cell does not emit `cellClick`
   - `absence-request.component`: all 9 type labels present; decision comment textarea present in admin/manager branch; `decisionComment` shown in history rows
3. Manual smoke-test checklist:
   - [ ] Navigate to /absences as EMPLOYEE: see own request form, own history only
   - [ ] Navigate to /absences as ADMIN: see approval queue with comment textarea
   - [ ] Approve an absence with a comment: comment visible in history
   - [ ] Open cuadrante for a month with approved absences: amber chips appear on correct cells
   - [ ] Click an absence cell: shift assignment dialog does NOT open

**Acceptance criteria:**
- `ng build` exits 0
- New Angular tests cover grid and absence-request component AC scenarios above
- All pre-existing frontend tests pass

**Estimated lines:** ~60–80 (test code)
**Dependencies:** T12
**Parallelism:** Sequential after T12; PR #2 is ready to merge after this task passes

---

## Dependency Graph

```
T01 ──► T02 ──► (T05)
    └──► T03 ──► T04 ──► T05 ──► T06 ──► T07   [PR #1]
                                              │
                                              ▼
                               T08 ──► T09 ──► T10 ──► T12 ──► T13
                                   └──► T11 ──────────────►      [PR #2]
```

Parallel opportunities within Slice 1:
- T02 and T03 can run in parallel once T01 is done
- T05 and (reading T06 in prep) can overlap after T04

Parallel opportunities within Slice 2:
- T10 and T11 can run in parallel after T08+T09

---

## Summary

| ID  | Title                                         | Slice | Est. Lines | Deps        | Parallel?       |
|-----|-----------------------------------------------|-------|-----------|-------------|-----------------|
| T01 | Extend ABSENCE_TYPE_VALUES (shared enums)     | 1     | ~4        | —           | First; unblocks T02, T03 |
| T02 | Update shared absence schemas                 | 1     | ~10       | T01         | Parallel with T03 |
| T03 | Create Prisma migration (schema + SQL)        | 1     | ~12       | T01         | Parallel with T02 |
| T04 | Apply Prisma migration (prisma migrate dev)   | 1     | 0         | T03         | Sequential       |
| T05 | Update absences.service.ts                    | 1     | ~25       | T03, T04    | Sequential       |
| T06 | Update absences.controller.ts                 | 1     | ~30       | T05         | Sequential       |
| T07 | Backend typecheck + regression + new tests    | 1     | ~90–120   | T06         | Sequential; PR#1 gate |
| T08 | Update absences.api.ts (DTO + methods)        | 2     | ~20       | T01, T02    | First of Slice 2 |
| T09 | Update absences.store.ts (comment forwarding) | 2     | ~10       | T08         | Sequential       |
| T10 | Update absence-request.component.ts           | 2     | ~45       | T09         | Parallel with T11 |
| T11 | Update cuadrante-grid.component.ts            | 2     | ~80       | T08         | Parallel with T10 |
| T12 | Update cuadrante.component.ts                 | 2     | ~20       | T11         | Sequential       |
| T13 | Angular build clean + component tests         | 2     | ~60–80    | T12         | Sequential; PR#2 gate |

**Slice 1 total (impl):** ~81 lines + ~90–120 test lines ≈ 170–200 lines
**Slice 2 total (impl):** ~175 lines + ~60–80 test lines ≈ 235–255 lines
**Grand total:** ~405–455 lines

---

## Review Workload Forecast

```
Estimated changed lines: ~405–455 (impl + tests)
400-line budget risk: Medium-High
Chained PRs recommended: Yes
Suggested slices:
  PR #1 — Slice 1 (T01–T07): shared enums/schemas + Prisma migration + backend service/controller + tests
  PR #2 — Slice 2 (T08–T13): frontend DTO/store/absence-request component/cuadrante grid + component + tests
  Note: PR #2 depends on PR #1 merged and @tempora/shared rebuilt
Decision needed before apply: Yes
```
