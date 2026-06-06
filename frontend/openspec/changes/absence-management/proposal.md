# Proposal: Absence Management

## Intent

Tempora has a substantially built absence module (GDPR-aware service, controller, router, balance computation, frontend store/API/UI) but it is not complete end-to-end. Gaps: (1) the requested 6 Spanish healthcare absence types are not all present, (2) approve/reject does not support comments, (3) approved absences do not appear in the cuadrante, (4) an employee can list other employees' absences, (5) the approval UI is fragmented (orphaned `absence-approval.component.ts`). This is a gap-closing effort, not a rebuild.

## Scope

### In Scope
- Add missing absence types: `ASUNTOS_PROPIOS`, `PERMISO_NO_RETRIBUIDO`, `MATERNIDAD_PATERNIDAD` (additive; keep existing values).
- Add optional `decisionComment` to approve/reject, persisted and returned.
- Enforce employee self-scoping on list/get at the controller.
- Render APPROVED absences as a layer in `CuadranteGridComponent`.
- Consolidate the request + history + approval UI; capture comment on decision.
- Tests for all new behavior (Strict TDD).

### Out of Scope
- Balance/quota policy changes (22-day constant stays; per-type quotas deferred).
- Cancel workflow, notifications, multi-approver chains, ICS export, date editing post-submit.

## Capabilities

### New Capabilities
- `absence-management`: request lifecycle (create, list-own, approve/reject with comment), Spanish healthcare types, GDPR cause handling, employee self-scoping.
- `cuadrante-absence-overlay`: approved absences rendered as a visual layer over the shift grid.

### Modified Capabilities
- None (no prior openspec specs exist).

## Approach

Contract-first: extend `ABSENCE_TYPE_VALUES` and `AbsenceResponseSchema` in `@tempora/shared`, add `decisionComment` and enum values via Prisma migration (additive, non-destructive). Thread comment through `approveAbsence`/`rejectAbsence`, controller, store, UI. Enforce self-scoping in `handleListAbsences`/`handleGetAbsence` by overriding `employeeId` for EMPLOYEE role. Add an `absences` input to the presentational grid and paint per-type chips on covered days, layering over shifts so coverage conflicts stay visible. `decisionComment` is plaintext (operational), kept separate from the encrypted, audited `cause`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/src/constants/enums.ts` | Modified | New absence types |
| `packages/shared/src/schemas/absence.schema.ts` | Modified | `decisionComment`, comment body |
| `backend/prisma/schema.prisma` | Modified | Enum values + `decisionComment` |
| `backend/src/modules/absences/absences.service.ts` | Modified | Comment threading |
| `backend/src/modules/absences/absences.controller.ts` | Modified | Comment + self-scoping |
| `frontend/.../absences/data-access/*` | Modified | DTO/API/store comment + types |
| `frontend/.../absences/feature/*` | Modified | Comment UI, consolidation |
| `frontend/.../shifts/ui/cuadrante-grid.component.ts` | Modified | Absence layer input |
| `frontend/.../shifts/feature/cuadrante.component.ts` | Modified | Load approved absences |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Enum migration breaks 187 tests | Low | Additive enum values only; run full suite |
| Medical data pasted into plaintext comment | Med | UI hint: comment is operational, not confidential |
| Type reconciliation ambiguity | Med | Keep extra types; resolve naming in spec |

## Rollback Plan

Revert the additive Prisma migration (drop `decisionComment`; enum values are unused if not written). Revert shared/backend/frontend commits. No destructive data change, so rollback is clean.

## Dependencies

- `@tempora/shared` rebuilt before backend/frontend typecheck.

## Success Criteria

- [ ] Employee requests any of 6 types, sees only own history/status.
- [ ] Manager/admin approves or rejects with optional comment; comment persisted and visible.
- [ ] Approved absences render in the cuadrante for affected employee/dates.
- [ ] GDPR invariants intact (cause encrypted, READ-audited, never in list).
- [ ] 187 existing backend tests pass; new behavior covered.
