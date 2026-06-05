# Legal Compliance Export — Specification

## Purpose

Add inspection-ready PDF/Excel time-record exports and a self-service employee schedule PDF to satisfy RDL 8/2019 audit requirements.

---

## Capability: compliance-export (NEW)

### Requirement: FR-EXP-01 — Time-entries PDF endpoint

The system MUST expose `POST /reports/time-entries/pdf` accepting a JSON body `{ from: ISO date string, to: ISO date string, employeeId?: UUID }`. The response MUST have Content-Type `application/pdf` and Content-Disposition `attachment; filename="time-entries-{from}-{to}.pdf"`.

#### Scenario: ADMIN downloads time-entries PDF for a date range

- GIVEN an authenticated ADMIN user
- WHEN they POST `{ from: "2025-01-01", to: "2025-01-31" }` to `/reports/time-entries/pdf`
- THEN the response status is 200 with Content-Type `application/pdf`
- AND Content-Disposition includes `attachment; filename=`

#### Scenario: MANAGER downloads only their center's entries

- GIVEN an authenticated MANAGER with centerId C1
- WHEN they POST `{ from: "2025-01-01", to: "2025-01-31" }` to `/reports/time-entries/pdf`
- THEN the PDF contains only employees belonging to center C1

#### Scenario: EMPLOYEE role is rejected

- GIVEN an authenticated EMPLOYEE user
- WHEN they POST to `/reports/time-entries/pdf`
- THEN the response status is 403

#### Scenario: Date range exceeds 366 days

- GIVEN a valid ADMIN session
- WHEN `from` and `to` span more than 366 days
- THEN the response status is 400

#### Scenario: from is after to

- GIVEN a valid ADMIN session
- WHEN `from` is later than `to`
- THEN the response status is 400

#### Scenario: Unknown employeeId

- GIVEN a valid ADMIN session
- WHEN `employeeId` does not exist in the organization
- THEN the response status is 404

---

### Requirement: FR-EXP-02 — Time-entries Excel endpoint

The system MUST expose `POST /reports/time-entries/excel` with the same body contract as FR-EXP-01. Response Content-Type MUST be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

#### Scenario: ADMIN downloads Excel for a date range

- GIVEN an authenticated ADMIN user
- WHEN they POST `{ from: "2025-01-01", to: "2025-01-31" }` to `/reports/time-entries/excel`
- THEN the response status is 200 with the OOXML MIME type
- AND Content-Disposition includes `attachment; filename=`

#### Scenario: Role and validation errors mirror FR-EXP-01

- GIVEN any condition defined in FR-EXP-01 error scenarios
- WHEN the same request is made to `/reports/time-entries/excel`
- THEN the same error status applies

---

### Requirement: FR-EXP-03 — Schedule PDF endpoint

The system MUST expose `POST /reports/schedule/pdf` accepting `{ year: integer, month: integer (1-12), employeeId?: UUID }`. Response MUST be `application/pdf`.

#### Scenario: EMPLOYEE downloads their own schedule

- GIVEN an authenticated EMPLOYEE
- WHEN they POST `{ year: 2025, month: 6 }` with no employeeId (or their own)
- THEN the response status is 200 with Content-Type `application/pdf`

#### Scenario: EMPLOYEE requests another employee's schedule

- GIVEN an authenticated EMPLOYEE
- WHEN they POST `{ year: 2025, month: 6, employeeId: "<other-id>" }`
- THEN the response status is 403

#### Scenario: ADMIN requests any employee's schedule

- GIVEN an authenticated ADMIN
- WHEN they POST `{ year: 2025, month: 6, employeeId: "<any-id>" }`
- THEN the response status is 200

---

### Requirement: FR-EXP-04 — PDF time-entries header block

The PDF MUST contain a header block with: organization name, CIF, export timestamp (UTC, ISO 8601), and date range covered by the report.

#### Scenario: Header fields are present

- GIVEN a generated time-entries PDF
- WHEN the document is inspected
- THEN the first page contains organization name, CIF, a UTC export timestamp, and the from/to dates

---

### Requirement: FR-EXP-05 — PDF time-entries row content

The PDF MUST contain one data row per time entry with: Employee Name (last, first), Category, Date (YYYY-MM-DD), Clock In (HH:mm), Clock Out (HH:mm or "—" when OPEN), Duration (decimal hours, 2 decimal places), Source. Rows MUST be sorted by Employee Name ascending, then by Clock In ascending.

#### Scenario: Closed entry row is complete

- GIVEN a CLOSED time entry for employee Jane Doe, clocked in at 09:00 and out at 17:30
- WHEN included in a PDF export
- THEN the row shows "Doe, Jane", their category, the date, "09:00", "17:30", "8.50", and the source value

#### Scenario: Open entry shows em-dash for clock-out

- GIVEN an OPEN time entry
- WHEN included in a PDF export
- THEN the Clock Out column shows "—"

---

### Requirement: FR-EXP-06 — Per-employee subtotal row

The PDF MUST include a subtotal row per employee showing their total hours (sum of Duration) for the report period.

#### Scenario: Subtotal appears after last row for each employee

- GIVEN two employees with entries in the range
- WHEN the PDF is generated
- THEN a subtotal row appears after the last entry for each employee before the next employee's rows begin

---

### Requirement: FR-EXP-07 — Modification log section

The PDF MUST include a modification log section listing all AuditLog entries whose entityType is `TimeEntry` and whose timestamp falls within the report date range. Each log row MUST show: actor, entityId, action, before (JSON), after (JSON), and timestamp (UTC).

#### Scenario: Modification log is present for entries with audit records

- GIVEN at least one AuditLog row for a TimeEntry in the range
- WHEN the PDF is generated
- THEN the modification log section contains that entry with all required fields

#### Scenario: Modification log section is empty when no audit records exist

- GIVEN no AuditLog rows for TimeEntries in the range
- WHEN the PDF is generated
- THEN the modification log section exists but contains no data rows

---

### Requirement: FR-EXP-08 — Grand total on last page

The PDF MUST include a grand total row on the last page showing the sum of all Duration values across all employees.

#### Scenario: Grand total is correct

- GIVEN a range with 3 employees totaling 80 hours
- WHEN the PDF is generated
- THEN the grand total row shows "80.00"

---

### Requirement: FR-EXP-09 — Excel Sheet 1 content

Sheet 1 MUST be named "Time Entries". It MUST contain all entries from all employees in one sheet with columns: Employee Name, Category, Date, Clock In, Clock Out, Duration (h), Source. It MUST have a frozen header row, bold headers, and auto-column widths.

#### Scenario: Sheet 1 structure is correct

- GIVEN an Excel export for a date range with data
- WHEN Sheet 1 is inspected
- THEN the sheet is named "Time Entries", row 1 is bold and frozen, and columns are auto-sized

---

### Requirement: FR-EXP-10 — Excel Sheet 2 audit log

Sheet 2 MUST be named "Audit Log". It MUST contain AuditLog rows for TimeEntry changes in the range with columns: Timestamp (UTC), Actor, Entity ID, Action, Before (JSON string), After (JSON string).

#### Scenario: Sheet 2 contains audit records in range

- GIVEN AuditLog entries for TimeEntries within the range
- WHEN Sheet 2 is inspected
- THEN the rows contain the correct timestamp, actor, entityId, action, before, and after values

---

### Requirement: FR-EXP-11 — Excel formatting

Excel workbook MUST have auto-column widths, frozen header row, and bold headers on all sheets.

#### Scenario: Formatting is applied to both sheets

- GIVEN a generated Excel export
- WHEN both sheets are inspected
- THEN both have frozen row 1, bold row 1 cells, and no column width is default (narrow)

---

### Requirement: FR-EXP-12 — Schedule PDF header

The schedule PDF MUST contain a header with the employee's full name and the month/year (e.g., "June 2025").

#### Scenario: Header shows employee name and month

- GIVEN a schedule PDF for employee John Smith, month 6/2025
- WHEN the document is inspected
- THEN the header reads the employee name and "June 2025"

---

### Requirement: FR-EXP-13 — Schedule PDF rows

The schedule PDF MUST list all ShiftAssignments for the employee in the requested month. Each row MUST show: Date (YYYY-MM-DD), Shift Name, Start time (HH:mm), End time (HH:mm). Rows MUST be sorted by Date ascending.

#### Scenario: Assignments appear in date order

- GIVEN an employee with 3 assignments in June 2025
- WHEN the schedule PDF is generated
- THEN 3 rows appear sorted by date ascending with the correct shift name and times

#### Scenario: No assignments in month

- GIVEN an employee with no assignments in the requested month
- WHEN the schedule PDF is generated
- THEN the PDF renders successfully with an empty assignments list

---

### Requirement: FR-EXP-14 — Schedule PDF role scoping

EMPLOYEE role MUST only be allowed to export their own schedule (employeeId in the request body MUST equal the requesting user's employeeId or be absent). ADMIN and MANAGER MAY specify any employeeId.

#### Scenario: EMPLOYEE omits employeeId — defaults to self

- GIVEN an EMPLOYEE user with employeeId E1
- WHEN they POST `{ year: 2025, month: 6 }` (no employeeId)
- THEN the PDF is generated for E1

---

### Requirement: FR-EXP-15 — Export dialog button in Time Tracking

The Time Tracking page MUST render an "Export for Inspection" button. The button MUST only be visible to users with role ADMIN or MANAGER.

#### Scenario: Button visible to ADMIN

- GIVEN an authenticated ADMIN on the Time Tracking page
- WHEN the page renders
- THEN the "Export for Inspection" button is visible

#### Scenario: Button hidden from EMPLOYEE

- GIVEN an authenticated EMPLOYEE on the Time Tracking page
- WHEN the page renders
- THEN the "Export for Inspection" button is not present in the DOM

---

### Requirement: FR-EXP-16 — Export dialog fields

The export dialog MUST contain: a date range picker (from/to), an employee selector (all employees or a specific employee — only visible to ADMIN and MANAGER), and a format selector (PDF or Excel).

#### Scenario: ADMIN sees all fields including employee selector

- GIVEN an ADMIN opens the export dialog
- WHEN the dialog is rendered
- THEN from/to date pickers, employee selector, and format selector are all visible

---

### Requirement: FR-EXP-17 — Download trigger

When the user clicks the download button in the export dialog, the frontend MUST POST to the appropriate endpoint (`/reports/time-entries/pdf` or `/reports/time-entries/excel`) and trigger a browser file download of the binary response.

#### Scenario: PDF download is triggered

- GIVEN the dialog has from="2025-01-01", to="2025-01-31", format=PDF
- WHEN the user clicks Download
- THEN a POST is sent to `/reports/time-entries/pdf` and the browser downloads the response as a `.pdf` file

#### Scenario: Excel download is triggered

- GIVEN the dialog has from="2025-01-01", to="2025-01-31", format=Excel
- WHEN the user clicks Download
- THEN a POST is sent to `/reports/time-entries/excel` and the browser downloads the response as a `.xlsx` file

---

### Requirement: FR-EXP-18 — Schedule export button in Shifts page

The Shifts (cuadrante) page MUST render a schedule export button visible to all authenticated roles. When clicked, it MUST pre-fill the current month/year and the requesting user's employeeId, then POST to `POST /reports/schedule/pdf` and trigger a browser download.

#### Scenario: EMPLOYEE downloads their own schedule from Shifts page

- GIVEN an authenticated EMPLOYEE on the Shifts page in June 2025
- WHEN they click the schedule export button
- THEN a POST is sent to `/reports/schedule/pdf` with `{ year: 2025, month: 6, employeeId: <self> }` and the browser downloads the result

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-EXP-01 | Response time MUST be under 10 seconds for up to 500 time entries |
| NFR-EXP-02 | Files MUST be deterministic for the same input (no random tokens in headers or filenames) |
| NFR-EXP-03 | Streaming is NOT required; the server MAY buffer the full file in memory before responding |
| NFR-EXP-04 | Date range MUST be capped at 366 days; requests exceeding this MUST return 400 |

---

## Out of Scope

- Frontend preview of PDF/Excel before download
- Email delivery or scheduled/automated exports
- Digital signature or timestamping of exports
- Modification of existing GET report endpoints
- Changes to time-entry capture, audit-log generation, or RLS
