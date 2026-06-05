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
