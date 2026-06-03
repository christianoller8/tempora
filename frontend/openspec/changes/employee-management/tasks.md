# Tasks: Employee Management Section (ADMIN)

**Change:** employee-management
**Status:** slice-2-complete
**Slices:** 2 (data-access first, UI second)

---

## Slice 1: Data-Access + Routing

> Self-verifiable via unit tests alone. Can be reviewed and merged before any UI exists.
> Estimated lines: ~350

---

### [x] T01 — Create `employees.api.ts`

**Files to create:**
- `src/app/features/employees/data-access/employees.api.ts`

**Description:**
Create `EmployeesApi` (`providedIn: 'root'`) and `CentersApi` (`providedIn: 'root'`) in the same file. Also declare all DTOs and enums used by the feature: `EmployeeDto`, `CreateEmployeeDto`, `UpdateEmployeeDto`, `CenterDto`, and re-export `EmployeeCategory` / `ContractType` enum types.

**Method signatures required (from design):**
```ts
// EmployeesApi
list(params?: { activeOnly?: boolean }): Observable<EmployeeDto[]>
getById(id: string): Observable<EmployeeDto>
create(dto: CreateEmployeeDto): Observable<EmployeeDto>
update(id: string, dto: UpdateEmployeeDto): Observable<EmployeeDto>
terminate(id: string): Observable<void>

// CentersApi
list(): Observable<CenterDto[]>
```

**Implementation rules:**
- Use `inject(HttpClient)` — NO constructor injection
- All responses are bare arrays/objects — DO NOT unwrap `.data` (this is the primary correctness constraint per spec AC-EMP-18)
- Import `EMPLOYEE_CATEGORY_VALUES` and `CONTRACT_TYPE_VALUES` from `@tempora/shared` (runtime arrays for dropdowns)
- `terminate()` targets `POST /employees/:id/terminate` and returns `Observable<void>`

**Acceptance criteria:**
- AC-EMP-18: `list()` returns `EmployeeDto[]` directly with no `.data` access
- FR-EMP-14: All five `EmployeesApi` methods present with correct signatures
- Design: `CentersApi.list()` implemented, targeting `GET /centers`

**Estimated lines:** ~90
**Dependencies:** none

---

### [x] T02 — Create `employees.api.spec.ts`

**Files to create:**
- `src/app/features/employees/data-access/employees.api.spec.ts`

**Description:**
Unit tests for `EmployeesApi` and `CentersApi` using `HttpTestingController`. Mirror the structure of the existing absences API spec.

**Tests required:**
- `list()` — verify request is `GET /employees`, response returned as-is (bare array, no `.data` unwrap)
- `list({ activeOnly: true })` — verify `?activeOnly=true` query param
- `getById(id)` — verify `GET /employees/:id`
- `create(dto)` — verify `POST /employees`, body passed through, returns `EmployeeDto`
- `update(id, dto)` — verify `PATCH /employees/:id`, body passed through, returns `EmployeeDto`
- `terminate(id)` — verify `POST /employees/:id/terminate`, returns void (no body assertion)
- `CentersApi.list()` — verify `GET /centers`, bare array returned

**Acceptance criteria:**
- NFR-EMP-07: API spec file exists and covers bare-array response shape
- AC-EMP-18: Test explicitly asserts that response is returned directly (not via `.data`)

**Estimated lines:** ~80
**Dependencies:** T01

---

### [x] T03 — Create `employees.store.ts`

**Files to create:**
- `src/app/features/employees/data-access/employees.store.ts`

**Description:**
Create `EmployeesStore` using `signalStore` (`providedIn: 'root'`). Export a `type EmployeesStore` interface (TS 5.9 injection workaround, same pattern as `AbsencesStore`).

**State shape:**
```ts
type EmployeesState = {
  employees: EmployeeDto[];
  selected: EmployeeDto | null;
  loading: boolean;
  error: string | null;
  search: string;
  categoryFilter: EmployeeCategory | null;
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE';
};
```

**Computed required:**
- `filteredEmployees` — derives from `employees`, applying:
  1. `search` — case-insensitive match on `firstName + ' ' + lastName`
  2. `categoryFilter` — exact match on `category` when not null
  3. `statusFilter` — `isActive === true` for `ACTIVE`, `isActive === false` for `INACTIVE`, no-op for `ALL`

**Methods required:**
- `load()` — calls `EmployeesApi.list()`, sets `loading`, sets `employees` on success, sets `error` on failure
- `create(dto: CreateEmployeeDto)` — calls `EmployeesApi.create()`, appends to `employees` in-place on success
- `update(id, dto: UpdateEmployeeDto)` — calls `EmployeesApi.update()`, replaces matching entry in `employees` in-place
- `deactivate(id)` — calls `EmployeesApi.terminate()`, then patches matching employee's `isActive` to `false` in-place (NO full reload)
- `select(emp: EmployeeDto | null)` — sets `selected`
- `setSearch(s: string)` — sets `search`
- `setCategory(c: EmployeeCategory | null)` — sets `categoryFilter`
- `setStatus(s: 'ALL'|'ACTIVE'|'INACTIVE')` — sets `statusFilter`

**Acceptance criteria:**
- FR-EMP-15: All state fields, computed, and methods present
- AC-EMP-19: `deactivate()` patches `isActive` in-place without triggering `load()`
- NFR-EMP-02: No `BehaviorSubject` or `ReplaySubject`
- NFR-EMP-03: `inject()` only

**Estimated lines:** ~120
**Dependencies:** T01

---

### [x] T04 — Create `employees.store.spec.ts`

**Files to create:**
- `src/app/features/employees/data-access/employees.store.spec.ts`

**Description:**
Unit tests for `EmployeesStore`. Mock `EmployeesApi` using `TestBed` providers. Assert against signals directly.

**Tests required:**
- `load()` — sets `loading` to true while in flight, sets `employees` on success, resets `loading` to false
- `load()` — sets `error` on failure, resets `loading`
- `create(dto)` — appends new employee to `employees` signal after success
- `update(id, dto)` — replaces matching employee entry in signal after success
- `deactivate(id)` — patches `isActive` to `false` in place; does NOT call `list()` again
- `select(emp)` / `select(null)` — sets and clears `selected`
- `filteredEmployees` — search filter (case-insensitive full-name match)
- `filteredEmployees` — category filter
- `filteredEmployees` — status filter (`ACTIVE` shows only `isActive === true`)
- `filteredEmployees` — combined search + category + status

**Acceptance criteria:**
- NFR-EMP-07: Store spec covers all listed methods and `filteredEmployees` computed
- AC-EMP-19: Dedicated test confirms in-place patch (no reload) on deactivate

**Estimated lines:** ~130
**Dependencies:** T03

---

### [x] T05 — Update `app.routes.ts` — tighten guard to `['ADMIN']`

**Files to modify:**
- `src/app/app.routes.ts`

**Description:**
Locate the `/employees` route definition. Change the `canActivate` (or `canMatch`) guard call from `roleGuard(['ADMIN', 'MANAGER'])` to `roleGuard(['ADMIN'])`.

**Acceptance criteria:**
- AC-EMP-01: MANAGER role is redirected from `/employees`
- AC-EMP-02: ADMIN role can access `/employees`
- FR-EMP-01: Guard array contains only `'ADMIN'`

**Estimated lines:** ~1 (single guard array change)
**Dependencies:** none (can run in parallel with T01–T04)

---

## Slice 2: UI Components + Container

> Requires Slice 1 to be complete. Verified via component specs and manual smoke test.
> Estimated lines: ~400–450

---

### [x] T06 — Create `employee-table.component.ts`

**Files to create:**
- `src/app/features/employees/ui/employee-table.component.ts`

**Description:**
Presentational `OnPush` component. Renders the employee list using PrimeNG `p-table`.

**Inputs:**
- `employees: EmployeeDto[]` (via `input()`)
- `loading: boolean` (via `input()`)

**Outputs:**
- `rowClick` → `output<EmployeeDto>()`
- `edit` → `output<EmployeeDto>()`

**Template requirements:**
- Columns: Full Name, NIF, Category, Contract Type, Hours/Week, Hire Date, Status badge
- While `loading === true`: render skeleton rows (use PrimeNG `p-skeleton`)
- When `employees.length === 0` and not loading: render "No employees yet" empty state
- Row click (anywhere except action buttons) emits `rowClick`
- "Edit" action button per row — emits `edit`; `aria-label="Edit {firstName} {lastName}"`
- Table has `aria-label="Employees"` (NFR-EMP-04)
- Status badge uses text label ("Active" / "Inactive"), not color alone (NFR-EMP-04)
- Table is horizontally scrollable on narrow viewports (NFR-EMP-05)
- `ChangeDetectionStrategy.OnPush` declared (NFR-EMP-01)

**PrimeNG modules:** TableModule, TagModule, SkeletonModule, ButtonModule

**Acceptance criteria:**
- AC-EMP-03: Skeleton rows visible during loading
- AC-EMP-04: 3 rows rendered with all required columns
- AC-EMP-08: Empty state message shown when filtered list is empty
- AC-EMP-20: OnPush declared
- NFR-EMP-04: `aria-label` on table and action buttons

**Estimated lines:** ~130
**Dependencies:** T01, T03

---

### [x] T07 — Create `employee-form.component.ts`

**Files to create:**
- `src/app/features/employees/ui/employee-form.component.ts`

**Description:**
Presentational `OnPush` component. Renders a `p-dialog` with a reactive form for both create and edit modes.

**Inputs:**
- `employee?: EmployeeDto` (via `input()`) — when present, form pre-populates (edit mode)
- `centers: CenterDto[]` (via `input()`) — populates Primary Center dropdown
- `visible: boolean` (via `input()`) — controls dialog visibility
- `serverError?: string` (via `input()`) — displayed when set

**Outputs:**
- `save` → `output<CreateEmployeeDto | UpdateEmployeeDto>()`
- `cancel` → `output<void>()`

**Form fields and validation:**
- First Name: required, maxLength(100)
- Last Name: required, maxLength(100)
- NIF: optional, maxLength(20)
- Category: required, `p-select` from `EMPLOYEE_CATEGORY_VALUES`
- Contract Type: required, `p-select` from `CONTRACT_TYPE_VALUES`
- Contracted Hours/Week: conditionally required — hidden when `contractType !== 'TIEMPO_PARCIAL'`; when visible: required, `min(1)` validator; uses `@if` in template + dynamic validator added/removed via `valueChanges`
- Primary Center: required, `p-select` from `centers` input (renders `id` as value, `name` as label)
- Working Calendar: optional free-text or UUID input (no dropdown — no list endpoint exists per design)
- Hire Date: required, `p-datepicker`

**Behavior:**
- Submit button disabled when form invalid
- Inline per-field error messages
- When `employee` input is set, patch all form fields on init (edit mode pre-population per AC-EMP-13)
- On successful save: `save` output emits the form value; dialog close is handled by parent
- On cancel: `cancel` output emits
- `serverError` displayed in an alert area above the submit button

**PrimeNG modules:** DialogModule, ReactiveFormsModule, SelectModule, DatePickerModule, InputTextModule, InputNumberModule, ButtonModule

**Acceptance criteria:**
- AC-EMP-09: Dialog opens with all fields; submit button disabled on open
- AC-EMP-10: Hours/Week hidden unless `TIEMPO_PARCIAL`; becomes required when visible
- AC-EMP-12: `serverError` displayed without closing dialog
- AC-EMP-13: Form pre-populated when `employee` input is set
- NFR-EMP-01: OnPush
- NFR-EMP-03: `inject()` only (no constructor injection)

**Estimated lines:** ~160
**Dependencies:** T01, T03

---

### [x] T08 — Create `employee-detail.component.ts`

**Files to create:**
- `src/app/features/employees/ui/employee-detail.component.ts`

**Description:**
Presentational `OnPush` component. Renders a `p-dialog` with read-only employee fields, action buttons, and the "Recent Time Entries" section.

**Inputs:**
- `employee: EmployeeDto` (via `input()`) — all fields displayed read-only
- `recentEntries: TimeEntryDto[]` (via `input()`) — up to 10 entries in the entries section
- `entriesLoading: boolean` (via `input()`) — controls skeleton in entries section
- `visible: boolean` (via `input()`) — controls dialog visibility

**Outputs:**
- `edit` → `output<void>()` — triggers transition to edit form in parent
- `deactivate` → `output<string>()` — emits `employee.id`
- `close` → `output<void>()`

**Template requirements:**
- Read-only field grid: all `EmployeeDto` fields formatted (dates via `DatePipe`, booleans as "Active"/"Inactive" badge)
- "Edit" button: always visible
- "Deactivate" button: `@if employee().isActive` — hidden when inactive (AC-EMP-16)
- "Recent Time Entries" section:
  - While `entriesLoading === true`: `p-skeleton` rows
  - When entries present: list up to 10 entries (show date, type, duration or clock-in/out)
  - When entries empty and not loading: "No recent entries" message
- `ChangeDetectionStrategy.OnPush`

**PrimeNG modules:** DialogModule, TagModule, SkeletonModule, ButtonModule, DatePipe

**Acceptance criteria:**
- AC-EMP-14: Detail opens with all read-only fields, Edit button, Deactivate button (when active)
- AC-EMP-15: "Deactivate" button present and emits `deactivate` output
- AC-EMP-16: "Deactivate" button absent when `isActive === false`
- AC-EMP-17: Skeleton in entries section while loading; entries listed or "No recent entries" after
- NFR-EMP-01: OnPush

**Estimated lines:** ~110
**Dependencies:** T01

---

### [x] T09 — Replace `employees.component.ts` smart container

**Files to modify:**
- `src/app/features/employees/feature/employees.component.ts`

**Description:**
Replace the existing placeholder component with the full smart container. This component owns all state coordination and wires `EmployeesStore`, `CentersApi`, `TimeApi`, and the three UI components.

**Responsibilities:**
- Inject `EmployeesStore`, `CentersApi`, `TimeApi`
- On init: call `store.load()` and `CentersApi.list()` (store centers in a local signal)
- Expose search, category, status filter bindings wired to `store.setSearch()`, `store.setCategory()`, `store.setStatus()`
- Pass `store.filteredEmployees()` to `EmployeeTableComponent`; pass `store.loading()` for skeleton state
- Handle `rowClick` from table → `store.select(emp)`, open detail dialog, lazy-fetch time entries via `TimeApi.listEntries({ employeeId: emp.id, limit: 10 })`
- Handle `edit` from table → `store.select(emp)`, open form dialog in edit mode
- Handle "Add Employee" button → open form dialog in create mode (no pre-selected employee)
- Handle `save` from form → call `store.create(dto)` or `store.update(id, dto)` depending on mode; on success close dialog + show toast; on error pass `serverError` back to form
- Handle `deactivate` from detail → open `p-confirmDialog`; on confirm call `store.deactivate(id)`; on success show toast
- Handle `close` from detail → `store.select(null)`, close detail dialog
- Use `ChangeDetectionStrategy.OnPush`
- `inject()` only

**Filter controls in template:**
- Text input wired to search (debounced via `rxjs/operators` `debounceTime`)
- `p-select` for category filter (includes "All" option)
- `p-select` for status filter ("All" / "Active" / "Inactive")

**PrimeNG modules (composed):** ConfirmDialogModule, ToastModule (via MessageService)

**Acceptance criteria:**
- AC-EMP-05: Typing in search filters rows client-side (no new HTTP request)
- AC-EMP-06: Category filter hides non-matching rows
- AC-EMP-07: Status filter shows only active employees
- AC-EMP-08: "No results match your filters" shown when `filteredEmployees` empty
- AC-EMP-11: On successful create, new employee appears in table without reload, dialog closes, toast shown
- AC-EMP-15: On successful deactivate, employee status updates in list, Deactivate button disappears in detail
- FR-EMP-07: "Add Employee" button in page header
- NFR-EMP-01: OnPush
- NFR-EMP-06: Loading state does not block shell navigation

**Estimated lines:** ~150
**Dependencies:** T03, T05, T06, T07, T08

---

### [x] T10 — Smoke-test checklist (manual verification)

**Files:** none (verification steps only)

**Description:**
Manual end-to-end steps to confirm the feature works in the running dev environment before marking the change ready for review.

**Checklist:**

**Route guard:**
- [ ] Log in as MANAGER → navigate to `/employees` → confirm redirect (AC-EMP-01)
- [ ] Log in as ADMIN → navigate to `/employees` → confirm list page renders (AC-EMP-02)

**List + filters:**
- [ ] Page loads → skeleton rows visible briefly, then employee rows render (AC-EMP-03/04)
- [ ] Type a partial name in search → matching rows shown, no network request fires (AC-EMP-05)
- [ ] Select a category in the dropdown → only that category visible (AC-EMP-06)
- [ ] Select "Active" in status filter → only active employees shown (AC-EMP-07)
- [ ] Combine search + filters so no row matches → "No results match your filters" message (AC-EMP-08)

**Create employee:**
- [ ] Click "Add Employee" → dialog opens with empty fields, submit disabled (AC-EMP-09)
- [ ] Set Contract Type to `TIEMPO_PARCIAL` → Hours/Week field appears and is required (AC-EMP-10)
- [ ] Clear Contract Type back → Hours/Week hidden again (AC-EMP-10)
- [ ] Fill all required fields → submit → new employee appears in table, toast shown (AC-EMP-11)
- [ ] Force a 4xx by submitting duplicate NIF or bad data → dialog stays open, server error displayed (AC-EMP-12)

**Edit employee:**
- [ ] Click Edit on a row → dialog opens pre-populated with that employee's values (AC-EMP-13)
- [ ] Change a field → submit → employee row updates in table (FR-EMP-10)

**Detail view:**
- [ ] Click a row (not action button) → detail dialog opens with all fields read-only, Edit and Deactivate buttons (AC-EMP-14)
- [ ] Detail opens → "Recent Time Entries" skeleton appears, then entries or "No recent entries" (AC-EMP-17)
- [ ] Click Deactivate → confirmation dialog appears → confirm → status badge changes to "Inactive", Deactivate button disappears (AC-EMP-15)
- [ ] Open detail for an inactive employee → no Deactivate button rendered (AC-EMP-16)

**Accessibility spot-check:**
- [ ] Table has `aria-label="Employees"` (inspect DOM)
- [ ] Each Edit button has `aria-label="Edit {name}"` (inspect DOM)
- [ ] Status badges show "Active"/"Inactive" text (not color-only)

**Dependencies:** T09 (all previous tasks complete, dev server running)

---

## Parallel / Sequential Map

```
T05 ─────────────────────────────────────┐
                                         │
T01 → T02                                │
T01 → T03 → T04                          │
                                         ▼
                               T06, T07, T08 (can run in parallel)
                               T06 + T07 + T08 + T03 + T05 → T09 → T10
```

- **T01 and T05** can start immediately and in parallel (T01 and T05 have no dependencies)
- **T02** requires T01 (needs the service to test)
- **T03** requires T01 (store depends on the api)
- **T04** requires T03
- **T06, T07, T08** require T01 (for DTOs/types); T03 for type imports — can run in parallel with each other after T01 + T03
- **T09** requires T03, T05, T06, T07, T08 — final wiring
- **T10** requires T09

---

## Review Workload Forecast

Estimated changed lines: ~750
400-line budget risk: High
Chained PRs recommended: Yes
Chain strategy: pending
Decision needed before apply: Yes

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Slice 1 (T01–T05) → Slice 2 (T06–T10) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — decision needed before apply |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Data-access + routing (~350 lines) | PR 1 | `employees.api.ts`, `employees.store.ts`, both specs, route guard; self-verifying via unit tests |
| 2 | UI components + smart container (~400–450 lines) | PR 2 | Table, form, detail, `employees.component.ts` wiring; depends on PR 1 |
