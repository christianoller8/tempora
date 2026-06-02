# Tempora Core — Specification

**Change:** tempora-core
**Date:** 2026-05-31
**Status:** approved
**Based on:** proposal.md (2026-05-31)

All capabilities are NEW (greenfield). No MODIFIED or REMOVED sections required.
RFC 2119 keywords (MUST, MUST NOT, SHOULD, MAY) are used per https://www.rfc-editor.org/rfc/rfc2119.

---

## Capability: iam-auth

### Purpose

Provides identity verification, token issuance, token revocation, and role-based access control for all system users. Satisfies the security requirement that a terminated employee's access is revoked immediately and that short-lived tokens minimize the blast radius of credential leakage.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-AUTH-1 | The system MUST issue a signed JWT access token (≤15 min TTL) and a 7-day httpOnly, Secure, SameSite=Strict refresh cookie on successful login. |
| FR-AUTH-2 | The access token MUST embed `jti`, `organization_id`, and `role` claims. |
| FR-AUTH-3 | The system MUST check the `token_blocklist` table on every refresh request and MUST reject blocklisted tokens without issuing a new token. |
| FR-AUTH-4 | The system MUST add the token `jti` to `token_blocklist` on logout, role change, and employee termination. |
| FR-AUTH-5 | The system MUST verify the role claim on every protected route; requests with insufficient role MUST receive HTTP 403. |
| FR-AUTH-6 | The system MUST verify the `organization_id` claim matches the requested tenant scope on every protected route; mismatches MUST receive HTTP 403. |
| FR-AUTH-7 | Passwords MUST be hashed with argon2 or bcrypt before storage; plaintext passwords MUST NOT be persisted. |
| FR-AUTH-8 | The refresh flow MUST include CSRF protection (double-submit cookie or signed header). |
| FR-AUTH-9 | Expired `token_blocklist` rows SHOULD be purged periodically without affecting active revocations. |
| FR-AUTH-10 | The system MUST expose `GET /auth/me` returning the authenticated user's profile and role. |

### Acceptance Criteria

**AC-AUTH-1: Successful login**
- GIVEN a registered user with valid credentials
- WHEN `POST /auth/login` is called with correct email and password
- THEN the response MUST include an access JWT with `jti`, `organization_id`, `role` claims
- AND the response MUST set an httpOnly, Secure, SameSite=Strict refresh cookie

**AC-AUTH-2: Access token expiry**
- GIVEN an expired access token
- WHEN any protected endpoint is called
- THEN the system MUST return HTTP 401

**AC-AUTH-3: Silent refresh**
- GIVEN a valid refresh cookie and an expired access token
- WHEN `POST /auth/refresh` is called
- THEN the system MUST return a new access token
- AND the old `jti` MUST NOT be blocklisted (only logout/termination blocklists)

**AC-AUTH-4: Logout revocation**
- GIVEN an authenticated user
- WHEN `POST /auth/logout` is called
- THEN the current `jti` MUST be added to `token_blocklist`
- AND a subsequent `/auth/refresh` using the same refresh cookie MUST return HTTP 401

**AC-AUTH-5: Forced revocation on termination**
- GIVEN an active employee with an open session
- WHEN the employee record is marked terminated by an admin
- THEN the current access and refresh token `jti` values MUST be blocklisted immediately
- AND the next API call from that session MUST return HTTP 401

**AC-AUTH-6: Role-based denial**
- GIVEN a user with role `employee`
- WHEN a route restricted to `admin` or `manager` is called
- THEN the system MUST return HTTP 403

**AC-AUTH-7: Blocklisted refresh rejected**
- GIVEN a `jti` present in `token_blocklist`
- WHEN `POST /auth/refresh` is called with that token
- THEN the system MUST return HTTP 401 without issuing a new token

### Constraints & Edge Cases

- `User` is the auth entity; `Employee` is the HR entity. Admin users MAY exist without a linked employee record.
- The refresh cookie MUST NOT be readable by JavaScript (`httpOnly`).
- The blocklist check MUST occur before any new token is minted — never after.
- Manager scope is CENTER-scoped, not org-wide; the role guard alone is insufficient — a tenant guard must also verify center membership.
- `GET /auth/me` MUST be protected; unauthenticated requests MUST receive HTTP 401.

---

## Capability: audit-compliance

### Purpose

Provides an immutable, append-only audit trail for all mutations and special-category data reads, satisfying Art. 34.9 ET, RD-ley 8/2019 (4-year retention), the 2026 digital-only/unalterable records reform, and GDPR Art. 9 access logging obligations.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-AUDIT-1 | The system MUST write an `AuditLog` row for every mutation of: `TimeEntry`, `TimeCorrection`, `Absence`, `Employee`, `ShiftAssignment`, `ShiftSchedule` (publish), and approval state changes. |
| FR-AUDIT-2 | Each `AuditLog` row MUST record: `actor` (user id), `action`, `entityType`, `entityId`, `before` (JSON), `after` (JSON), `ip`, `timestamp`. |
| FR-AUDIT-3 | The database role used by the application MUST have INSERT privilege only on `AuditLog`; UPDATE and DELETE MUST be denied at the database level. |
| FR-AUDIT-4 | The system MUST write an `AuditLog` row (action=`READ`, entityType=`SpecialCategory`) on every read of GDPR special-category fields (IT sick-leave cause, health conditions). Legal basis: GDPR Art. 9 / LO 3/2018. |
| FR-AUDIT-5 | RLS policy MUST enforce `organization_id = current_setting('app.current_org')` on `AuditLog`, ensuring cross-tenant queries return zero rows. |
| FR-AUDIT-6 | `AuditLog` rows MUST be retained for a minimum of 4 years. Purge jobs MUST NOT delete rows within the retention window. Legal basis: RD-ley 8/2019. |
| FR-AUDIT-7 | The system MUST set `app.current_org` within a Prisma transaction before any tenant query; queries running outside tenant context MUST return zero rows (fail-closed). |
| FR-AUDIT-8 | Super-admin cross-tenant operations MUST use a dedicated, audited bypass role and MUST produce their own `AuditLog` rows. |

### Acceptance Criteria

**AC-AUDIT-1: Mutation produces audit row**
- GIVEN an authenticated manager
- WHEN a `TimeEntry` clock-out is submitted
- THEN exactly one `AuditLog` row MUST be inserted with the correct `actor`, `entityType=TimeEntry`, `entityId`, and `after` payload

**AC-AUDIT-2: Cross-tenant isolation**
- GIVEN two organizations A and B
- WHEN org B's session queries `AuditLog`
- THEN zero rows from org A MUST be returned

**AC-AUDIT-3: Special-category read logged**
- GIVEN a manager with permission to view IT absence cause
- WHEN the IT cause field is read
- THEN an `AuditLog` row with `action=READ`, `entityType=SpecialCategory` MUST be inserted before the response is returned

**AC-AUDIT-4: No UPDATE/DELETE on AuditLog**
- GIVEN any application database role
- WHEN an UPDATE or DELETE is attempted on `AuditLog`
- THEN the database MUST reject the operation with a permission error

**AC-AUDIT-5: Retention guard**
- GIVEN an `AuditLog` row with a timestamp within the last 4 years
- WHEN a retention purge job runs
- THEN that row MUST NOT be deleted

**AC-AUDIT-6: Fail-closed without tenant context**
- GIVEN a database session where `app.current_org` has NOT been set
- WHEN any query is run against a tenant table
- THEN the query MUST return zero rows

### Constraints & Edge Cases

- Audit writes MUST be atomic with the business mutation — both succeed or both fail.
- The `before` snapshot MUST be captured before the mutation executes; `after` must be captured after.
- If the audit write fails, the business mutation MUST also be rolled back.
- `AuditLog` has no `organization_id` RLS bypass for inspector export — that path requires an explicit super-admin role with its own audit trail.

---

## Capability: organization-structure

### Purpose

Models the tenant hierarchy (Organization → Center → Department/Unit) that scopes all other entities, enforcing multi-tenancy from the data model outward.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-ORG-1 | The system MUST support three hierarchy levels: `Organization` (tenant root), `Center` (physical facility), and `Department`/`Unit` within a center. |
| FR-ORG-2 | Every tenant-owned entity MUST carry a non-null `organization_id` foreign key. |
| FR-ORG-3 | Only users with role `admin` MUST be permitted to create, update, or delete organizations, centers, and departments. |
| FR-ORG-4 | A `manager` MUST be able to read centers and departments within their own organization. |
| FR-ORG-5 | The system MUST prevent a manager from reading or modifying centers belonging to a different organization. |
| FR-ORG-6 | Deleting a center MUST be blocked if active employees or future shift assignments reference it. |
| FR-ORG-7 | The system SHOULD support soft-delete for centers and departments; hard-delete MUST NOT be available via the API. |

### Acceptance Criteria

**AC-ORG-1: Admin creates center**
- GIVEN an admin user in organization A
- WHEN `POST /centers` is called with a valid center payload
- THEN the center MUST be created with `organization_id` = A
- AND the response MUST include the new center's `id`

**AC-ORG-2: Admin adds department to center**
- GIVEN an admin and an existing center
- WHEN `POST /centers/:id/departments` is called
- THEN the department MUST be created linked to that center and organization

**AC-ORG-3: Manager cannot access other org's centers**
- GIVEN a manager in organization A
- WHEN `GET /centers` is called
- THEN only centers belonging to organization A MUST be returned

**AC-ORG-4: Employee role denied write access**
- GIVEN a user with role `employee`
- WHEN `POST /centers` is called
- THEN the system MUST return HTTP 403

**AC-ORG-5: Delete blocked by dependency**
- GIVEN a center with at least one active employee assignment
- WHEN `DELETE /centers/:id` is called
- THEN the system MUST return HTTP 409 with a descriptive error

### Constraints & Edge Cases

- `organization_id` MUST be non-nullable and non-updatable after record creation.
- RLS enforces tenant isolation at the DB layer; application-layer `WHERE organization_id = ?` is additional defense-in-depth.
- An `Organization` record is the trust anchor — its `id` flows into every downstream table.

---

## Capability: employee-management

### Purpose

Manages employee profiles, healthcare category classifications, contract types (including part-time hour tracking), working calendars, and center assignments — the HR master data required by all shift, time-tracking, absence, and reporting features.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-EMP-1 | Each `Employee` record MUST have: `firstName`, `lastName`, `category` (healthcare taxonomy), `contractType`, `primaryCenterId`, `organizationId`. |
| FR-EMP-2 | Part-time employees (`contractType = tiempo_parcial`) MUST have `contractedHoursPerWeek > 0`. |
| FR-EMP-3 | Every employee MUST have exactly one `primaryCenterId`; this field MUST NOT be null. |
| FR-EMP-4 | An employee MAY be assigned shifts at centers other than their primary center. |
| FR-EMP-5 | Each employee MUST be assigned a `WorkingCalendar` defining annual jornada and public holidays (festivos). |
| FR-EMP-6 | Only `admin` users MUST be permitted to create or update employee records. |
| FR-EMP-7 | `Manager` users MUST be able to read employees within their own organization. |
| FR-EMP-8 | Employee records MUST support soft-delete (termination); terminated employees MUST NOT be listed in active employee queries by default. |
| FR-EMP-9 | On employee termination, the system MUST trigger forced token revocation (see FR-AUTH-4). |
| FR-EMP-10 | The system MUST expose `GET /employees/:id/contract` returning current contract details. |

### Acceptance Criteria

**AC-EMP-1: Admin creates employee**
- GIVEN an admin in organization A
- WHEN `POST /employees` is called with category, contractType, and primaryCenterId
- THEN an employee record MUST be created with `organization_id` = A

**AC-EMP-2: Part-time validation**
- GIVEN an admin creating a part-time employee
- WHEN `contractedHoursPerWeek` is omitted or zero
- THEN the system MUST return HTTP 422 with a descriptive validation error

**AC-EMP-3: Primary center required**
- GIVEN an admin creating an employee
- WHEN `primaryCenterId` is not provided
- THEN the system MUST return HTTP 422

**AC-EMP-4: Multi-center shifts allowed**
- GIVEN an employee with primaryCenterId = C1
- WHEN a shift assignment is created for center C2 within the same organization
- THEN the assignment MUST be persisted without error

**AC-EMP-5: Manager read scope**
- GIVEN a manager in organization A
- WHEN `GET /employees` is called
- THEN only employees belonging to organization A MUST be returned

**AC-EMP-6: Termination triggers revocation**
- GIVEN an employee with an active session
- WHEN an admin sets the employee's `status` to `terminated`
- THEN the employee's active tokens MUST be blocklisted and the employee's session MUST be invalidated

### Constraints & Edge Cases

- `category` MUST be drawn from the defined Spanish socio-healthcare taxonomy (TCAE, enfermero/a, médico/a, celador/a, etc.); free-text categories MUST NOT be accepted.
- `WorkingCalendar` MUST be assigned before any shift or time-entry operations are valid for that employee.
- Terminated employees MUST be retained in the database (soft-delete only) for audit purposes.

---

## Capability: shift-management

### Purpose

Enables managers to define reusable shift templates, build rotation patterns, assign shifts to employees in a monthly cuadrante, publish it to staff, and manage swap requests — covering the core operational workflow of a Spanish healthcare scheduler.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-SHIFT-1 | The system MUST support `ShiftTemplate` records with: name, startTime, endTime, and optional category requirements. |
| FR-SHIFT-2 | The system MUST support `RotationPattern` records defining recurring cycle definitions (e.g., 5-on-2-off, 3-shift nursing rotation). |
| FR-SHIFT-3 | The system MUST support `ShiftSchedule` (cuadrante) with status `draft` or `published`, scoped to a center, unit, and month. |
| FR-SHIFT-4 | A cuadrante MUST NOT be published if it contains assignments that violate the organization's active `RuleSet` (BLOCK-level violations). |
| FR-SHIFT-5 | Once published, a cuadrante MUST be immutable; corrections MUST be made via a new version or amendment record, not by editing the published record. |
| FR-SHIFT-6 | Only `admin` and `manager` (own center) users MUST be permitted to create and publish cuadrantes. |
| FR-SHIFT-7 | On cuadrante publish, the system MUST fan out a notification to all employees assigned within that schedule. |
| FR-SHIFT-8 | An employee MAY submit a `SwapRequest` targeting a specific `ShiftAssignment` of another employee. |
| FR-SHIFT-9 | A `SwapRequest` MUST be approved or rejected by a `manager` or `admin`. |
| FR-SHIFT-10 | Swap approval MUST trigger notifications to both the requester and the target employee. |
| FR-SHIFT-11 | The system MUST validate swap proposals against the `RuleSet` before approval; BLOCK-level violations MUST prevent approval. |

### Acceptance Criteria

**AC-SHIFT-1: Manager builds cuadrante**
- GIVEN a manager for center C
- WHEN `POST /schedules` is called with center, unit, and month
- THEN a cuadrante in `draft` status MUST be created

**AC-SHIFT-2: Cuadrante publish**
- GIVEN a draft cuadrante with no BLOCK-level rule violations
- WHEN `POST /schedules/:id/publish` is called
- THEN the cuadrante status MUST change to `published`
- AND all assigned employees MUST receive a notification

**AC-SHIFT-3: Published cuadrante is immutable**
- GIVEN a published cuadrante
- WHEN a direct edit to an assignment within it is attempted
- THEN the system MUST return HTTP 409 and the assignment MUST NOT be changed

**AC-SHIFT-4: Publish blocked by rule violation**
- GIVEN a draft cuadrante containing an assignment that violates 12h rest (BLOCK-level)
- WHEN `POST /schedules/:id/publish` is called
- THEN the system MUST return HTTP 422 listing the violated rules

**AC-SHIFT-5: Employee swap request**
- GIVEN employee A and employee B with assignments in the same organization
- WHEN employee A submits `POST /swaps` referencing B's assignment
- THEN a `SwapRequest` in `pending` status MUST be created

**AC-SHIFT-6: Manager approves swap**
- GIVEN a pending `SwapRequest` with no BLOCK-level rule violations after swap
- WHEN a manager calls `POST /swaps/:id/approve`
- THEN the assignments MUST be exchanged
- AND both employees MUST receive a notification

**AC-SHIFT-7: Swap blocked by rule violation**
- GIVEN a pending `SwapRequest` that would create a sub-12h rest violation for employee B
- WHEN a manager attempts approval
- THEN the system MUST return HTTP 422 and the swap MUST NOT be applied

### Constraints & Edge Cases

- Published cuadrante immutability is enforced at application and optionally at DB level.
- Managers MUST only be able to publish cuadrantes for their own center; cross-center publication requires `admin` role.
- `SwapRequest` MUST record both the requester assignment and the target assignment at creation time — changes to either after submission MUST NOT retroactively alter the pending request.

---

## Capability: time-tracking

### Purpose

Implements the mandatory daily clock-in/out registro de jornada with server-authoritative timestamps, an immutable append-only record model, a manager-approved correction workflow, and overtime tracking — satisfying Art. 34.9 ET, RD-ley 8/2019, and the 2026 digital-only unalterable-records reform.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-TIME-1 | Clock-in and clock-out timestamps MUST be server-authoritative; client-provided times MUST NOT be used as the legal record. Legal basis: 2026 control-horario reform. |
| FR-TIME-2 | `TimeEntry` rows MUST be INSERT-only; UPDATE and DELETE on `TimeEntry` MUST be denied at the database level. |
| FR-TIME-3 | The system MUST prevent an employee from clocking in when they already have an open (non-closed) `TimeEntry` for the day. |
| FR-TIME-4 | The system MUST flag any `TimeEntry` where effective working time exceeds 9 hours (Art. 34.3 ET) with an `overtime` marker. |
| FR-TIME-5 | Time corrections MUST be submitted as `TimeCorrection` records linked to the original `TimeEntry`, with a mandatory justification field. |
| FR-TIME-6 | `TimeCorrection` records MUST follow an approval workflow: `pending` → `approved` | `rejected` by a manager or admin. |
| FR-TIME-7 | Approved corrections MUST produce an `AuditLog` row recording the correcting actor, original values, and corrected values. |
| FR-TIME-8 | The system MUST maintain a running `OvertimeEntry` accumulator per employee per year; entries MUST be updated on each clock-out. |
| FR-TIME-9 | The system MUST expose a live SSE event when an employee clocks in or out, scoped to the organization (for the live dashboard). |
| FR-TIME-10 | `GET /time-entries` MUST support filtering by employee, date range, and approval status. |

### Acceptance Criteria

**AC-TIME-1: Clock-in**
- GIVEN an employee with no open TimeEntry today
- WHEN `POST /time-entries/clock-in` is called
- THEN a `TimeEntry` row MUST be inserted with a server-generated `clockIn` timestamp

**AC-TIME-2: Clock-out**
- GIVEN an employee with an open TimeEntry
- WHEN `POST /time-entries/clock-out` is called
- THEN the `TimeEntry` MUST be closed by inserting a linked record with a server-generated `clockOut` timestamp
- AND if effective hours > 9, the entry MUST be flagged with `overtime = true`

**AC-TIME-3: Duplicate clock-in prevented**
- GIVEN an employee who has already clocked in today with no clock-out
- WHEN `POST /time-entries/clock-in` is called again
- THEN the system MUST return HTTP 409

**AC-TIME-4: TimeEntry immutability**
- GIVEN any existing `TimeEntry` row
- WHEN an UPDATE or DELETE is attempted via any application database role
- THEN the database MUST reject the operation

**AC-TIME-5: Correction request**
- GIVEN an employee with a closed TimeEntry
- WHEN `POST /time-corrections` is called with the original entry id and a justification
- THEN a `TimeCorrection` in `pending` status MUST be created

**AC-TIME-6: Manager approves correction**
- GIVEN a pending `TimeCorrection`
- WHEN a manager calls `POST /time-corrections/:id/approve`
- THEN the correction status MUST change to `approved`
- AND an `AuditLog` row MUST be inserted recording the change

**AC-TIME-7: Overtime accumulator updated**
- GIVEN an employee whose year-to-date overtime hours total 75
- WHEN a clock-out produces 6 more overtime hours
- THEN the `OvertimeEntry` accumulator MUST reflect 81 total hours
- AND the Rules Engine MUST be invoked and MAY flag the 80h annual cap violation

**AC-TIME-8: Live dashboard SSE event**
- GIVEN a manager with an active SSE connection
- WHEN any employee in that organization clocks in
- THEN an SSE event MUST be delivered to the manager's stream within 2 seconds

### Constraints & Edge Cases

- Server-authoritative time is the LEGAL record; client capture time MAY be stored as metadata only.
- The `TimeEntry` append-only model extends to the correction system — the original entry is never modified; only linked correction records exist.
- Open entries (clocked in, no clock-out) at midnight MUST be handled gracefully — the system SHOULD flag them for manager review without auto-closing.

---

## Capability: rules-engine

### Purpose

Provides a stateless, per-organization configurable validation service that enforces Spanish labor law constraints (Art. 34.3 ET, Art. 35.2 ET, Art. 37.1 ET) and collective-agreement (convenio) parameters. Results are consumed synchronously by Shifts and TimeTracking before any state mutation.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-RULES-1 | The Rules Engine MUST be a pure, stateless domain service; it MUST NOT write to the database or produce side effects. |
| FR-RULES-2 | The system MUST support per-organization `RuleSet` configuration covering: minimum rest between shifts (default 12h, Art. 34.3 ET), maximum daily hours (default 9h, Art. 34.3 ET), maximum annual overtime (default 80h, Art. 35.2 ET), minimum weekly rest (default 36h consecutive, Art. 37.1 ET), and convenio-specific overrides. |
| FR-RULES-3 | Rule evaluation MUST return one of two severities: `BLOCK` (hard — the operation MUST be rejected) or `WARN` (soft — the operation MAY proceed with acknowledgment). |
| FR-RULES-4 | Rule parameters MUST be configurable per organization; hardcoded constants MUST NOT be used in rule logic. |
| FR-RULES-5 | The system MUST validate shift assignments against the active `RuleSet` before persisting them. |
| FR-RULES-6 | The system MUST validate time entries against the active `RuleSet` on clock-out. |
| FR-RULES-7 | When a BLOCK result is returned, the calling operation MUST be rejected with HTTP 422 and the violated rules listed in the response. |
| FR-RULES-8 | When a WARN result is returned, the calling operation MAY proceed; the warning MUST be included in the response body. |

### Acceptance Criteria

**AC-RULES-1: 12h rest violation blocks shift assignment**
- GIVEN an org with a `RuleSet` requiring 12h minimum rest
- AND an employee's previous shift ends at 23:00
- WHEN a shift assignment starting at 07:00 the next day (8h gap) is created
- THEN the Rules Engine MUST return `BLOCK`
- AND the shift assignment MUST NOT be persisted

**AC-RULES-2: Org-specific rest override**
- GIVEN an org whose `RuleSet` overrides minimum rest to 10h (valid convenio provision)
- AND an employee's previous shift ends at 23:00
- WHEN a shift assignment starting at 09:00 the next day (10h gap) is created
- THEN the Rules Engine MUST return no BLOCK for the rest constraint

**AC-RULES-3: Overtime cap warning**
- GIVEN an employee with 78h annual overtime
- WHEN a clock-out produces 3 more overtime hours (total 81h)
- THEN the Rules Engine MUST return `BLOCK` for the 80h annual cap violation (Art. 35.2 ET)

**AC-RULES-4: Weekly rest violation**
- GIVEN a shift schedule where an employee has no consecutive 36h rest in a calendar week
- WHEN the schedule is validated
- THEN the Rules Engine MUST return `BLOCK` referencing Art. 37.1 ET

**AC-RULES-5: Pure function — no side effects**
- GIVEN any call to the Rules Engine
- WHEN it evaluates any number of rules
- THEN no database rows MUST be inserted, updated, or deleted as a result

**AC-RULES-6: WARN does not block**
- GIVEN a rule configured as `WARN` severity in the org's `RuleSet`
- WHEN the rule condition is triggered
- THEN the operation MUST succeed and the response MUST include the warning

### Constraints & Edge Cases

- Rule parameters are read from the org's `RuleSet` at the time of evaluation; cached values SHOULD be invalidated when `RuleSet` is updated.
- The Rules Engine MUST handle missing or incomplete `RuleSet` gracefully by falling back to statutory defaults.
- Rule evaluation order MUST be deterministic; multiple violations MUST all be reported in a single response, not short-circuited.

---

## Capability: absence-management

### Purpose

Manages all absence and leave types (vacaciones, IT, permisos retribuidos, lactancia, reducción de jornada), including request and approval workflows, balance tracking, and GDPR-compliant handling of special-category health data.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-ABS-1 | The system MUST support the following absence types: `vacaciones`, `IT` (incapacidad temporal), `permiso_retribuido` (Art. 37 ET), `ausencia_injustificada`, `lactancia`, `reduccion_jornada`. |
| FR-ABS-2 | Absence requests MUST follow an approval workflow: `pending` → `approved` | `rejected` by a manager or admin. |
| FR-ABS-3 | `IT` (sick leave) absences MAY be created directly by a manager or admin on behalf of an employee. |
| FR-ABS-4 | The `IT` absence cause field MUST be treated as GDPR special-category data (Art. 9 GDPR / LO 3/2018); every read of this field MUST produce an `AuditLog` access entry. |
| FR-ABS-5 | The system MUST maintain an absence balance per employee per year for `vacaciones`. |
| FR-ABS-6 | Approved absences MUST be visible in shift coverage reports to flag understaffing. |
| FR-ABS-7 | The system MUST expose `GET /absences/balance` returning the requesting employee's current leave balance. |
| FR-ABS-8 | Absence data MUST be retained for a minimum of 4 years. |

### Acceptance Criteria

**AC-ABS-1: Employee requests vacation**
- GIVEN an employee with available vacation balance
- WHEN `POST /absences` is called with type=`vacaciones` and date range
- THEN an absence record in `pending` status MUST be created

**AC-ABS-2: Manager approves vacation**
- GIVEN a pending `vacaciones` absence
- WHEN a manager calls `POST /absences/:id/approve`
- THEN the absence status MUST change to `approved`
- AND the employee's vacation balance MUST be decremented accordingly

**AC-ABS-3: Manager creates IT absence**
- GIVEN a manager with permission
- WHEN `POST /absences` is called with type=`IT` for an employee
- THEN the absence MUST be created in `approved` status (no secondary approval required for IT)

**AC-ABS-4: IT cause read is access-logged**
- GIVEN a manager reading an IT absence that includes a cause field
- WHEN `GET /absences/:id` returns the IT cause
- THEN an `AuditLog` row with `action=READ`, `entityType=SpecialCategory` MUST be inserted

**AC-ABS-5: Absence impacts coverage report**
- GIVEN an approved absence for employee E on date D in unit U
- WHEN the coverage report for unit U on date D is generated
- THEN employee E MUST be shown as absent and the shift MUST be flagged as uncovered if no replacement is assigned

**AC-ABS-6: Insufficient balance**
- GIVEN an employee with 0 remaining vacation days
- WHEN `POST /absences` is called with type=`vacaciones`
- THEN the system MUST return HTTP 422

### Constraints & Edge Cases

- IT cause field MUST NOT be included in aggregated/anonymized report exports.
- `lactancia` and `reduccion_jornada` affect daily working hours, not full-day absences — the system MUST support partial-day absence records.
- Overlapping absences for the same employee MUST be rejected at creation time.

---

## Capability: notifications-sse

### Purpose

Delivers real-time server-to-client push notifications via Server-Sent Events for operational events (cuadrante publication, shift swap approvals, clock-in activity), scoped by organization, user, and role.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-NOTIF-1 | The system MUST expose `GET /notifications/stream` as an SSE endpoint; connections MUST be authenticated via the access JWT. |
| FR-NOTIF-2 | Each SSE connection MUST be scoped to the authenticated user's `organization_id`; events from other organizations MUST NOT be delivered. |
| FR-NOTIF-3 | The SSE hub MUST support fan-out by `organization_id`, `userId`, and `role`. |
| FR-NOTIF-4 | On cuadrante publish, the system MUST emit an event to all employees assigned in that schedule within the organization. |
| FR-NOTIF-5 | On swap approval, the system MUST emit an event to both the requester and the target employee. |
| FR-NOTIF-6 | The SSE stream MUST include `id` (event id) to support `Last-Event-ID` reconnection. |
| FR-NOTIF-7 | On client reconnection with `Last-Event-ID`, the system MUST replay any missed events since that id. |
| FR-NOTIF-8 | Notification records MUST be persisted and queryable via `GET /notifications`. |
| FR-NOTIF-9 | Users MUST be able to mark notifications as read via `PATCH /notifications/:id/read`. |

### Acceptance Criteria

**AC-NOTIF-1: Authenticated SSE connection**
- GIVEN an authenticated employee
- WHEN `GET /notifications/stream` is called with a valid access token
- THEN the connection MUST be established and kept open with `Content-Type: text/event-stream`

**AC-NOTIF-2: Unauthenticated connection rejected**
- GIVEN no access token
- WHEN `GET /notifications/stream` is called
- THEN the system MUST return HTTP 401 and close the connection

**AC-NOTIF-3: Cuadrante publish fan-out**
- GIVEN employees E1 and E2 assigned in cuadrante C, and employee E3 not assigned
- WHEN a manager publishes C
- THEN E1 and E2 MUST receive an SSE event; E3 MUST NOT receive the event

**AC-NOTIF-4: Swap approval notification**
- GIVEN a pending swap between employee A and employee B
- WHEN the swap is approved
- THEN both A and B MUST receive an SSE event within 2 seconds

**AC-NOTIF-5: Cross-org isolation**
- GIVEN employee from org A and employee from org B on separate SSE connections
- WHEN an event is emitted for org A
- THEN only org A's employee MUST receive it

**AC-NOTIF-6: Reconnect with Last-Event-ID**
- GIVEN a client that disconnected after receiving event id=42
- WHEN the client reconnects with `Last-Event-ID: 42`
- THEN any events with id > 42 MUST be replayed

### Constraints & Edge Cases

- SSE connections are one per authenticated user; multiple tabs from the same user each get their own stream (HTTP/1.1 limit of ~6 connections per domain is acceptable for a single-tab back-office app).
- The in-process fan-out hub MUST be replaceable with a Redis pub/sub adapter without changing the SSE endpoint interface.
- Missed-event replay MUST only return events within the same `organization_id` as the reconnecting user.

---

## Capability: reporting

### Purpose

Provides HR-grade reports covering hours worked, overtime, absenteeism, and shift coverage gaps, with PDF and XLSX export, scoped to the authenticated user's role and center, with 4-year data retention.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-REP-1 | The system MUST provide a monthly hours report per employee including regular hours, overtime hours, and part-time deviation (contracted vs actual). |
| FR-REP-2 | The system MUST provide an overtime report per employee per year showing the running total against the 80h cap. |
| FR-REP-3 | The system MUST provide an absenteeism report showing absence days by type per employee per period. |
| FR-REP-4 | The system MUST provide a coverage gaps report showing shifts with insufficient staffing or uncovered absences. |
| FR-REP-5 | All reports MUST support export in both PDF and XLSX formats via `?format=pdf|xlsx`. |
| FR-REP-6 | Report data MUST reflect only approved time entries and approved absences; pending records MUST be excluded. |
| FR-REP-7 | `Manager` users MUST be restricted to reports for their own center; `admin` users MAY access org-wide reports. |
| FR-REP-8 | Aggregated reports MUST anonymize individual records where possible (GDPR data minimization). |
| FR-REP-9 | Report data MUST be retained and queryable for a minimum of 4 years. Legal basis: RD-ley 8/2019. |
| FR-REP-10 | Special-category fields (IT cause) MUST NOT appear in any report export. |

### Acceptance Criteria

**AC-REP-1: Monthly hours export (XLSX)**
- GIVEN an admin user
- WHEN `GET /reports/monthly-hours?year=2026&month=4&format=xlsx` is called
- THEN a valid XLSX file MUST be returned containing one row per employee with regular hours, overtime hours, and contracted vs actual deviation

**AC-REP-2: Manager scoped to own center**
- GIVEN a manager scoped to center C
- WHEN `GET /reports/monthly-hours` is called
- THEN only employees assigned to center C MUST appear in the report

**AC-REP-3: Pending records excluded**
- GIVEN an employee with one approved and one pending TimeEntry in the period
- WHEN the monthly hours report is generated
- THEN only the approved entry MUST be included in the hour totals

**AC-REP-4: Overtime cap visibility**
- GIVEN an employee who has accrued 82h overtime in the year
- WHEN the overtime report is requested
- THEN the report MUST show 82h and flag the 80h legal cap as exceeded

**AC-REP-5: Coverage gaps**
- GIVEN a shift on date D in unit U where an employee is absent with no replacement
- WHEN the coverage report for that period is generated
- THEN that shift MUST appear as a coverage gap

**AC-REP-6: IT cause absent from export**
- GIVEN an employee with IT absences including a cause field
- WHEN any report is exported in any format
- THEN the IT cause field MUST NOT appear in the export

**AC-REP-7: PDF export valid**
- GIVEN an admin
- WHEN `GET /reports/absenteeism?format=pdf` is called
- THEN a valid, non-empty PDF MUST be returned with correct Content-Type header

### Constraints & Edge Cases

- Part-time deviation is calculated as `(actual hours in period) - (contractedHoursPerWeek × weeks in period)`; this calculation MUST use the contracted hours at the time of the pay period, not current contracted hours.
- Reports are read-only projections; they MUST NOT trigger audit log entries except for special-category field access (which MUST NOT appear in exports anyway).
- Export generation MUST be synchronous for datasets up to 12 months; large exports (>12 months or >500 employees) SHOULD be queued and delivered asynchronously.

---

## Cross-Cutting Constraints

| Constraint | Applies To | Basis |
|------------|-----------|-------|
| `organization_id` non-null on all tenant tables | All capabilities | ADR-6 |
| RLS `USING (organization_id = current_setting('app.current_org'))` | All capabilities | ADR-6 |
| Shared Zod schemas validate all API request/response bodies | All capabilities | ADR-3 |
| Error envelope: `{ code, message, details? }` | All capabilities | API conventions |
| Pagination: `?page&pageSize` on all list endpoints | All capabilities | API conventions |
| Soft-delete only on business entities | All capabilities | Compliance |
| Data retention ≥ 4 years | TimeEntry, AuditLog, Absence, Report | RD-ley 8/2019 |
| Special-category fields access-logged on every read | IT cause, health conditions | GDPR Art. 9 |
