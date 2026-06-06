# Absence Management — Full Specification

## Purpose

Close the end-to-end gaps in the existing absence module: add missing Spanish healthcare types, persist decision comments, enforce employee self-scoping, render approved absences in the cuadrante grid, and consolidate the approval UI.

---

## Capability: absence-management

### Requirement: FR-ABS-20 — Extended Absence Types

`ABSENCE_TYPE_VALUES` in `@tempora/shared` MUST include `ASUNTOS_PROPIOS`, `PERMISO_NO_RETRIBUIDO`, and `MATERNIDAD_PATERNIDAD` alongside the existing six values.

#### Scenario: New type present in enum

- GIVEN the shared enum constants are imported
- WHEN `ABSENCE_TYPE_VALUES` is inspected
- THEN it contains `ASUNTOS_PROPIOS`, `PERMISO_NO_RETRIBUIDO`, and `MATERNIDAD_PATERNIDAD`

---

### Requirement: FR-ABS-21 — Backend Schemas Accept New Types

`CreateAbsenceSchema` and `UpdateAbsenceSchema` MUST accept the three new absence types without validation error.

#### Scenario: POST with new type

- GIVEN an authenticated user
- WHEN POST /absences is called with `type: "MATERNIDAD_PATERNIDAD"`
- THEN the response status is 201 and the absence is persisted

#### Scenario: Invalid type still rejected

- GIVEN an authenticated user
- WHEN POST /absences is called with `type: "UNKNOWN_TYPE"`
- THEN the response status is 422

---

### Requirement: FR-ABS-22 — Frontend Type Labels

The frontend absence type label map MUST include Spanish display strings for all nine absence types, including `ASUNTOS_PROPIOS`, `PERMISO_NO_RETRIBUIDO`, and `MATERNIDAD_PATERNIDAD`.

#### Scenario: Label for new type renders correctly

- GIVEN the label map is applied in the UI
- WHEN the absence type is `PERMISO_NO_RETRIBUIDO`
- THEN the displayed text is "Permiso No Retribuido" (or an equivalent Spanish label)

---

### Requirement: FR-ABS-23 — Decision Comment Field in DB

The Prisma `Absence` model MUST have a nullable `decisionComment String?` column. The migration MUST be additive — no existing rows are modified. `decisionComment` is plaintext; it MUST NOT be encrypted and MUST NOT appear in AuditLog body diffs.

#### Scenario: Column exists after migration

- GIVEN the migration is applied
- WHEN the `absences` table schema is inspected
- THEN `decision_comment` column exists and is nullable

---

### Requirement: FR-ABS-24 — Approve/Reject Accept Optional Comment

`POST /absences/:id/approve` and `POST /absences/:id/reject` MUST accept an optional `{ comment: string }` body. When provided, the comment MUST be stored in `decisionComment`.

#### Scenario: Approve with comment

- GIVEN a PENDING absence exists
- WHEN PATCH /absences/:id/approve is called with `{ comment: "Approved for August" }`
- THEN the absence transitions to APPROVED and `decisionComment` is "Approved for August"

#### Scenario: Approve without comment

- GIVEN a PENDING absence exists
- WHEN POST /absences/:id/approve is called with no body
- THEN the absence transitions to APPROVED and `decisionComment` is null

---

### Requirement: FR-ABS-25 — AbsenceDto Exposes Decision Comment

`AbsenceResponseSchema` and the corresponding TypeScript DTO MUST include `decisionComment: string | null`.

#### Scenario: GET /absences returns field

- GIVEN an approved absence with a comment
- WHEN GET /absences is called
- THEN each record in the response includes a `decisionComment` field

---

### Requirement: FR-ABS-26 — Decision Comment Visible to Employee

After an absence is approved or rejected with a comment, the employee MUST see that comment in their request history list. The approval/rejection UI MUST render a comment textarea; the field is optional.

#### Scenario: Comment displayed after approval

- GIVEN an absence was approved with comment "Approved, enjoy your holiday"
- WHEN the employee views their absence history
- THEN the comment "Approved, enjoy your holiday" is visible on that request row

#### Scenario: Comment textarea present in decision UI

- GIVEN an ADMIN or MANAGER opens the approval panel for a pending absence
- WHEN the decision form is displayed
- THEN a textarea labeled for optional comment is present

---

### Requirement: FR-ABS-27 — Employee Self-Scoping on List

When `GET /absences` is called by a user with role EMPLOYEE, the response MUST be filtered to only the records where `employeeId` equals the caller's own `user.employeeId`. The EMPLOYEE MUST NOT receive other employees' absence records.

#### Scenario: Employee only sees own records

- GIVEN employee A and employee B each have approved absences
- WHEN employee A calls GET /absences
- THEN the response contains only employee A's absences

#### Scenario: ADMIN sees all records

- GIVEN multiple employees have absences
- WHEN an ADMIN calls GET /absences
- THEN the response contains absences across all employees

---

### Requirement: FR-ABS-28 — EMPLOYEE Cannot Approve or Reject

An EMPLOYEE calling `POST /absences/:id/approve` or `POST /absences/:id/reject` MUST receive a 403 response. The route-level `requireRole(['ADMIN', 'MANAGER'])` guard enforces this.

#### Scenario: Employee attempt to approve returns 403

- GIVEN a PENDING absence exists
- WHEN an EMPLOYEE calls POST /absences/:id/approve
- THEN the response status is 403

---

### Requirement: FR-ABS-29 — Cuadrante Renders Approved Absences

The cuadrante grid MUST render each day covered by an APPROVED absence as a visually distinct cell, colour-coded by type, labelled with the abbreviated type (e.g. "VAC" for VACACIONES, "BAJA" for IT).

#### Scenario: Approved absence appears in grid

- GIVEN an employee has an APPROVED VACACIONES absence covering a date in the displayed month
- WHEN the cuadrante is rendered for that month
- THEN a "VAC" cell appears on that employee's row for the covered date(s)

#### Scenario: PENDING absence not shown in grid

- GIVEN an employee has a PENDING absence
- WHEN the cuadrante is rendered
- THEN no absence cell appears for that employee's pending absence

---

### Requirement: FR-ABS-30 — Absence Cells Are Read-Only in Cuadrante

Absence cells in the cuadrante MUST be visually non-interactive. Clicking an absence cell MUST NOT open the assignment dialog. This applies in all modes (view, edit).

#### Scenario: Click on absence cell does nothing

- GIVEN the cuadrante displays an absence cell
- WHEN the user clicks the absence cell
- THEN the shift-assignment dialog does NOT open

---

### Requirement: FR-ABS-31 — Absence Data Loaded with Cuadrante

When the cuadrante loads or the displayed month changes, APPROVED absence data for that month MUST be fetched alongside shift assignments. This MAY be done via an extended `DashboardApi.load()` or a dedicated `AbsencesApi.listForMonth(year, month)` call.

#### Scenario: Absences fetched on month load

- GIVEN the cuadrante is opened for a given month
- WHEN the data fetch completes
- THEN approved absences for that month are available to the grid component

---

### Requirement: FR-ABS-32 — Role-Appropriate Absence UI at /absences

The `/absences` route MUST render role-appropriate content:
- EMPLOYEE: absence request form + own history
- ADMIN/MANAGER: pending approval queue + full absence list

The orphaned `absence-approval.component.ts` MUST be wired in or replaced so the approval queue is accessible.

#### Scenario: Employee sees request form and own history

- GIVEN a logged-in EMPLOYEE navigates to /absences
- WHEN the page renders
- THEN the request form and their own absence history are visible; no approval queue is shown

#### Scenario: Admin sees approval queue

- GIVEN a logged-in ADMIN navigates to /absences
- WHEN the page renders
- THEN the pending approval queue panel is visible

---

## Data Contract Decisions

| Decision | Value |
|----------|-------|
| `decisionComment` nullability | Nullable in DB (`String?`); returned as `string \| null` in DTO |
| `decisionComment` sensitivity | Plaintext — NOT encrypted, NOT in AuditLog body diff |
| New type balance impact | `ASUNTOS_PROPIOS`, `PERMISO_NO_RETRIBUIDO`, `MATERNIDAD_PATERNIDAD` do NOT consume vacation balance; only `VACACIONES` counts against the 22-day quota |
| Employee CREATE scoping | EMPLOYEE MAY only create absences for their own `employeeId`; service/controller MUST override `employeeId` from `user.employeeId` when caller is EMPLOYEE |
| Migration strategy | Additive only: new enum values + `decisionComment` column added; no existing Absence rows modified |
| `cause` field invariant | Unchanged — GDPR special-category, encrypted, READ-audited, never in list results |

---

## Out of Scope

- Balance/quota tracking for new absence types
- Calendar UI view (cuadrante renders grid cells only, not a calendar overlay)
- Email or push notifications on approve/reject
- Bulk approve/reject operations
- Cancel workflow, multi-approver chains, ICS export, post-submit date editing
