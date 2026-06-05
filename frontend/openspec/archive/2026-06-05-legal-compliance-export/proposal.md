# Proposal: Legal Compliance Export

## Intent

Spanish labor law (RDL 8/2019) requires employers to keep an immutable daily time record, retain it 4 years, and produce it on demand for labor inspection. Tempora has reporting endpoints but no inspection-ready time-record export, and employees cannot obtain their own schedule. This change adds compliant PDF/Excel exports for inspection plus a self-service employee schedule PDF.

## Scope

### In Scope
- Export dialog in Time Tracking (ADMIN/MANAGER): date range, employee selector (all/specific), format (PDF/Excel), download trigger.
- `POST /reports/time-entries/pdf`: org header, date range, table (Employee, Category, Date, Clock In/Out, Duration h, Source), per-employee total footer, embedded modification log (RDL 8/2019 immutable record).
- `POST /reports/time-entries/excel`: same data; per-employee sheets or single sheet with name column, plus a second "Audit Log" sheet of modifications in range.
- `POST /reports/schedule/pdf`: self-service employee monthly schedule PDF, button in Shifts (cuadrante).
- Extend `ReportsApi` with POST/blob methods; reuse `downloadReport`.

### Out of Scope
- Digital signature / timestamping of exports.
- Scheduled or emailed exports; long-term archival storage.
- Changes to time-entry capture, audit-log generation, or RLS.
- Refactor of existing GET report endpoints.

## Capabilities

### New Capabilities
- `compliance-export`: inspection-ready time-record exports (PDF/Excel) with audit/modification log, RDL 8/2019 fields.
- `employee-schedule-export`: self-service monthly schedule PDF for the requesting employee.

### Modified Capabilities
- None (existing GET reporting endpoints unchanged).

## Approach

- Add three POST routes to `reporting.router.ts` with `requireRole`: time-entries (ADMIN/MANAGER), schedule (any authenticated, scoped to self). MANAGER scoped to own center per existing AC-REP-2 pattern.
- New controller handlers read a JSON body (Zod-validated: dateFrom, dateTo, employeeIds?, format) instead of query params, reusing existing `complianceExport`-style service for entries + audit logs.
- Extend exporters: a richer PDF builder (header/footer/totals/mod-log) and an Excel builder (multi-sheet + audit sheet) rather than overloading the generic `toPdf`/`toXlsx`.
- Frontend: new standalone dialog component using PrimeNG Dialog (already used in cuadrante); schedule button posts self-scoped request.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/.../reporting.router.ts` | Modified | 3 new POST routes |
| `backend/.../reporting.controller.ts` | Modified | New body-based handlers |
| `backend/.../reporting.service.ts` | Modified | Time-record + schedule queries |
| `backend/.../exporters/pdf.ts`, `xlsx.ts` | Modified/New | Compliance + schedule builders |
| `frontend/.../reports/data-access/reports.api.ts` | Modified | POST blob methods |
| `frontend/.../time-tracking/...` | New | Export dialog component + button |
| `frontend/.../shifts/cuadrante.component.ts` | Modified | Schedule export button |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RDL 8/2019 field completeness | Med | Capture mandatory fields (employee, daily start/end, duration, source, mod-log) in spec phase |
| MANAGER scope leak across centers | Med | Reuse existing center-scoping pattern; verify in tests |
| Large date ranges produce huge files | Low | Stream/buffer guard; cap range in validation |

## Rollback Plan

New routes and frontend buttons are additive. Revert the feature commit(s); existing GET reports and exporters are untouched, so no migration or data rollback is needed.

## Dependencies

- `pdfkit ^0.15.2` and `exceljs ^4.4.0` already installed — no new packages.
- Existing audit-log / time-entry data model.

## Success Criteria

- [ ] ADMIN/MANAGER can download a PDF and Excel time record for a date range and employee selection.
- [ ] PDF shows org header, required columns, per-employee totals, and modification log.
- [ ] Excel includes data sheet(s) plus an Audit Log sheet.
- [ ] An employee can download their own monthly schedule PDF from Shifts.
- [ ] MANAGER exports are scoped to their own center; no cross-tenant leakage.
