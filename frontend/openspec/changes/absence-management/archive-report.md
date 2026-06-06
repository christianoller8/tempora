# Archive Report — absence-management

**Archived**: 2026-06-05
**Status**: ARCHIVED
**Verify status**: Skipped by user — build clean, 231/231 backend tests passing

## What was delivered

### Slice 1 — Shared + Backend (T01–T07)
- `packages/shared/src/constants/enums.ts` — added ASUNTOS_PROPIOS, PERMISO_NO_RETRIBUIDO, MATERNIDAD_PATERNIDAD to ABSENCE_TYPE_VALUES
- `packages/shared/src/schemas/absence.schema.ts` — DecisionAbsenceSchema with optional comment, decisionComment in response schema
- `backend/prisma/migrations/20260605000000_add_absence_comment_types/migration.sql` — ALTER TYPE x3 + ADD COLUMN decisionComment
- `backend/src/modules/absences/absences.service.ts` — comment? on approveAbsence/rejectAbsence, requesterEmployeeId ownership guard
- `backend/src/modules/absences/absences.controller.ts` — EMPLOYEE self-scoping on list, comment extraction, ownership forwarding
- `backend/src/modules/absences/absences.service.test.ts` — new tests for new types, comment persistence, ownership guard (+140 lines)
- `backend/src/modules/absences/absences.controller.test.ts` — new controller tests (+200 lines)

### Slice 2 — Frontend (T08–T13)
- `frontend/src/app/features/absences/data-access/absences.api.ts` — decisionComment in AbsenceDto, comment param on approve/reject, from/to on listAbsences
- `frontend/src/app/features/absences/data-access/absences.store.ts` — comment forwarded, type interface updated
- `frontend/src/app/features/absences/feature/absence-request.component.ts` — 9 Spanish type labels, inline decision form with comment textarea, decisionComment displayed in history
- `frontend/src/app/features/shifts/ui/cuadrante-grid.component.ts` — absences signal input, amber absence chips (VAC/BAJA/ASU…), click guard
- `frontend/src/app/features/shifts/feature/cuadrante.component.ts` — month absences loaded in loadAll(), passed to grid

## Test results
- Backend: 231 passing (187 pre-existing + 44 new) / 0 failing
- Frontend: build clean (ng build --no-progress, 0 errors)

## FR Coverage
FR-ABS-20 through FR-ABS-32 — all 13 FRs implemented

## Known deviations
- sdd-verify skipped (user chose direct archive after clean build + test pass)
- FR-ABS-32 partial: orphaned absence-approval.component.ts not wired/removed (deferred per design)
- listAbsences from/to params sent to backend but backend ListAbsencesFilter does not filter by date (client-side clamping per design D6)
- DecisionAbsenceSchema renamed from ApproveAbsenceSchema (old shape was stale, off request path)

## Artifacts Archived

### Spec Artifacts
- `openspec/changes/absence-management/proposal.md` — scope, intent, risks
- `openspec/changes/absence-management/spec.md` — 13 FRs (FR-ABS-20 through FR-ABS-32) with scenarios
- `openspec/changes/absence-management/design.md` — architectural HOW, file layout, migrations, ADR-style decisions
- `openspec/changes/absence-management/tasks.md` — 13 tasks (T01–T13), dependency graph, workload forecast
- `openspec/changes/absence-management/archive-report.md` — this archive record

## Observation IDs (Engram, if captured)
(Not applicable — openspec mode, file-based artifacts)

## Next Phase
None. Change is complete and closed.
