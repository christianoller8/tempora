# Design: Legal Compliance Export

## Architecture Approach

Additive feature on top of the existing `reporting` module. The current module uses generic
`toPdf`/`toXlsx` exporters driven by a `ColumnDef[]`. That generic table model cannot express the
RDL 8/2019 layout (org header, per-employee subtotals, embedded modification log, grand total,
multi-sheet workbook). Rather than overload the generic exporters, this change introduces three
**dedicated builders** that own their layout end-to-end and receive already-shaped, typed data.

Layering stays consistent with the existing module:

```
router  → requireRole + asyncHandler                 (HTTP method + role gate)
controller → Zod body validation, scoping, send       (transport: headers, Content-Disposition)
service → DB queries + data shaping into builder DTOs  (domain)
builder → pdfkit / exceljs → Buffer                    (presentation/format)
```

Key boundary decision: **services return typed DTOs (`ComplianceExportData`, `ScheduleExportData`),
not raw Prisma rows.** Builders never touch Prisma. This keeps builders pure (input → Buffer),
trivially unit-testable, and free of GDPR-sensitive fields by construction.

---

## Resolved Risks (from spec)

### R1 — `Employee.category` exists and is an enum
Confirmed in `schema.prisma`: `Employee.category` is `EmployeeCategory` (non-null enum:
MEDICO, ENFERMERO, TCAE, ...). No new column needed. The PDF/Excel "Category" column renders the
raw enum value (e.g. `ENFERMERO`). No i18n label mapping in this change (out of scope).

### R2 — `Organization.cif` exists but is nullable
Confirmed: `Organization.cif String?`. The header MUST tolerate null. Decision: render CIF as
`"—"` when null. Service fetches `organization.findFirst({ select: { name: true, cif: true } })`
scoped by tenant client (RLS already constrains to current org).

### R3 — OPEN entries: INCLUDE with em-dash
Spec FR-EXP-05 mandates the Clock Out column show `"—"` for OPEN entries. Decision: **include both
OPEN and CLOSED** entries in the time-entries export (no `status: 'CLOSED'` filter), unlike the
existing `complianceExport` which filters to CLOSED only. Duration for an OPEN entry (no clockOut)
renders as `"—"` and contributes `0` to subtotals/grand total. This diverges from the existing
yearly `complianceExport` and is intentional: an inspection record must show the live/open day.

### R4 — AuditLog field naming
Spec says the modification log shows `actor`. The DB column is `actorUserId` (nullable). Decision:
map `actorUserId ?? "system"` → the "Actor" cell. `before`/`after` are `Json?` → serialized via
`JSON.stringify(value ?? null)`. `entityId` is nullable → `"—"` when null.

### R5 — MANAGER center scoping has NO server-side source (CRITICAL)
`AuthUser` (`backend/src/types/auth.ts`) has `{ userId, organizationId, role, employeeId, jti }`.
There is **no `centerId`** on the token. The existing reporting controller casts
`user as { centerId?: string }`, which is always `undefined` — meaning existing MANAGER scoping
silently degrades to "all centers". Spec scenario FR-EXP-01 "MANAGER downloads only their center's
entries" cannot be satisfied from the token alone.

Decision for THIS change: derive the MANAGER's center server-side from their employee record:
`employee.findUnique({ where: { id: user.employeeId }, select: { primaryCenterId: true } })`, then
filter time entries to `employee.primaryCenterId = <managerCenter>`. If the MANAGER has no
`employeeId` (data gap), they are scoped to an empty result set (fail-closed), not all centers.
This keeps the multi-tenant guarantee intact and satisfies the spec without a token/schema change.
Flagged as an assumption requiring a verify-phase test.

---

## File Layout

### Backend — new
```
src/modules/reporting/builders/compliance-pdf.builder.ts   pdfkit: time-entry compliance PDF (header, per-employee table, subtotals, mod-log, grand total)
src/modules/reporting/builders/compliance-xlsx.builder.ts  exceljs: 2-sheet workbook (Time Entries + Audit Log)
src/modules/reporting/builders/schedule-pdf.builder.ts     pdfkit: employee monthly schedule PDF
```
(Placed under a new `builders/` subfolder to sit beside the existing `exporters/` folder without
mixing the generic table exporters with the dedicated compliance builders.)

### Backend — modified
```
src/modules/reporting/reporting.service.ts      + collectComplianceExport(), + collectScheduleExport()
src/modules/reporting/reporting.controller.ts   + handleTimeEntriesPdf, handleTimeEntriesExcel, handleSchedulePdf
src/modules/reporting/reporting.router.ts        + 3 POST routes
```

### Frontend — new
```
src/app/features/reports/ui/export-dialog.component.ts   p-dialog with signal-driven form
```

### Frontend — modified
```
src/app/features/time-tracking/feature/clock.component.ts   + "Export for Inspection" button (ADMIN/MANAGER) + <app-export-dialog>
src/app/features/shifts/feature/cuadrante.component.ts       + "Download Schedule" button (all roles, direct download)
src/app/features/reports/data-access/reports.api.ts          + downloadTimeEntries(), downloadSchedule()
```

---

## Backend Service Design

Shared DTOs (exported from `reporting.service.ts` so builders import them):

```typescript
export interface ComplianceEntryRow {
  employeeName: string;   // "Last, First"
  category: string;       // EmployeeCategory enum value
  date: string;           // YYYY-MM-DD (from clockIn, UTC)
  clockIn: string;        // HH:mm
  clockOut: string | null;// HH:mm or null (OPEN)
  durationHours: number | null; // 2-dp decimal hours, null when OPEN
  source: string;
}

export interface ComplianceAuditRow {
  timestamp: string;      // ISO 8601 UTC
  actor: string;          // actorUserId ?? "system"
  entityId: string;       // entityId ?? "—"
  action: string;
  before: string;         // JSON.stringify
  after: string;          // JSON.stringify
}

export interface ComplianceExportData {
  organization: { name: string; cif: string | null };
  dateRange: { from: string; to: string };
  generatedAt: string;    // ISO 8601 UTC
  rows: ComplianceEntryRow[];      // sorted by employeeName, then clockIn
  auditLog: ComplianceAuditRow[];  // sorted by timestamp asc
}

export interface ScheduleAssignmentRow {
  date: string;           // YYYY-MM-DD
  shiftName: string;      // ShiftTemplate.name
  startTime: string;      // HH:mm (ShiftTemplate.startTime)
  endTime: string;        // HH:mm (ShiftTemplate.endTime)
}

export interface ScheduleExportData {
  employeeName: string;   // "First Last"
  monthLabel: string;     // e.g. "June 2025"
  year: number;
  month: number;
  generatedAt: string;
  rows: ScheduleAssignmentRow[]; // sorted by date asc
}
```

### `collectComplianceExport`
```typescript
async function collectComplianceExport(
  orgId: string,
  from: string,            // ISO date
  to: string,              // ISO date
  employeeId: string | undefined,
  managerCenterId: string | undefined, // set by controller when role === MANAGER
  db: TenantClient,
): Promise<ComplianceExportData>
```
Queries:
1. `db.organization.findFirst({ select: { name, cif } })` — RLS scopes to current org.
2. `db.timeEntry.findMany({ where: { clockIn: { gte: fromDate, lte: toEndOfDay }, ...(employeeId ? { employeeId } : {}), employee: managerCenterId ? { primaryCenterId: managerCenterId } : undefined }, select: { employeeId, clockIn, clockOut, status, source, employee: { select: { firstName, lastName, category } } } })`. **No status filter** (R3). `causeEncrypted` never selected (no such field on TimeEntry anyway).
3. `db.auditLog.findMany({ where: { entityType: 'TimeEntry', createdAt: { gte: fromDate, lte: toEndOfDay } }, orderBy: { createdAt: 'asc' } })` (FR-EXP-07 / FR-EXP-10).
   - Note: audit rows are NOT center-filtered (audit entityId is a string, not joined). Acceptable for v1; flagged for verify.

Shaping: build `employeeName = "${lastName}, ${firstName}"`; format times with UTC getters
(`toISOString().slice(11,16)`); `durationHours = clockOut ? round2((clockOut-clockIn)/3.6e6) : null`.
Sort rows by `employeeName` then `clockIn`. Returns `ComplianceExportData` (Buffer produced by builder).

`employeeId` existence check (FR-EXP-01 404): controller calls `db.employee.findUnique` first; if a
non-null `employeeId` resolves to nothing, controller throws `ApiError(404)` before invoking the service.

### `collectScheduleExport`
```typescript
async function collectScheduleExport(
  orgId: string,
  year: number,
  month: number,        // 1-12
  employeeId: string,   // already resolved + authorized by controller
  db: TenantClient,
): Promise<ScheduleExportData>
```
Queries:
1. `db.employee.findUnique({ where: { id: employeeId }, select: { firstName, lastName } })` → 404 if missing.
2. `db.shiftAssignment.findMany({ where: { employeeId, date: { gte: monthStart, lte: monthEnd } }, select: { date, shiftTemplate: { select: { name, startTime, endTime } } }, orderBy: { date: 'asc' } })`.

`monthStart = new Date(Date.UTC(year, month-1, 1))`, `monthEnd = new Date(Date.UTC(year, month, 0, 23,59,59))`.
`monthLabel` via fixed English month-name array (no `Intl` locale dependency, deterministic — NFR-EXP-02).

### Response type
Both service functions return DTOs; the builder returns `Promise<Buffer>`; the controller sets headers and `res.send(buffer)`. No audit row is written for these exports in v1 (the existing yearly `complianceExport` writes one; these new endpoints are read-only inspection helpers — flagged as a possible verify follow-up, not required by spec).

---

## Controller Design

Zod schemas (inline, module-local):
```typescript
const timeEntriesBody = z.object({
  from: z.string().date(),
  to: z.string().date(),
  employeeId: z.string().uuid().optional(),
}).refine(b => b.from <= b.to, { message: 'from must be <= to' })           // FR-EXP-01 (from>to → 400)
  .refine(b => daysBetween(b.from, b.to) <= 366, { message: 'range too large' }); // NFR-EXP-04 (>366 → 400)

const scheduleBody = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  employeeId: z.string().uuid().optional(),
});
```
Validation failures → `ApiError(400)` (asyncHandler/error middleware already map ZodError to 400; confirm in verify).

`handleTimeEntriesPdf` / `handleTimeEntriesExcel`:
1. Parse body. 2. If `role === 'MANAGER'` resolve `managerCenterId` from `employee.findUnique({ where:{ id:user.employeeId } })` (R5, fail-closed). 3. If `body.employeeId` set, verify it exists in org → else 404. 4. `data = await collectComplianceExport(...)`. 5. `buf = await buildCompliancePdf(data)` (or `buildComplianceXlsx`). 6. Set `Content-Type` + `Content-Disposition: attachment; filename="time-entries-${from}-${to}.{pdf|xlsx}"`; `res.send(buf)`. Role gate (ADMIN/MANAGER) enforced in router.

`handleSchedulePdf`:
1. Parse body. 2. Resolve target employee: `EMPLOYEE` → MUST be own `employeeId` (if body.employeeId present and != user.employeeId → 403; if absent → default to user.employeeId). `ADMIN`/`MANAGER` → may use any body.employeeId, else default to own. 3. `collectScheduleExport` → `buildSchedulePdf` → send `application/pdf`, filename `schedule-${year}-${month}.pdf`. Router gate: any authenticated role.

---

## Builder Designs

### compliance-pdf.builder.ts
```typescript
export function buildCompliancePdf(data: ComplianceExportData): Promise<Buffer>
```
A4 portrait, margin 40, Promise-wrapped chunk collection (mirrors existing `toPdf`). Helvetica /
Helvetica-Bold standard fonts only — no custom font loading.

Layout:
1. **Header block** (FR-EXP-04): title "Time Record — RDL 8/2019"; org name (bold) + `CIF: {cif ?? "—"}`; `Period: {from} → {to}`; `Generated (UTC): {generatedAt}`.
2. **Entries table** (FR-EXP-05): columns Employee | Category | Date | In | Out | Hours | Source with fixed pixel widths summing to usable width (~515pt). Bold header row + separator line. Iterate `rows` already sorted; group by `employeeName`. On employee change, emit a **subtotal row** (FR-EXP-06) "Subtotal — {name}: {hours.toFixed(2)}" before starting the next employee. Page-break guard identical to existing `toPdf` (addPage when `y + rowHeight > bottom`), re-printing the column header on each new page.
3. **Grand total** (FR-EXP-08): after last employee, bold row "TOTAL: {grandTotal.toFixed(2)}".
4. **Modification log** (FR-EXP-07): `addPage()`; heading "Modification Log"; table Timestamp | Actor | Entity ID | Action | Before | After. `before`/`after` JSON wrapped with `lineBreak: true` (multi-line cells). If `auditLog.length === 0`, render the heading + "No modifications in this period." (section exists, no data rows).

### compliance-xlsx.builder.ts
```typescript
export function buildComplianceXlsx(data: ComplianceExportData): Promise<Buffer>
```
`new ExcelJS.Workbook()`, two sheets.

**Sheet 1 "Time Entries"** (FR-EXP-09): columns Employee Name, Category, Date, Clock In, Clock Out, Duration (h), Source. `sheet.views = [{ state: 'frozen', ySplit: 1 }]` (frozen header). Row 1 `font = { bold: true }`. Add `data.rows` (clockOut → `"—"`, durationHours → `"—"` when null). Auto-width pass identical to existing `toXlsx`.

**Sheet 2 "Audit Log"** (FR-EXP-10): columns Timestamp (UTC), Actor, Entity ID, Action, Before (JSON), After (JSON). Same frozen/bold/auto-width treatment. Add `data.auditLog`.

### schedule-pdf.builder.ts
```typescript
export function buildSchedulePdf(data: ScheduleExportData): Promise<Buffer>
```
A4 portrait. Header (FR-EXP-12): employee full name (bold, 16pt) + `{monthLabel}` subtitle.
Body (FR-EXP-13): table Date | Shift | Start | End, bold header + separator, one row per assignment
sorted by date. Empty case (FR-EXP-13 scenario 2): render "No assignments in this month." and still
produce a valid Buffer. Page-break guard as above.

---

## Frontend Dialog Design — export-dialog.component.ts

Standalone, OnPush, signals-first (no FormBuilder — simple form, signal bindings preferred). Mirrors
the `employee-form` p-dialog shell but without ReactiveForms.

Inputs / outputs:
```typescript
visible = input<boolean>(false);
employeeId = input<string | undefined>(undefined); // pre-fill specific employee
close = output<void>();
```
Local signals:
```typescript
fromDate = signal<Date | null>(firstOfCurrentMonth);
toDate   = signal<Date | null>(today);
selectedEmployeeId = signal<string | undefined>(undefined); // 'all' = undefined
format   = signal<'pdf' | 'excel'>('pdf');
downloading = signal(false);
error    = signal<string | null>(null);
```
Template: `p-dialog [visible]="visible()" (onHide)="close.emit()"` containing:
- `p-datepicker` for From and To (`DatePickerModule`).
- `p-select` employee selector (options loaded from an employees list signal; "All employees" first option → undefined). Visible to ADMIN/MANAGER (the only roles that open this dialog).
- `p-select` format (PDF / Excel).
- Footer: Cancel + Download `p-button` (`[loading]="downloading()"`).

On Download: format dates to `YYYY-MM-DD` (`d.toISOString().slice(0,10)`), call
`reportsApi.downloadTimeEntries({ from, to, employeeId: selectedEmployeeId(), format })`; set
`downloading`; on complete emit `close`; on error set `error`.

PrimeNG imports: `DialogModule, ButtonModule, SelectModule, DatePickerModule`.
Employee options: fetched via existing employees API/store (reuse `EmployeeDto { id, firstName, lastName }`); the dialog injects whatever employees source `clock.component` already has, or a lightweight GET. Decision: dialog fetches its own list on first open via the existing employees endpoint to stay self-contained (small list, cached by signal).

---

## ReportsApi Additions

```typescript
downloadTimeEntries(params: {
  from: string; to: string; employeeId?: string; format: 'pdf' | 'excel';
}): Observable<void>

downloadSchedule(params: {
  year: number; month: number; employeeId?: string;
}): Observable<void>
```
Both POST with `{ responseType: 'blob', withCredentials: true }` and pipe to a download side effect
reusing the existing `downloadReport(blob, filename)` helper:

```typescript
downloadTimeEntries(params) {
  const path = params.format === 'excel'
    ? '/reports/time-entries/excel'
    : '/reports/time-entries/pdf';
  const ext = params.format === 'excel' ? 'xlsx' : 'pdf';
  const body = { from: params.from, to: params.to, ...(params.employeeId ? { employeeId: params.employeeId } : {}) };
  return this.http.post(`${this.baseUrl}${path}`, body, { responseType: 'blob', withCredentials: true })
    .pipe(map(blob => { this.downloadReport(blob, `time-entries-${params.from}-${params.to}.${ext}`); }));
}

downloadSchedule(params) {
  const body = { year: params.year, month: params.month, ...(params.employeeId ? { employeeId: params.employeeId } : {}) };
  return this.http.post(`${this.baseUrl}/reports/schedule/pdf`, body, { responseType: 'blob', withCredentials: true })
    .pipe(map(blob => { this.downloadReport(blob, `schedule-${params.year}-${params.month}.pdf`); }));
}
```
Return type `Observable<void>` (the `map` discards the blob after triggering the download).

---

## clock.component.ts Changes

- `isAdminOrManager` computed: confirm/add `computed(() => { const r = this.auth.role(); return r === 'ADMIN' || r === 'MANAGER'; })` using injected `AuthStore`.
- `showExport = signal(false)`.
- Template: above the "Today's Activity" section, `@if (isAdminOrManager())` → `<p-button label="Export for Inspection" icon="pi pi-file-export" (onClick)="showExport.set(true)" />` (FR-EXP-15: not in DOM for EMPLOYEE).
- At template bottom: `<app-export-dialog [visible]="showExport()" (close)="showExport.set(false)" />`.
- Add `ExportDialogComponent` + `ButtonModule` (already imported) to `imports`.

## cuadrante.component.ts Changes

- Inject `ReportsApi` + `AuthStore`.
- Add to the `.page-header` actions row: `<p-button label="Download Schedule" icon="pi pi-calendar" (onClick)="downloadSchedule()" />` — visible to all roles (FR-EXP-18).
- `downloadSchedule()`: derive `year`/`month` from the currently displayed cuadrante month signals; `employeeId = auth.user()?.employeeId ?? undefined`; call `reportsApi.downloadSchedule({ year, month, employeeId }).subscribe()`. EMPLOYEE always sends own id (FR-EXP-18 scenario). No dialog.
- ADMIN/MANAGER on cuadrante download their own schedule via this button (per-employee selection from this page is out of scope for this button; the inspection dialog handles multi-employee).

---

## Data Flow

```
[Time Tracking page] Export button (ADMIN/MANAGER)
  → ExportDialog (from/to/employee/format)
  → ReportsApi.downloadTimeEntries → POST /reports/time-entries/{pdf|excel}
  → router requireRole(ADMIN,MANAGER) → controller (Zod, MANAGER center scope, 404 check)
  → collectComplianceExport (org + entries + audit) → ComplianceExportData
  → build{Compliance Pdf|Xlsx} → Buffer → res.send → browser download

[Shifts/cuadrante page] Download Schedule button (all roles)
  → ReportsApi.downloadSchedule → POST /reports/schedule/pdf
  → router requireRole(authenticated) → controller (self-scope for EMPLOYEE, 403/404)
  → collectScheduleExport → ScheduleExportData → buildSchedulePdf → Buffer → download
```

---

## ADR Summary

- **ADR-1 Dedicated builders, not generic exporters.** Generic `ColumnDef[]` model can't express subtotals/multi-section/multi-sheet. Rejected: extend `toPdf`/`toXlsx` with options — would balloon their branching and break their single-table contract.
- **ADR-2 Services return typed DTOs; builders are pure.** Keeps GDPR fields out by construction and makes builders unit-testable without a DB. Rejected: pass Prisma rows to builders — couples presentation to schema and risks leaking sensitive fields.
- **ADR-3 MANAGER center derived from `employee.primaryCenterId`, fail-closed.** Token has no `centerId`. Rejected: trust the existing `user as { centerId }` cast — it is always undefined and silently leaks all centers.
- **ADR-4 Include OPEN entries with em-dash.** Inspection record must reflect open days; OPEN contributes 0 hours. Rejected: filter to CLOSED (existing yearly export behavior) — would hide active records from an inspector.
- **ADR-5 Frontend signals over ReactiveForms in the dialog.** Per project Angular conventions (signals-first) and the form's simplicity. Schedule download needs no dialog (direct call).
- **ADR-6 Deterministic month label via fixed English array.** Satisfies NFR-EXP-02 (deterministic output) without `Intl` locale variance.

---

## Review Workload Forecast

| File | Type | Est. lines |
|------|------|-----------|
| compliance-pdf.builder.ts | new | ~150 |
| compliance-xlsx.builder.ts | new | ~80 |
| schedule-pdf.builder.ts | new | ~70 |
| reporting.service.ts | mod (+2 fns + DTOs) | ~120 |
| reporting.controller.ts | mod (+3 handlers + Zod) | ~110 |
| reporting.router.ts | mod (+3 routes) | ~20 |
| export-dialog.component.ts | new | ~160 |
| clock.component.ts | mod | ~25 |
| cuadrante.component.ts | mod | ~20 |
| reports.api.ts | mod | ~30 |
| **Total (impl)** | | **~785** |

Plus tests (strict TDD): builder unit tests, service tests, controller/route integration tests,
component specs → easily another 400-600 lines.

**Chained PRs recommended: Yes.** **400-line budget risk: High.** **Decision needed before apply: Yes.**
Suggested split: PR-1 backend (service + builders + controller + router + tests), PR-2 frontend
(ReportsApi + dialog + clock + cuadrante + specs). Each slice is independently shippable and testable.
