# Spec: Monthly Timesheet Signature

**Change:** monthly-timesheet-signature
**Date:** 2026-06-06
**Status:** draft
**Based on:** proposal.md (monthly-timesheet-signature)

RFC 2119 keywords (MUST, MUST NOT, SHOULD, MAY) are used per https://www.rfc-editor.org/rfc/rfc2119.

---

## Capability: timesheet-signature

### Purpose

Allows employees to review and digitally confirm their monthly timesheet, producing an immutable timestamped acknowledgment that satisfies RD-ley 8/2019 and the 2026 digital-only/unalterable records reform. A "signature" is a database record — not a cryptographic construct. Once confirmed, the month is locked read-only for that employee. Managers and admins gain a confirmation-status overview per month.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-TSS-001 | The system MUST provide a `TimesheetSignature` entity storing: `id`, `organizationId`, `employeeId`, `year`, `month`, `confirmedAt`, `createdAt`. |
| FR-TSS-002 | `TimesheetSignature` MUST enforce a unique constraint on `(organizationId, employeeId, year, month)` — one confirmation record per employee per calendar month. |
| FR-TSS-003 | An employee MUST be able to retrieve their own monthly timesheet summary for any given `year` + `month`, including: hours breakdown (`regularHours`, `overtimeHours`, `partTimeDeviation`), total absence days, confirmation state (`confirmed: boolean`, `confirmedAt`), and whether any entry is OPEN (`hasOpenEntry`). |
| FR-TSS-004 | An employee MUST be able to confirm their monthly timesheet by submitting a confirm request for a given `year` + `month`; the system MUST create a `TimesheetSignature` row with server-assigned `confirmedAt` (UTC) and respond HTTP 201. The `confirmedAt` value MUST be set by the server — the client MUST NOT supply it. |
| FR-TSS-005 | If the employee has already confirmed the requested `year` + `month`, the confirm action MUST be idempotent: the system MUST return HTTP 200 with the existing `TimesheetSignature` record and MUST NOT create a duplicate row. |
| FR-TSS-006 | The system MUST reject a confirmation request with HTTP 422 if any `TimeEntry` for that employee in that `year` + `month` has status `OPEN` (clock-in without a corresponding clock-out). |
| FR-TSS-007 | Once an employee has confirmed a month, the system MUST reject any clock-in, clock-out, or self-submitted time correction for that employee in that month with HTTP 409 and error code `MONTH_LOCKED`. |
| FR-TSS-008 | FR-TSS-007's lock guard MUST cover all mutating paths in the time-tracking module: clock-in, clock-out, and self-submitted time corrections. It MUST be enforced server-side before any data write. |
| FR-TSS-009 | Every successful confirmation MUST produce exactly one `AuditLog` row with: `action=APPROVE`, `entityType=TimesheetSignature`, `entityId` = the new signature's `id`, `actor` = the confirming employee's user id, and the full signature record as `after`. The audit write MUST be atomic with the signature insert (single transaction). |
| FR-TSS-010 | A manager or admin MUST be able to retrieve a confirmation-status list for a given `year` + `month` within their organization, showing each employee's name, employeeId, and confirmation status (`confirmed` with `confirmedAt`, or `pending`). |
| FR-TSS-011 | A manager's confirmation-status query MUST be scoped to their organization; cross-tenant results MUST NOT be returned. |
| FR-TSS-012 | The system MUST expose the following endpoints: `GET /timesheet-signatures/summary?year=&month=`, `POST /timesheet-signatures/confirm`, `GET /timesheet-signatures/status?year=&month=` (manager/admin only). |
| FR-TSS-013 | `TimesheetSignature` rows MUST be INSERT-only for the application database role; the app role MUST NOT have UPDATE or DELETE privileges on this table. |
| FR-TSS-014 | RLS policy MUST enforce `organization_id = current_setting('app.current_org')` on `TimesheetSignature`, consistent with TimeEntry and AuditLog conventions. |
| FR-TSS-015 | The frontend MUST display a monthly review screen for employees showing the summary returned by `GET /timesheet-signatures/summary`, a "Confirm [Month] timesheet" button when status is `pending`, and a locked/read-only banner when status is `confirmed`. |
| FR-TSS-016 | The frontend MUST display a confirmation-status table for managers/admins listing all employees with their confirmation status for the selected month. |
| FR-TSS-017 | The shared package MUST export Zod schemas for the confirm request, confirm response, summary response, and status-list response. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-TSS-001 | All existing 245 backend tests MUST continue to pass after this change is merged. New module tests MUST be added and MUST pass. |
| NFR-TSS-002 | The lock guard check (FR-TSS-007) MUST complete in ≤ 50 ms under normal load (single indexed lookup by `organizationId, employeeId, year, month`). |
| NFR-TSS-003 | The monthly summary endpoint (FR-TSS-003) MUST respond in ≤ 500 ms for a month with up to 31 days of time entries. |
| NFR-TSS-004 | The confirmation-status list endpoint (FR-TSS-010) MUST respond in ≤ 1 000 ms for an organization with up to 500 active employees. |
| NFR-TSS-005 | `TimesheetSignature` MUST carry `organizationId` as the leading column in all database indexes, consistent with multi-tenant data access patterns in the existing schema. |
| NFR-TSS-006 | The schema migration MUST mirror the RLS and privilege-grant template used by `TimeEntry` and `AuditLog` migrations. |
| NFR-TSS-007 | `confirmedAt` MUST be stored and returned as UTC ISO-8601. |
| NFR-TSS-008 | The system MUST retain `TimesheetSignature` rows for a minimum of 4 years, consistent with RD-ley 8/2019 audit retention (FR-AUDIT-6). No purge job MUST delete rows within that window. |
| NFR-TSS-009 | The confirm endpoint MUST be idempotent and safe for client-side retry without risk of duplicate records or conflicting state. |
| NFR-TSS-010 | Authentication is required for all three endpoints; unauthenticated requests MUST return HTTP 401. |

---

## Authorization Matrix

| Action | employee | manager | admin |
|--------|----------|---------|-------|
| `GET /timesheet-signatures/summary` (own) | ALLOWED | ALLOWED (own) | ALLOWED (own) |
| `POST /timesheet-signatures/confirm` (own) | ALLOWED | ALLOWED (own) | ALLOWED (own) |
| `GET /timesheet-signatures/status` (org list) | DENIED (403) | ALLOWED (org-scoped) | ALLOWED (org-scoped) |
| Read other employee's signature record | DENIED (403) | DENIED (403) | ALLOWED (org-scoped) |
| INSERT `TimesheetSignature` (DB role) | via app only | via app only | via app only |
| UPDATE / DELETE `TimesheetSignature` (DB role) | DENIED | DENIED | DENIED |

Notes:
- Manager scope is organization-scoped for the status list. A manager MUST NOT see employees from a different organization.
- Employees MUST NOT access another employee's summary or confirmation status via the API.
- Admin access to individual signature records is org-scoped and subject to RLS.

---

## Data Contract

### TimesheetSignature (DB record)

```typescript
{
  id:             string;       // cuid
  organizationId: string;       // FK → Organization.id (leading index column)
  employeeId:     string;       // FK → Employee.id
  year:           number;       // calendar year (e.g. 2026)
  month:          number;       // 1–12
  confirmedAt:    string;       // UTC ISO-8601, server-assigned
  createdAt:      string;       // UTC ISO-8601, server-assigned
}
// Unique: (organizationId, employeeId, year, month)
// DB privileges: INSERT only for app role
```

### POST /timesheet-signatures/confirm — Request body

```typescript
{
  year:  number;   // required, 4-digit
  month: number;   // required, 1–12
}
```

### POST /timesheet-signatures/confirm — Response (HTTP 201 on first confirmation, HTTP 200 on idempotent re-confirm)

```typescript
{
  id:               string;
  employeeId:       string;
  year:             number;
  month:            number;
  confirmedAt:      string;   // UTC ISO-8601
  alreadyConfirmed: boolean;  // true when idempotent path was taken (HTTP 200)
}
```

### GET /timesheet-signatures/summary — Response (HTTP 200)

```typescript
{
  year:             number;
  month:            number;
  employeeId:       string;
  hours: {
    regularHours:       number;   // decimal hours
    overtimeHours:      number;
    partTimeDeviation:  number;
  } | null;
  totalAbsenceDays: number;
  confirmed:        boolean;
  confirmedAt:      string | null;  // UTC ISO-8601 or null
  hasOpenEntry:     boolean;
}
```

### GET /timesheet-signatures/status — Response (HTTP 200)

Query params: `year` (required), `month` (required).

```typescript
{
  year:  number;
  month: number;
  items: Array<{
    employeeId:  string;
    firstName:   string;
    lastName:    string;
    confirmed:   boolean;
    confirmedAt: string | null;   // UTC ISO-8601 or null
  }>;
  summary: {
    total:     number;
    confirmed: number;
    pending:   number;
  };
}
```

### Error responses

| Situation | HTTP Status | Error code |
|-----------|-------------|------------|
| Month has OPEN time entries | 422 | `OPEN_ENTRIES_EXIST` |
| Confirmed month — attempted clock-in/out or correction | 409 | `MONTH_LOCKED` |
| Unauthorized (no token) | 401 | — |
| Insufficient role | 403 | — |
| Invalid year/month params | 422 | — |

---

## Acceptance Scenarios

**AC-TSS-001: Employee retrieves pending monthly summary**
- GIVEN an authenticated employee with time entries for March 2026, none OPEN, no confirmation record
- WHEN `GET /timesheet-signatures/summary?year=2026&month=3` is called
- THEN the response MUST include `confirmed: false`, `confirmedAt: null`, and `hasOpenEntry: false`

**AC-TSS-002: Employee confirms a month successfully**
- GIVEN an authenticated employee with no OPEN time entries for March 2026 and no existing confirmation
- WHEN `POST /timesheet-signatures/confirm` is called with `{ year: 2026, month: 3 }`
- THEN the response MUST be HTTP 201 with a `TimesheetSignature` record containing a server-assigned `confirmedAt`
- AND `alreadyConfirmed` MUST be `false`
- AND exactly one `TimesheetSignature` row MUST exist in the database for that employee + month
- AND exactly one `AuditLog` row MUST exist with `action=APPROVE`, `entityType=TimesheetSignature`, `entityId` matching the new record's id

**AC-TSS-003: Re-confirming the same month is idempotent**
- GIVEN an employee who has already confirmed March 2026
- WHEN `POST /timesheet-signatures/confirm` is called again with `{ year: 2026, month: 3 }`
- THEN the response MUST be HTTP 200
- AND the returned record MUST match the original confirmation (same `id`, same `confirmedAt`)
- AND `alreadyConfirmed` MUST be `true`
- AND no new `TimesheetSignature` row MUST be created
- AND no new `AuditLog` row MUST be created for this re-confirm attempt

**AC-TSS-004: Confirmation rejected when OPEN entries exist**
- GIVEN an employee with at least one `TimeEntry` in status `OPEN` for March 2026
- WHEN `POST /timesheet-signatures/my/confirm` is called with `{ year: 2026, month: 3 }`
- THEN the response MUST be HTTP 422 with error code `OPEN_ENTRIES_EXIST`
- AND no `TimesheetSignature` row MUST be created

**AC-TSS-005: Lock blocks clock-in on confirmed month**
- GIVEN an employee who has confirmed March 2026
- WHEN a clock-in request is submitted with a timestamp within March 2026
- THEN the system MUST return HTTP 409 with error code `MONTH_LOCKED`
- AND no new `TimeEntry` row MUST be created

**AC-TSS-006: Lock blocks clock-out on confirmed month**
- GIVEN an employee who has confirmed March 2026 and has an OPEN entry from before confirmation (edge-case: should not occur per AC-TSS-004, but lock still applies)
- WHEN a clock-out request is submitted for a time within March 2026
- THEN the system MUST return HTTP 409 with error code `MONTH_LOCKED`

**AC-TSS-007: Lock blocks self-submitted time correction on confirmed month**
- GIVEN an employee who has confirmed March 2026
- WHEN the employee submits a time correction targeting any entry within March 2026
- THEN the system MUST return HTTP 409 with error code `MONTH_LOCKED`

**AC-TSS-008: Unconfirmed months are not locked**
- GIVEN an employee who has confirmed March 2026 but NOT April 2026
- WHEN a clock-in request is submitted with a timestamp within April 2026
- THEN the system MUST process the request normally (no lock)

**AC-TSS-009: Manager retrieves confirmation-status list**
- GIVEN an authenticated manager in organization A with 3 employees, 2 of whom have confirmed March 2026
- WHEN `GET /timesheet-signatures/status?year=2026&month=3` is called
- THEN the response MUST include all 3 employees, 2 with `status: "confirmed"` and 1 with `status: "pending"`
- AND `summary.confirmed` MUST be 2, `summary.pending` MUST be 1

**AC-TSS-010: Employee denied access to status list**
- GIVEN an authenticated employee
- WHEN `GET /timesheet-signatures/status?year=2026&month=3` is called
- THEN the system MUST return HTTP 403

**AC-TSS-011: Cross-tenant isolation on status list**
- GIVEN a manager in organization A
- WHEN `GET /timesheet-signatures/status?year=2026&month=3` is called
- THEN only employees from organization A MUST appear in the result; employees from organization B MUST NOT be returned

**AC-TSS-012: Frontend locked banner displayed after confirmation**
- GIVEN an employee who has confirmed March 2026
- WHEN the monthly review screen is opened for March 2026
- THEN the UI MUST display a locked/read-only banner
- AND the "Confirm March timesheet" button MUST NOT be rendered

**AC-TSS-013: Audit write is atomic with signature insert**
- GIVEN any database error that causes the `AuditLog` INSERT to fail during confirmation
- WHEN `POST /timesheet-signatures/my/confirm` is called
- THEN the `TimesheetSignature` INSERT MUST also be rolled back
- AND no partial records MUST persist

**AC-TSS-014: DB role cannot update or delete signature rows**
- GIVEN the application database role
- WHEN an UPDATE or DELETE is attempted on `TimesheetSignature`
- THEN the database MUST reject the operation with a permission error

---

## Constraints & Edge Cases

- The lock guard (FR-TSS-007) MUST be implemented as a centralized helper in the time-tracking service, called by all mutating handlers. It MUST NOT be duplicated per endpoint.
- The confirmation endpoint MUST NOT accept a `confirmedAt` value from the client; it is always server-assigned.
- A month boundary is defined by calendar year + month (integer 1–12). Time zone interpretation for "which month does a timestamp belong to" MUST follow the organization's configured time zone (or UTC if none configured), consistent with existing time-tracking behavior.
- `year` and `month` query parameters MUST be validated as integers in their valid ranges (year ≥ 2020, month 1–12). Invalid values MUST return HTTP 422.
- The idempotent re-confirm path (FR-TSS-005) MUST NOT produce a new AuditLog entry — the original audit trail is sufficient and a second entry would be misleading.
- Manager scope for the status list is organization-wide (not center-scoped) because shift rostering and absence management are org-scoped for managers in this system. If center-scoped filtering is needed in the future, it is a separate enhancement.
- `TimesheetSignature` has no `UPDATE` or `DELETE` path in the application code or DB privileges. There is no un-lock or admin override workflow in this change (deferred per proposal).
