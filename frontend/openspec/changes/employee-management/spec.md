# Spec: Employee Management Section (ADMIN)

**Change:** employee-management
**Status:** draft
**Depends on proposal:** `openspec/changes/employee-management/proposal.md`

---

## Data Contract Decision

### Email / Role gap resolution — Option A: Employee-only fields

The Prisma `Employee` model does NOT include email or role. Those fields live on the linked `User` record. No backend join is available from the existing endpoints without a schema change.

**Decision:** Scope the list and form to Employee-only fields. Email and role are NOT shown anywhere in this change. This is the only option that respects the no-backend-changes constraint.

**Rationale:** `GET /employees` returns bare `Employee[]` (no User join). `GET /employees/:id` returns a single `Employee` (same shape). No endpoint currently projects `user.email` or `user.role`. Adding them requires a backend change, which is explicitly out of scope.

**Impact on proposal:** The list table columns change from `Name | Email | Role | Category | Contract | Status` to `Name | NIF | Category | Contract | Hours/Week | Hire Date | Status`. Filters change from role/category/status to category/status only.

### EmployeeDto (authoritative shape from `EmployeeResponseSchema`)

```ts
interface EmployeeDto {
  id: string;                        // UUID
  organizationId: string;            // UUID
  firstName: string;
  lastName: string;
  nif: string | null;
  category: EmployeeCategory;        // enum — see enums below
  contractType: ContractType;        // enum — see enums below
  contractedHoursPerWeek: number;
  primaryCenterId: string;           // UUID
  workingCalendarId: string | null;  // UUID
  hireDate: string;                  // ISO date string
  terminationDate: string | null;    // ISO date string
  isActive: boolean;
  createdAt: string;                 // ISO datetime
  updatedAt: string;                 // ISO datetime
}
```

### CreateEmployeeDto (maps to `CreateEmployeeSchema`)

```ts
interface CreateEmployeeDto {
  firstName: string;            // 1–100 chars
  lastName: string;             // 1–100 chars
  nif?: string;                 // max 20 chars
  category: EmployeeCategory;
  contractType: ContractType;
  contractedHoursPerWeek?: number;  // required and > 0 when contractType === 'TIEMPO_PARCIAL'
  primaryCenterId: string;          // UUID
  workingCalendarId?: string;       // UUID
  hireDate: string;                 // YYYY-MM-DD
}
```

### UpdateEmployeeDto

All fields from `CreateEmployeeDto` made optional (partial). Same cross-field rule applies: if `contractType` is sent as `TIEMPO_PARCIAL`, `contractedHoursPerWeek` must also be present and > 0.

### Enums

```ts
type EmployeeCategory =
  | 'MEDICO' | 'ENFERMERO' | 'TCAE' | 'FISIOTERAPEUTA'
  | 'TERAPEUTA_OCUPACIONAL' | 'PSICOLOGO' | 'TRABAJADOR_SOCIAL'
  | 'CELADOR' | 'ADMINISTRATIVO' | 'COCINERO' | 'AUXILIAR_SERVICIOS';

type ContractType =
  | 'INDEFINIDO' | 'TEMPORAL' | 'INTERINIDAD'
  | 'OBRA_Y_SERVICIO' | 'TIEMPO_PARCIAL';
```

### API endpoints consumed

| Method   | Path                       | Auth required | Notes                              |
|----------|----------------------------|---------------|------------------------------------|
| GET      | `/employees`               | Authenticated | Returns `EmployeeDto[]` bare array |
| GET      | `/employees?activeOnly=true` | Authenticated | Filtered list                    |
| GET      | `/employees/:id`           | Authenticated | Single `EmployeeDto`               |
| POST     | `/employees`               | ADMIN only    | Body: `CreateEmployeeDto`; returns 201 + `EmployeeDto` |
| PATCH    | `/employees/:id`           | ADMIN only    | Body: `UpdateEmployeeDto`; returns `EmployeeDto` |
| POST     | `/employees/:id/terminate` | ADMIN only    | Returns 204 No Content             |

**Response shape:** All list and single responses return the raw object/array — no `{ data }` envelope. `EmployeesApi.list()` MUST NOT unwrap `.data` (contrast with `AbsencesApi` which does unwrap).

---

## Functional Requirements

### FR-EMP-01 — Route access: ADMIN only

The `/employees` route MUST be protected by `roleGuard(['ADMIN'])`. Any authenticated user whose role is not `ADMIN` MUST be redirected (same behavior as the existing `roleGuard` on `/admin`). The current guard `['ADMIN', 'MANAGER']` MUST be replaced.

### FR-EMP-02 — Employee list page

The page at `/employees` MUST display a table of all employees in the organization with the following columns: Full Name, NIF, Category, Contract Type, Hours/Week, Hire Date, Status.

### FR-EMP-03 — List: name search

The list MUST support a text search input that filters the visible rows by employee full name (first + last, case-insensitive). Filtering MUST be client-side (no new HTTP requests per keystroke).

### FR-EMP-04 — List: category filter

The list MUST support a dropdown filter on the `category` field. Values are the full `EMPLOYEE_CATEGORY_VALUES` enum. Selecting a category shows only employees in that category. "All" option resets the filter.

### FR-EMP-05 — List: status filter

The list MUST support a filter on `isActive`. Options: "All", "Active", "Inactive". Default: "All".

### FR-EMP-06 — List: loading and empty states

While the initial fetch is in flight, the table MUST display skeleton rows. When the filtered list is empty, a contextual empty-state message MUST be shown distinguishing "no employees yet" from "no results match your filters".

### FR-EMP-07 — List: Add Employee button

An "Add Employee" button MUST be visible in the list page header. It is only rendered when the user is ADMIN (same condition as the route guard — guard already handles route, button is visual convenience). Clicking it opens the create form (FR-EMP-08).

### FR-EMP-08 — Create employee form

A `p-dialog` MUST open with a reactive form containing all fields from `CreateEmployeeDto`:
- First Name (required, 1–100 chars)
- Last Name (required, 1–100 chars)
- NIF (optional, max 20 chars)
- Category (required, dropdown from `EMPLOYEE_CATEGORY_VALUES`)
- Contract Type (required, dropdown from `CONTRACT_TYPE_VALUES`)
- Contracted Hours/Week (conditionally required: shown and required only when Contract Type is `TIEMPO_PARCIAL`; MUST be > 0)
- Primary Center (required, UUID; rendered as a dropdown populated from available centers)
- Working Calendar (optional, UUID; rendered as a dropdown or clearable select)
- Hire Date (required, date picker, YYYY-MM-DD format)

### FR-EMP-09 — Create: validation and submission

Submitting the form MUST be blocked if any required field is invalid. Errors MUST be displayed inline per field. On successful POST (201), the dialog closes, the new employee is appended to the in-memory store list, and a success toast is shown. On HTTP error, the dialog stays open and displays the server error message.

### FR-EMP-10 — Edit employee form

Clicking a row's Edit action MUST open the same `p-dialog` form pre-populated with the selected employee's current values. The form MUST use `UpdateEmployeeDto` (all fields optional) but apply the same validation rules as create. On successful PATCH, the store updates the employee in place, the dialog closes, and a success toast is shown.

### FR-EMP-11 — Employee detail view

Clicking a row (anywhere except the action buttons) MUST open a detail panel or dialog showing all employee fields in read-only display. The detail view MUST include:
- All `EmployeeDto` fields formatted for display
- An "Edit" button that transitions to the edit form (FR-EMP-10)
- A "Deactivate" button (visible only when `isActive === true`)
- A "Recent Time Entries" section (FR-EMP-13)

### FR-EMP-12 — Deactivate (soft-delete)

The "Deactivate" button in the detail view MUST trigger a confirmation dialog before calling `POST /employees/:id/terminate`. On 204 response, the employee's `isActive` flag MUST be set to `false` in the store (no full reload required). A success toast MUST be shown. The "Deactivate" button MUST NOT be shown when `isActive === false`. No reactivate action is provided.

### FR-EMP-13 — Recent time entries in detail view

The detail view MUST display the employee's most recent time entries (up to 10) fetched from the existing `TimeApi`. This fetch MUST be lazy — triggered only when the detail view opens for a specific employee. The section MUST show a skeleton while loading and a "No recent entries" message when the list is empty.

### FR-EMP-14 — Data access layer: EmployeesApi

A new `EmployeesApi` service (`providedIn: 'root'`) MUST expose:
- `list(params?: { activeOnly?: boolean })`: returns `Observable<EmployeeDto[]>` — raw array, no unwrap
- `getById(id: string)`: returns `Observable<EmployeeDto>`
- `create(dto: CreateEmployeeDto)`: returns `Observable<EmployeeDto>`
- `update(id: string, dto: UpdateEmployeeDto)`: returns `Observable<EmployeeDto>`
- `terminate(id: string)`: returns `Observable<void>`

### FR-EMP-15 — Data access layer: EmployeesStore

A new `EmployeesStore` (signalStore, `providedIn: 'root'`) MUST hold:
- `employees: EmployeeDto[]` — full list loaded from backend
- `selected: EmployeeDto | null` — currently viewed/edited employee
- `loading: boolean`
- `error: string | null`
- Computed: `filteredEmployees` — derived from `employees` applying current search text, category filter, and status filter
- Methods: `load()`, `create(dto)`, `update(id, dto)`, `deactivate(id)`, `select(employee | null)`

### FR-EMP-16 — Component architecture

- `EmployeesComponent` (smart container, `OnPush`) — replaces placeholder; owns list + dialogs
- `EmployeeTableComponent` (presentational, `OnPush`) — receives `employees` input, emits `edit`, `select`, row-click events
- `EmployeeFormComponent` (presentational, `OnPush`) — receives optional `employee` input for edit mode, emits `save` and `cancel`
- `EmployeeDetailComponent` (presentational, `OnPush`) — receives `employee` input, emits `edit`, `deactivate`

---

## Acceptance Criteria

### AC-EMP-01 (covers FR-EMP-01)
**Given** a user with role `MANAGER` is authenticated,
**When** they navigate to `/employees`,
**Then** they are redirected away and the employees page content is not rendered.

### AC-EMP-02 (covers FR-EMP-01)
**Given** a user with role `ADMIN` is authenticated,
**When** they navigate to `/employees`,
**Then** the employee list page renders without redirect.

### AC-EMP-03 (covers FR-EMP-02, FR-EMP-06)
**Given** the ADMIN is on `/employees` and the fetch is in progress,
**Then** skeleton rows are visible in the table area.

### AC-EMP-04 (covers FR-EMP-02)
**Given** the fetch completes with 3 employees,
**Then** the table renders 3 rows, each showing Full Name, NIF, Category, Contract Type, Hours/Week, Hire Date, and Status badge.

### AC-EMP-05 (covers FR-EMP-03)
**Given** the list shows employees including "Ana García" and "Carlos López",
**When** the ADMIN types "ana" in the search input,
**Then** only "Ana García" is visible; no HTTP request is made.

### AC-EMP-06 (covers FR-EMP-04)
**Given** employees of categories `MEDICO` and `ENFERMERO` are in the list,
**When** the ADMIN selects "ENFERMERO" in the category filter,
**Then** only `ENFERMERO` employees are visible.

### AC-EMP-07 (covers FR-EMP-05)
**Given** the list contains active and inactive employees,
**When** the ADMIN selects "Active" in the status filter,
**Then** only employees with `isActive === true` are visible.

### AC-EMP-08 (covers FR-EMP-06)
**Given** all employees are filtered out by a search term,
**Then** a "No results match your filters" message is shown instead of an empty table.

### AC-EMP-09 (covers FR-EMP-08)
**Given** the ADMIN clicks "Add Employee",
**Then** a dialog opens with all form fields, all required fields marked, and the submit button disabled.

### AC-EMP-10 (covers FR-EMP-08 — conditional hours field)
**Given** the create form is open and Contract Type is NOT `TIEMPO_PARCIAL`,
**Then** the "Contracted Hours/Week" field is hidden (or disabled and not required).

**Given** the Contract Type is changed to `TIEMPO_PARCIAL`,
**Then** "Contracted Hours/Week" becomes visible, required, and the form is invalid until a positive value is entered.

### AC-EMP-11 (covers FR-EMP-09)
**Given** all required fields are valid and the ADMIN submits the create form,
**When** the POST /employees returns 201,
**Then** the dialog closes, the new employee appears in the table without a full page reload, and a success toast is shown.

### AC-EMP-12 (covers FR-EMP-09 — error case)
**Given** the ADMIN submits the create form,
**When** the POST returns a 4xx error,
**Then** the dialog stays open and the server error message is displayed.

### AC-EMP-13 (covers FR-EMP-10)
**Given** the ADMIN clicks Edit on an employee row,
**Then** the dialog opens pre-populated with that employee's current field values.

### AC-EMP-14 (covers FR-EMP-11)
**Given** the ADMIN clicks a row (not an action button),
**Then** a detail view opens showing all fields read-only, an Edit button, and a Deactivate button (if active).

### AC-EMP-15 (covers FR-EMP-12)
**Given** the ADMIN clicks "Deactivate" in the detail view,
**When** a confirmation dialog appears and the ADMIN confirms,
**Then** POST /employees/:id/terminate is called; on 204, the employee's status badge changes to "Inactive" in the list and the Deactivate button disappears.

### AC-EMP-16 (covers FR-EMP-12 — inactive employee)
**Given** the detail view is open for an employee with `isActive === false`,
**Then** no "Deactivate" button is rendered.

### AC-EMP-17 (covers FR-EMP-13)
**Given** the detail view opens for an employee,
**Then** a skeleton is shown in the "Recent Time Entries" section while the time entries fetch is in flight; after fetch, up to 10 entries are listed or "No recent entries" is shown.

### AC-EMP-18 (covers FR-EMP-14 — response shape)
**Given** the EmployeesApi.list() method is called,
**Then** it returns `EmployeeDto[]` directly — it does NOT attempt to access `.data` on the response.

### AC-EMP-19 (covers FR-EMP-15)
**Given** EmployeesStore.deactivate(id) is called and succeeds,
**Then** the `employees` signal is updated in place (the matching employee's `isActive` is set to `false`) without triggering a full reload.

### AC-EMP-20 (covers FR-EMP-16 — OnPush)
**Given** the EmployeeTableComponent is rendered,
**Then** `ChangeDetectionStrategy.OnPush` is declared on the component decorator.

---

## Non-Functional Requirements

### NFR-EMP-01 — Change detection
All components in the employees feature MUST use `ChangeDetectionStrategy.OnPush`.

### NFR-EMP-02 — Signal-only state
Component state MUST use Angular signals and `computed()`. No `BehaviorSubject` or `ReplaySubject` in the feature layer.

### NFR-EMP-03 — Injection pattern
All dependencies MUST use `inject()`. Constructor injection is not allowed.

### NFR-EMP-04 — Accessible table
The employee table MUST have an `aria-label` attribute. Each action button MUST have a descriptive `aria-label` (e.g., `aria-label="Edit Ana García"`). Status badges MUST convey meaning via text, not color alone.

### NFR-EMP-05 — Responsive layout
The layout MUST be usable on viewports >= 768px. The table MUST be horizontally scrollable on narrower viewports rather than overflowing.

### NFR-EMP-06 — Loading isolation
A loading state that affects only the employees feature MUST NOT block the shell navigation or other features.

### NFR-EMP-07 — Unit test coverage
`EmployeesApi` and `EmployeesStore` MUST each have a spec file. The API spec MUST cover the bare-array response shape (no `.data` unwrap). The store spec MUST cover `load`, `create`, `update`, `deactivate`, and `select` methods, plus the `filteredEmployees` computed signal.

---

## Out of Scope

- Email and role fields on employees (requires backend User join — deferred)
- Reactivate action (no backend endpoint; deferred until `/employees/:id/reactivate` exists)
- Bulk import or export
- Server-side pagination (client-side filtering of the full list is sufficient for current data volumes)
- Center management UI (centers are reference data used as a dropdown source only)
- Working calendar management UI
- Shift or absence assignment from within the employee detail view
- MANAGER role access to employee management (route guard tightens to ADMIN-only)
- Any backend schema or endpoint changes
