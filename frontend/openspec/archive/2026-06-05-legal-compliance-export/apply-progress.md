# Apply Progress: legal-compliance-export — Slice 1

Updated: 2026-06-04

## Status: Slice 1 complete (T01–T07)

## Completed Tasks

- [x] T01 — compliance-pdf.builder.ts (CREATE) — 7 tests passing
- [x] T02 — compliance-xlsx.builder.ts (CREATE) — 11 tests passing
- [x] T03 — schedule-pdf.builder.ts (CREATE) — 5 tests passing
- [x] T04 — reporting.service.ts (MODIFY) — DTOs + collectComplianceExport + collectScheduleExport; existing 16 tests still passing
- [x] T05 — reporting.controller.ts (MODIFY) — handleTimeEntriesPdf, handleTimeEntriesExcel, handleSchedulePdf
- [x] T06 — reporting.router.ts (MODIFY) — 3 POST routes with requireRole guards
- [x] T07 — Zod schemas (inline in controller) — timeEntriesBody + scheduleBody with cross-field refinements

## Files Created

- `backend/src/modules/reporting/builders/compliance-pdf.builder.ts` (~155 lines)
- `backend/src/modules/reporting/builders/compliance-xlsx.builder.ts` (~85 lines)
- `backend/src/modules/reporting/builders/schedule-pdf.builder.ts` (~80 lines)
- `backend/src/modules/reporting/builders/compliance-pdf.builder.test.ts` (~90 lines, 7 tests)
- `backend/src/modules/reporting/builders/compliance-xlsx.builder.test.ts` (~120 lines, 11 tests)
- `backend/src/modules/reporting/builders/schedule-pdf.builder.test.ts` (~65 lines, 5 tests)

## Files Modified

- `backend/src/modules/reporting/reporting.service.ts` (+5 exported interfaces + 2 functions ~165 lines added)
- `backend/src/modules/reporting/reporting.controller.ts` (+imports + 2 Zod schemas + 3 handler functions ~145 lines added)
- `backend/src/modules/reporting/reporting.router.ts` (+3 POST routes ~20 lines added)

## TypeScript Check

Zero new errors. Pre-existing `seed.ts` rootDir error unaffected.

## Test Results

23 builder tests: 3 passed, 23/23
16 service tests: all still passing

## Remaining

Slice 2 (T08–T12) — frontend work, separate PR.
