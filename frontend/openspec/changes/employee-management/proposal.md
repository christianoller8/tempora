# Proposal: Employee Management Section (ADMIN)

## Intent

Tempora's `/employees` route is a placeholder. ADMINs cannot manage staff from the UI despite a working backend `/employees` API. We need a full Employee Management section (list, create/edit, detail with soft-delete and recent activity) so admins manage the workforce without DB access. Building it now unblocks shift/absence assignment workflows that depend on accurate employee records.

## Scope

### In Scope
- Employee list page at `/employees`: `p-table` with Name, Email, Role, Category, Contract Type, Status; name/email search; role/category/status filters; "Add Employee" button.
- Create/Edit employee form (`p-dialog`): First/Last Name, Email, Role, Category, Contract Type, Contracted Hours/Week, Hire Date; reactive form validation.
- Detail view: full info, Edit, Activate/Deactivate (soft-delete via terminate), recent time-entries summary.
- `data-access` layer: `employees.api.ts` (DTOs + HTTP) and `employees.store.ts` (ngrx/signals).
- Tighten route guard to `roleGuard(['ADMIN'])`.

### Out of Scope
- Backend changes (new endpoints, schema for email/role on Employee). Flagged as a dependency below.
- A dedicated reactivate endpoint (backend only has terminate). Reactivate deferred or stubbed.
- Bulk import/export, pagination beyond client-side, center/calendar management UI.

## Capabilities

### New Capabilities
- `employee-management`: list, search/filter, create, edit, view detail, and soft-delete (deactivate) employees from the ADMIN UI, plus recent time-entry summary on detail.

### Modified Capabilities
- None.

## Approach

- Mirror existing feature structure: `features/employees/{feature,data-access,ui}`. Smart container `EmployeesComponent` (list + dialogs) using signals + `inject()`, `OnPush`.
- `EmployeesStore` (signalStore, `providedIn: 'root'`) holds `employees`, `selected`, `loading`, `error`; `computed` for client-side filtered list. Methods: `load`, `create`, `update`, `deactivate`, `select`.
- `EmployeesApi` wraps `ApiService`. NOTE: backend list returns a bare array, not `{ data }` — API layer adapts the shape; do NOT copy the absences `{ data }` unwrap.
- Email/Role are not on the Prisma `Employee` model (they live on the linked `User`). Treat as a data-model gap: spec/design must resolve whether to render from a join, hide, or block on backend. Form maps remaining fields to `CreateEmployeeSchema`/`UpdateEmployeeSchema`.
- Reuse dark-theme PrimeNG patterns from dashboard/absences; `p-tag` for status, `p-skeleton` for loading.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/features/employees/feature/employees.component.ts` | Modified | Replace placeholder with list + dialogs container |
| `src/app/features/employees/data-access/` | New | `employees.api.ts`, `employees.store.ts` (+ specs) |
| `src/app/features/employees/ui/` | New | Form, detail, table presentational pieces |
| `src/app/app.routes.ts` | Modified | Guard `['ADMIN','MANAGER']` → `['ADMIN']` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Email/Role absent on Employee model | High | Resolve in spec/design; surface from User join or descope fields |
| No reactivate endpoint | Med | Confirm with backend; stub or hide reactivate until added |
| List response shape mismatch (`{ data }` vs array) | Med | Normalize in `employees.api.ts`; cover with unit test |
| Recent time-entries needs extra fetch | Med | Reuse `TimeApi`; lazy-load on detail open |

## Rollback Plan

Revert the feature commit. Route falls back to the placeholder component and the prior `['ADMIN','MANAGER']` guard. No backend or schema changes are made, so no data migration to undo.

## Dependencies

- Backend `/employees` endpoints (exist: list, get, create, update, terminate, contract).
- Clarification on email/role data source and reactivate support (blocking for full form fidelity).
- `TimeApi` for recent time-entries summary.

## Success Criteria

- [ ] ADMIN sees a searchable, filterable employee table at `/employees`; non-ADMIN is blocked.
- [ ] ADMIN can create and edit an employee with full reactive-form validation.
- [ ] Detail view shows employee info, recent time entries, and a working deactivate (soft-delete) action.
- [ ] All state via signals/`OnPush`/`inject()`; data-access unit tests pass.
