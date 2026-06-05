# Tasks: Legal Compliance Export

Generated: 2026-06-04

---

## Slice 1 — Backend (PR-1)

Tasks T01–T07 are independent of the frontend. They can be reviewed and merged first.
Sequential order: T01, T02, T03 (builders) → T04 (service) → T05 (controller) → T06 (router) → T07 (schemas inline in router).
T01–T03 can run in parallel. T04 must follow all three. T05 follows T04. T06 follows T05. T07 is part of T06.

---

### [x] T01 — Create `compliance-pdf.builder.ts`

**Files**
- CREATE `backend/src/modules/reporting/builders/compliance-pdf.builder.ts`
- CREATE `backend/src/modules/reporting/builders/compliance-pdf.builder.test.ts`

**What to implement**
```typescript
export function buildCompliancePdf(data: ComplianceExportData): Promise<Buffer>
```
A4 portrait, 40pt margin, standard Helvetica/Helvetica-Bold fonts only.
Layout sections in order:
1. Header block: title "Time Record — RDL 8/2019", org name (bold) + `CIF: {cif ?? "—"}`, `Period: {from} → {to}`, `Generated (UTC): {generatedAt}`.
2. Entries table: columns Employee | Category | Date | In | Out | Hours | Source. Bold header row + separator line. Iterate sorted rows; on employee change emit a subtotal row. Page-break guard: `addPage()` + re-print column header when `y + rowHeight > bottom`.
3. Grand total row after last employee's subtotal.
4. Modification log: `addPage()`, heading "Modification Log", table Timestamp | Actor | Entity ID | Action | Before | After. If `auditLog.length === 0` emit "No modifications in this period." instead.

DTOs (`ComplianceExportData`, `ComplianceEntryRow`, `ComplianceAuditRow`) are defined in `reporting.service.ts` and imported from there.

**Acceptance criteria**
- FR-EXP-04: header block contains org name, CIF, UTC timestamp, date range
- FR-EXP-05: one row per entry with correct fields; OPEN entry has `"—"` in Out column
- FR-EXP-06: subtotal row per employee with correct sum
- FR-EXP-07: modification log section present; shows all fields; "No modifications" when empty
- FR-EXP-08: grand total row at end with correct sum
- Unit tests cover: header rendering, subtotal grouping, open-entry em-dash, empty audit log path, grand total value

**Estimated lines:** ~150 impl + ~120 test = ~270 total
**Dependencies:** none (DTO types defined in T04, but can be declared locally/forward-ref while writing; finalize import after T04)
**Parallel with:** T02, T03

---

### [x] T02 — Create `compliance-xlsx.builder.ts`

**Files**
- CREATE `backend/src/modules/reporting/builders/compliance-xlsx.builder.ts`
- CREATE `backend/src/modules/reporting/builders/compliance-xlsx.builder.test.ts`

**What to implement**
```typescript
export function buildComplianceXlsx(data: ComplianceExportData): Promise<Buffer>
```
`new ExcelJS.Workbook()`, two sheets.

Sheet 1 "Time Entries": columns Employee Name | Category | Date | Clock In | Clock Out | Duration (h) | Source. Frozen header row (`sheet.views = [{ state: 'frozen', ySplit: 1 }]`). Bold row 1. Auto-width pass (mirror existing `toXlsx`). `clockOut` → `"—"` when null; `durationHours` → `"—"` when null.

Sheet 2 "Audit Log": columns Timestamp (UTC) | Actor | Entity ID | Action | Before (JSON) | After (JSON). Same frozen/bold/auto-width treatment.

**Acceptance criteria**
- FR-EXP-09: Sheet 1 named "Time Entries", frozen + bold header, auto-width, all columns present
- FR-EXP-10: Sheet 2 named "Audit Log", all columns present, values match input DTO
- FR-EXP-11: Both sheets have frozen row 1, bold row 1, no default-narrow columns
- Unit tests: sheet names, row count, null → "—" substitution, header bold flag

**Estimated lines:** ~80 impl + ~80 test = ~160 total
**Dependencies:** none
**Parallel with:** T01, T03

---

### [x] T03 — Create `schedule-pdf.builder.ts`

**Files**
- CREATE `backend/src/modules/reporting/builders/schedule-pdf.builder.ts`
- CREATE `backend/src/modules/reporting/builders/schedule-pdf.builder.test.ts`

**What to implement**
```typescript
export function buildSchedulePdf(data: ScheduleExportData): Promise<Buffer>
```
A4 portrait. Header: employee full name (bold, 16pt) + `{monthLabel}` subtitle. Body: table Date | Shift | Start | End, bold header + separator. One row per assignment sorted by date. Empty case: render "No assignments in this month." and still return valid Buffer.

DTOs (`ScheduleExportData`, `ScheduleAssignmentRow`) defined in `reporting.service.ts`.

**Acceptance criteria**
- FR-EXP-12: header shows employee name and month label (e.g. "June 2025")
- FR-EXP-13: rows sorted by date ascending; empty-month produces valid PDF with correct text
- Unit tests: header content, row order, empty-month path

**Estimated lines:** ~70 impl + ~70 test = ~140 total
**Dependencies:** none
**Parallel with:** T01, T02

---

### [x] T04 — Extend `reporting.service.ts` — DTOs + `collectComplianceExport` + `collectScheduleExport`

**Files**
- MODIFY `backend/src/modules/reporting/reporting.service.ts`
- MODIFY `backend/src/modules/reporting/reporting.service.test.ts`

**What to implement**

Export DTO interfaces from the service file (or a co-located `types.ts`):
```typescript
export interface ComplianceEntryRow { ... }
export interface ComplianceAuditRow { ... }
export interface ComplianceExportData { ... }
export interface ScheduleAssignmentRow { ... }
export interface ScheduleExportData { ... }
```
(Full signatures in design doc §Backend Service Design)

Add two functions:

`collectComplianceExport(orgId, from, to, employeeId, managerCenterId, db)`:
1. `db.organization.findFirst` — org name + cif (RLS-scoped).
2. `db.timeEntry.findMany` — no status filter (R3: include OPEN); scope by employeeId if provided; scope by `primaryCenterId` if `managerCenterId` set.
3. `db.auditLog.findMany` — entityType `'TimeEntry'`, createdAt in range, asc order.
4. Shape rows: `employeeName = "${lastName}, ${firstName}"`, times via `toISOString()` UTC getters, `durationHours = clockOut ? round2((clockOut-clockIn)/3.6e6) : null`, sort by employeeName then clockIn.
5. Return `ComplianceExportData`.

`collectScheduleExport(orgId, year, month, employeeId, db)`:
1. `db.employee.findUnique({ where: { id: employeeId } })` → throw 404 if missing.
2. `db.shiftAssignment.findMany` for the month range, join `shiftTemplate { name, startTime, endTime }`, order by date asc.
3. `monthLabel` via fixed English month-name array (deterministic, no Intl).
4. Return `ScheduleExportData`.

**Acceptance criteria**
- `collectComplianceExport`: rows include OPEN entries; MANAGER center filter applied when `managerCenterId` set; rows sorted correctly; `cif` nullable → passes null
- `collectScheduleExport`: throws 404 when employee not found; empty assignments returns valid DTO with empty rows
- Service tests mock `TenantClient`; cover all branching paths including managerCenterId filter and empty-result cases
- DTOs exported so builders can import without circular dependency

**Estimated lines:** ~120 impl + ~150 test = ~270 total
**Dependencies:** T01, T02, T03 complete (for DTO import references)
**Sequential after:** T01–T03

---

### [x] T05 — Extend `reporting.controller.ts` — three export handlers

**Files**
- MODIFY `backend/src/modules/reporting/reporting.controller.ts`

**What to implement**

Add three handlers (wrapped with existing `asyncHandler`):

`handleTimeEntriesPdf(req, res)`:
1. Parse validated body (Zod schema defined in T06/T07 on the router).
2. If `role === 'MANAGER'`: derive `managerCenterId` from `db.employee.findUnique({ where: { id: user.employeeId }, select: { primaryCenterId: true } })`; if no `employeeId` on user → `managerCenterId = '__none__'` (fail-closed, returns empty result set).
3. If `body.employeeId` provided: `db.employee.findUnique`; if missing → throw `ApiError(404)`.
4. `data = await collectComplianceExport(...)`.
5. `buf = await buildCompliancePdf(data)`.
6. `res.setHeader('Content-Type', 'application/pdf')`.
7. `res.setHeader('Content-Disposition', `attachment; filename="time-entries-${from}-${to}.pdf"`)`.
8. `res.send(buf)`.

`handleTimeEntriesExcel(req, res)`: same flow, call `buildComplianceXlsx`, MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, filename `.xlsx`.

`handleSchedulePdf(req, res)`:
1. Parse body.
2. Resolve `targetEmployeeId`: if `role === 'EMPLOYEE'` and `body.employeeId` is set and differs from `user.employeeId` → throw `ApiError(403)`. If absent → default to `user.employeeId`.
3. `data = await collectScheduleExport(...)`.
4. `buf = await buildSchedulePdf(data)`.
5. `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="schedule-${year}-${month}.pdf"`.
6. `res.send(buf)`.

**Acceptance criteria**
- FR-EXP-01: ADMIN/MANAGER 200 with correct headers; date range validation produces 400; unknown employeeId produces 404
- FR-EXP-02: Excel MIME type correct
- FR-EXP-03: EMPLOYEE 200 for own schedule; 403 for other employee's schedule; ADMIN 200 for any
- ADR-3 (R5): MANAGER center derived from employee record; fail-closed when `employeeId` missing
- Content-Disposition filenames are deterministic (NFR-EXP-02)

**Estimated lines:** ~110 impl
**Dependencies:** T04 (service functions), T01 (PDF builder), T02 (XLSX builder), T03 (schedule builder)
**Sequential after:** T04

---

### [x] T06 — Extend `reporting.router.ts` — three POST routes

**Files**
- MODIFY `backend/src/modules/reporting/reporting.router.ts`

**What to implement**

Register three new routes using existing router patterns:

```
POST /reports/time-entries/pdf    requireRole(['ADMIN','MANAGER'])  → validateBody(timeEntriesBody) → handleTimeEntriesPdf
POST /reports/time-entries/excel  requireRole(['ADMIN','MANAGER'])  → validateBody(timeEntriesBody) → handleTimeEntriesExcel
POST /reports/schedule/pdf        requireRole(['ADMIN','MANAGER','EMPLOYEE'])  → validateBody(scheduleBody) → handleSchedulePdf
```

Zod validation middleware (if the project uses an `asyncHandler`+schema pattern): call schema `.parse(req.body)` at the top of each controller handler — OR if the project has a router-level `validateBody` middleware, use that. Match the existing pattern in this file exactly.

**Acceptance criteria**
- FR-EXP-01 / FR-EXP-02: EMPLOYEE POST to time-entry routes → 403 (role guard)
- FR-EXP-03: all authenticated roles can POST to schedule route
- Routes mount under the existing `/reports` prefix (confirm in integration test)
- No existing routes broken

**Estimated lines:** ~20 impl
**Dependencies:** T05 (handlers exist)
**Sequential after:** T05

---

### [x] T07 — Zod request schemas

**Files**
- MODIFY `backend/src/modules/reporting/reporting.controller.ts` (schemas inline, module-local)

**What to implement**

Two module-local Zod schemas used by the controller handlers:

```typescript
const timeEntriesBody = z.object({
  from: z.string().date(),
  to: z.string().date(),
  employeeId: z.string().uuid().optional(),
})
.refine(b => b.from <= b.to, { message: 'from must be <= to' })
.refine(b => daysBetween(b.from, b.to) <= 366, { message: 'range exceeds 366 days' });

const scheduleBody = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  employeeId: z.string().uuid().optional(),
});

function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
}
```

Placed at the top of the controller file. Validation called via `schema.safeParse(req.body)` (or throw `ApiError(400)` on failure) — match existing error-handling conventions.

**Acceptance criteria**
- FR-EXP-01: `from > to` → 400; range > 366 days → 400
- NFR-EXP-04: >366 days → 400
- FR-EXP-02: same validation applies to Excel endpoint
- `employeeId` absent is valid; invalid UUID → 400

**Estimated lines:** ~15 impl (included within T05's controller file)
**Dependencies:** T05 (same file)
**Note:** This is a sub-task of T05 — implemented in the same edit pass. Listed separately to track spec coverage.

---

## Slice 2 — Frontend (PR-2)

Depends on Slice 1 being merged (or at minimum the backend routes being available in a feature branch). T08 and T09 can be developed in parallel. T10 depends on T09. T11 is independent.

Sequential order within slice: T08 + T09 (parallel) → T10 → T12 (smoke test last).

---

### [x] T08 — Extend `reports.api.ts` — `downloadTimeEntries` + `downloadSchedule`

**Files**
- MODIFY `src/app/features/reports/data-access/reports.api.ts`
- MODIFY (or CREATE) `src/app/features/reports/data-access/reports.api.spec.ts`

**What to implement**

```typescript
downloadTimeEntries(params: {
  from: string;
  to: string;
  employeeId?: string;
  format: 'pdf' | 'excel';
}): Observable<void>

downloadSchedule(params: {
  year: number;
  month: number;
  employeeId?: string;
}): Observable<void>
```

Both POST with `{ responseType: 'blob', withCredentials: true }`. Pipe result through the existing `downloadReport(blob, filename)` helper (confirm helper exists in this file; if not, implement: create an anchor element, set `href` to `URL.createObjectURL(blob)`, set `download`, click, revoke).

`downloadTimeEntries`: path = `/reports/time-entries/excel` when `format === 'excel'` else `/reports/time-entries/pdf`; filename `time-entries-${from}-${to}.{ext}`.
`downloadSchedule`: path = `/reports/schedule/pdf`; filename `schedule-${year}-${month}.pdf`.
Return type `Observable<void>` (map discards blob after download trigger).

**Acceptance criteria**
- FR-EXP-17: correct endpoint called for each format; filename is deterministic
- FR-EXP-18: schedule download POSTs to correct path
- Unit tests mock `HttpClient`; assert correct path, body, and responseType per call
- `withCredentials: true` present on both calls

**Estimated lines:** ~30 impl + ~60 test = ~90 total
**Dependencies:** none (Slice 2 entry point)
**Parallel with:** T09

---

### [x] T09 — Create `export-dialog.component.ts`

**Files**
- CREATE `src/app/features/reports/ui/export-dialog.component.ts`
- CREATE `src/app/features/reports/ui/export-dialog.component.spec.ts`

**What to implement**

Standalone, `OnPush`, signals-only (no FormBuilder). Angular v20+ defaults: do NOT add `standalone: true` to decorator.

Inputs/outputs:
```typescript
visible = input<boolean>(false);
employeeId = input<string | undefined>(undefined);
close = output<void>();
```

Local signals:
```typescript
fromDate = signal<Date | null>(/* first of current month */);
toDate   = signal<Date | null>(/* today */);
selectedEmployeeId = signal<string | undefined>(undefined); // undefined = all
format   = signal<'pdf' | 'excel'>('pdf');
downloading = signal(false);
error    = signal<string | null>(null);
employees = signal<EmployeeDto[]>([]);
```

`EmployeeDto { id: string; firstName: string; lastName: string }` — fetch from existing employees endpoint on first open (inject existing employees API/HTTP service; use `effect()` tied to `visible` becoming true, call once).

Template (`p-dialog [visible]="visible()" (onHide)="close.emit()"`):
- `p-datepicker` for From and To
- `p-select` employee selector (options: "All employees" + employees list; visible to ADMIN/MANAGER — role injected from `AuthStore`)
- `p-select` format (PDF / Excel)
- Footer: Cancel button (emits `close`) + Download button (`[loading]="downloading()"`)

On Download:
1. Format dates to `YYYY-MM-DD` via `d.toISOString().slice(0, 10)`.
2. Call `reportsApi.downloadTimeEntries({ from, to, employeeId: selectedEmployeeId(), format: format() })`.
3. `downloading.set(true)` before, `downloading.set(false)` + `close.emit()` on success, `error.set(msg)` on failure.

PrimeNG imports: `DialogModule`, `ButtonModule`, `SelectModule`, `DatePickerModule`.

**Acceptance criteria**
- FR-EXP-15: button renders; dialog mounts correctly
- FR-EXP-16: from/to pickers, employee selector, format selector all present
- FR-EXP-17: Download triggers correct API call; loading state applied; dialog closes on success
- Employee selector not visible when role is EMPLOYEE (guard in template via `isAdminOrManager` computed)
- `OnPush` + signals — no `mutate`, no `ngClass/ngStyle`, native control flow (`@if`, `@for`)
- Component specs: dialog visibility, download call, loading state, error display

**Estimated lines:** ~160 impl + ~120 test = ~280 total
**Dependencies:** T08 (ReportsApi methods needed for wiring)
**Parallel with:** T08 (can be built in parallel; finalize wiring when T08 is done)

---

### [x] T10 — Modify `clock.component.ts` — Export for Inspection button + dialog

**Files**
- MODIFY `src/app/features/time-tracking/feature/clock.component.ts`
- MODIFY `src/app/features/time-tracking/feature/clock.component.spec.ts`

**What to implement**

1. Confirm/add `isAdminOrManager` computed signal:
   ```typescript
   isAdminOrManager = computed(() => {
     const r = this.authStore.role();
     return r === 'ADMIN' || r === 'MANAGER';
   });
   ```
2. Add `showExport = signal(false)`.
3. In template, above the "Today's Activity" section:
   ```html
   @if (isAdminOrManager()) {
     <p-button label="Export for Inspection" icon="pi pi-file-export"
               (onClick)="showExport.set(true)" />
   }
   ```
4. At template bottom:
   ```html
   <app-export-dialog [visible]="showExport()" (close)="showExport.set(false)" />
   ```
5. Add `ExportDialogComponent` to `imports` array.

**Acceptance criteria**
- FR-EXP-15: button present for ADMIN/MANAGER; absent from DOM for EMPLOYEE (not hidden with CSS — `@if` removes it)
- FR-EXP-16: clicking button sets `showExport` true, which opens the dialog
- `OnPush` preserved; no new change-detection footguns
- Spec: assert button not rendered for EMPLOYEE role; assert button rendered for ADMIN; assert `showExport` toggled on click

**Estimated lines:** ~25 impl + ~40 test = ~65 total
**Dependencies:** T09 (ExportDialogComponent must exist)
**Sequential after:** T09

---

### [x] T11 — Modify `cuadrante.component.ts` — Download Schedule button

**Files**
- MODIFY `src/app/features/shifts/feature/cuadrante.component.ts`
- MODIFY `src/app/features/shifts/feature/cuadrante.component.spec.ts`

**What to implement**

1. Inject `ReportsApi` and `AuthStore`.
2. In the `.page-header` actions row:
   ```html
   <p-button label="Download Schedule" icon="pi pi-calendar"
             (onClick)="downloadSchedule()" />
   ```
   Visible to all authenticated roles (no `@if` guard — FR-EXP-18).
3. Add `downloadSchedule()` method:
   ```typescript
   downloadSchedule() {
     const year = this.schedulesStore.currentYear();  // confirm signal name
     const month = this.schedulesStore.currentMonth(); // confirm signal name
     const employeeId = this.authStore.user()?.employeeId ?? undefined;
     this.reportsApi.downloadSchedule({ year, month, employeeId }).subscribe();
   }
   ```
   Confirm the exact signal names for current year/month from `schedules.store.ts` before implementing.
4. Add `ButtonModule` to imports if not already present.

**Acceptance criteria**
- FR-EXP-18: button visible to all roles; click triggers POST to `/reports/schedule/pdf` with current month/year and user's own `employeeId`
- EMPLOYEE sends own `employeeId` (not omitted) so the backend scoping is explicit
- No dialog required — direct download
- Spec: assert method calls `reportsApi.downloadSchedule` with correct params; assert button exists in template

**Estimated lines:** ~20 impl + ~35 test = ~55 total
**Dependencies:** T08 (ReportsApi method)
**Parallel with:** T09, T10 (independent of dialog)

---

### [x] T12 — Manual smoke-test checklist

**Files**
- No code changes

**Checklist**

Backend (Slice 1):
- [ ] `POST /reports/time-entries/pdf` with ADMIN → 200, `Content-Type: application/pdf`, file downloads and opens correctly in a PDF reader
- [ ] Same endpoint as MANAGER → 200, PDF contains only entries for MANAGER's center
- [ ] Same endpoint as EMPLOYEE → 403
- [ ] `from` > `to` → 400
- [ ] Date range > 366 days → 400
- [ ] `employeeId` that does not exist → 404
- [ ] `POST /reports/time-entries/excel` with ADMIN → 200, correct OOXML MIME type, file opens in Excel with two sheets ("Time Entries" / "Audit Log")
- [ ] `POST /reports/schedule/pdf` as EMPLOYEE with own `employeeId` → 200
- [ ] Same endpoint as EMPLOYEE with another employee's `employeeId` → 403
- [ ] Same endpoint as ADMIN with any `employeeId` → 200
- [ ] Month with no assignments → PDF renders "No assignments in this month." and is a valid file

Frontend (Slice 2):
- [ ] Time Tracking page as ADMIN: "Export for Inspection" button visible
- [ ] Time Tracking page as EMPLOYEE: button not present in DOM
- [ ] Click button → dialog opens with from/to pickers, employee selector, format selector
- [ ] Select PDF, click Download → file downloads as `.pdf`
- [ ] Select Excel, click Download → file downloads as `.xlsx`
- [ ] Download button shows loading spinner while in flight
- [ ] Shifts page for any role: "Download Schedule" button visible
- [ ] Click → file downloads as `.pdf` with correct month/year

**Dependencies:** T01–T11 all complete
**Sequential after:** everything

---

## Task Summary

| ID  | Title                                      | Slice   | Est. impl lines | Est. test lines | Parallel with |
|-----|--------------------------------------------|---------|-----------------|-----------------|---------------|
| T01 | compliance-pdf.builder.ts                  | Backend | ~150            | ~120            | T02, T03      |
| T02 | compliance-xlsx.builder.ts                 | Backend | ~80             | ~80             | T01, T03      |
| T03 | schedule-pdf.builder.ts                    | Backend | ~70             | ~70             | T01, T02      |
| T04 | reporting.service.ts (DTOs + 2 fns)        | Backend | ~120            | ~150            | —             |
| T05 | reporting.controller.ts (3 handlers)       | Backend | ~110            | —               | —             |
| T06 | reporting.router.ts (3 routes)             | Backend | ~20             | —               | —             |
| T07 | Zod schemas (inline in controller)         | Backend | ~15             | —               | part of T05   |
| T08 | reports.api.ts (2 new methods)             | Frontend| ~30             | ~60             | T09           |
| T09 | export-dialog.component.ts (new)           | Frontend| ~160            | ~120            | T08           |
| T10 | clock.component.ts (button + dialog)       | Frontend| ~25             | ~40             | —             |
| T11 | cuadrante.component.ts (schedule button)   | Frontend| ~20             | ~35             | T09           |
| T12 | Manual smoke-test checklist                | Both    | n/a             | n/a             | —             |

**Slice 1 total:** ~565 impl + test lines (backend)
**Slice 2 total:** ~470 impl + test lines (frontend)
**Grand total (impl only):** ~785 lines
**Grand total (impl + tests):** ~1,035 lines estimated

---

## Dependency Graph

```
T01 ──┐
T02 ──┼──▶ T04 ──▶ T05 ──▶ T06   (Slice 1 — sequential after parallel builders)
T03 ──┘         └── T07 (inline)

T08 ──┐
      ├──▶ T09 ──▶ T10            (Slice 2 — T09 depends on T08 for wiring)
T11 ──┘                           (T11 depends on T08 only)

T12 ──▶ (all of the above)
```

---

## Review Workload Forecast

```
Estimated changed lines (impl only): ~785
Estimated changed lines (impl + tests): ~1,035
400-line budget risk: High
Chained PRs recommended: Yes
Suggested slices:
  PR-1 — Slice 1: T01–T07 (backend builders + service + controller + router)
  PR-2 — Slice 2: T08–T12 (frontend dialog + API + component integrations)
Decision needed before apply: Yes
```
