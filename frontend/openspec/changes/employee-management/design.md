# Design: Employee Management Section (ADMIN)

## Technical Approach

Implement the `/employees` feature mirroring the existing `absences` slice: smart container + signalStore + thin API service + presentational UI. State is signal-only, `OnPush` everywhere, `inject()` only. Client-side filtering via a `computed`. List/single/centers responses are bare (no `{ data }` unwrap — contrast with `AbsencesApi`). Recent time entries reuse `TimeApi.listEntries`, lazy on detail open. Email/Role are descoped per spec (Option A). See spec FR-EMP-01..16.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|-----------------------|-----------|
| Response unwrap | No `.map(res => res.data)` in `EmployeesApi`/`CentersApi` | Copy absences `{ data }` unwrap | Confirmed `GET /employees` and `GET /centers` both `res.json(array)` — bare arrays |
| Centers dropdown | New `CentersApi.list()` → `GET /centers` (bare array) | Hardcoded constant | Real endpoint exists (`app.use('/centers', ...)`, `listCentersHandler`) |
| Working calendar field | Optional plain text/UUID input, NOT a dropdown | Calendar dropdown | No working-calendar list endpoint exists; descope to optional input |
| Enums source | Import `EMPLOYEE_CATEGORY_VALUES`, `CONTRACT_TYPE_VALUES` from `@tempora/shared` | Local literal arrays | Shared package already imported as runtime values in `shifts.api.ts` |
| Store typing | signalStore + exported `type EmployeesStore` interface | Plain service with signals | Matches `AbsencesStore` (TS 5.9 injection workaround) |
| Detail container | Detail rendered inside `EmployeesComponent` as a `p-dialog`, not a route | Child route `/employees/:id` | Spec FR-EMP-11 says panel/dialog; keeps single smart container |

## Data Flow

    EmployeesComponent (smart, OnPush)
      ├─ EmployeesStore.load() ──→ EmployeesApi.list() ──→ GET /employees
      ├─ CentersApi.list() (for form dropdown) ──→ GET /centers
      ├─ filteredEmployees() ──→ EmployeeTableComponent [employees] input
      │        table emits (rowClick|edit) ──→ store.select() / open dialog
      ├─ EmployeeFormComponent (save) ──→ store.create()/update() ──→ POST/PATCH
      └─ EmployeeDetailComponent
             ├─ (deactivate) ──→ confirm ──→ store.deactivate() ──→ POST /:id/terminate
             └─ on open ──→ TimeApi.listEntries({employeeId, ...}) (cap 10)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `features/employees/data-access/employees.api.ts` | Create | DTOs + `EmployeesApi` (no unwrap) + `CentersApi.list()` + `CenterDto` |
| `features/employees/data-access/employees.api.spec.ts` | Create | Bare-array shape test (no `.data`), all verbs |
| `features/employees/data-access/employees.store.ts` | Create | signalStore: state, `filteredEmployees`, methods |
| `features/employees/data-access/employees.store.spec.ts` | Create | load/create/update/deactivate/select + computed |
| `features/employees/feature/employees.component.ts` | Modify | Replace placeholder with smart container (list + dialogs) |
| `features/employees/ui/employee-table.component.ts` | Create | Presentational `p-table` |
| `features/employees/ui/employee-form.component.ts` | Create | Presentational `p-dialog` reactive form |
| `features/employees/ui/employee-detail.component.ts` | Create | Presentational detail dialog + recent entries |
| `app.routes.ts` | Modify | `/employees` guard `['ADMIN','MANAGER']` → `['ADMIN']` |

## Interfaces / Contracts

```ts
// EmployeesApi (providedIn: 'root') — NO .data unwrap
list(params?: { activeOnly?: boolean }): Observable<EmployeeDto[]>   // GET /employees?activeOnly
getById(id: string): Observable<EmployeeDto>                          // GET /employees/:id
create(dto: CreateEmployeeDto): Observable<EmployeeDto>               // POST /employees (201)
update(id: string, dto: UpdateEmployeeDto): Observable<EmployeeDto>   // PATCH /employees/:id
terminate(id: string): Observable<void>                              // POST /employees/:id/terminate (204)

// CentersApi (same file) — bare array
list(): Observable<CenterDto[]>                                      // GET /centers
// CenterDto: { id: string; name: string }  (minimal projection used by dropdown)
```

EmployeeDto / CreateEmployeeDto / UpdateEmployeeDto / enums: authoritative shapes per spec "Data Contract Decision".

```ts
// EmployeesStore state
type EmployeesState = {
  employees: EmployeeDto[]; selected: EmployeeDto | null;
  loading: boolean; error: string | null;
  search: string; categoryFilter: EmployeeCategory | null; statusFilter: 'ALL'|'ACTIVE'|'INACTIVE';
};
// computed filteredEmployees: search(name, case-insensitive) ∧ category ∧ status
// methods: load(), create(dto), update(id,dto), deactivate(id) [terminate + in-place isActive=false],
//          select(emp|null), setSearch(s), setCategory(c), setStatus(s)
```

### Component contracts (`input()`/`output()`, all `OnPush`)

| Component | Inputs | Outputs | PrimeNG |
|-----------|--------|---------|---------|
| `EmployeeTableComponent` | `employees: EmployeeDto[]`, `loading: boolean` | `rowClick`, `edit`(EmployeeDto) | TableModule, TagModule, SkeletonModule, ButtonModule |
| `EmployeeFormComponent` | `employee?: EmployeeDto`, `centers: CenterDto[]`, `visible: boolean`, `serverError?: string` | `save`(Create\|UpdateEmployeeDto), `cancel` | DialogModule, ReactiveFormsModule, SelectModule, DatePickerModule, InputTextModule, InputNumberModule, ButtonModule |
| `EmployeeDetailComponent` | `employee: EmployeeDto`, `recentEntries: TimeEntryDto[]`, `entriesLoading: boolean`, `visible: boolean` | `edit`, `deactivate`(id), `close` | DialogModule, TagModule, SkeletonModule, ButtonModule, DatePipe |
| `EmployeesComponent` (smart) | — | — | composes the above 3 + ConfirmDialog/Toast |

Form template blocks: First/Last Name, NIF, Category select, ContractType select, conditional Hours/Week (`@if contractType==='TIEMPO_PARCIAL'` → visible+required+>0 validator wired via `valueChanges`), Primary Center select, Working Calendar optional input, Hire Date picker. Detail blocks: read-only field grid, Edit btn, Deactivate btn (`@if employee.isActive`), Recent Time Entries (skeleton | list | empty).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit (API) | bare-array no-unwrap, all verbs, terminate→void | `HttpTestingController`, mirror existing api specs |
| Unit (Store) | load/create/update/deactivate(in-place isActive=false)/select, `filteredEmployees` (search+category+status) | Mock `EmployeesApi`, signal assertions |
| Component | OnPush declared, conditional hours field, deactivate hidden when inactive | TestBed component specs (per AC list) |

STRICT TDD applies during apply: write the spec, watch it fail, implement.

## Migration / Rollout

No migration. No backend/schema changes. Rollback = revert the feature commit; route falls back to placeholder + prior `['ADMIN','MANAGER']` guard.

## Open Questions

- [ ] None blocking. Reactivate intentionally absent (no endpoint). Working calendar is an optional free input until a list endpoint exists.

## Review Workload Forecast

Estimated changed lines: ~700–850 (3 UI components ~120-180 each, smart container ~150, api ~90, store ~120, 2 specs ~150, routes 1-line). **Over the 400-line budget.**

- `400-line budget risk: High`
- `Chained PRs recommended: Yes`
- `Decision needed before apply: Yes`

Suggested slices: (1) data-access — `employees.api.ts` + `employees.store.ts` + specs + route guard (~350 lines, self-verifying via unit tests); (2) UI — table + form + detail + smart container wiring (~400-450 lines, verified via component specs/manual).
