import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { EmployeesApi } from './employees.api';
import type { EmployeeDto, CreateEmployeeDto, UpdateEmployeeDto } from './employees.api';
import type { EmployeeCategory } from '@tempora/shared';

// ---------------------------------------------------------------------------
// State shape — FR-EMP-15
// ---------------------------------------------------------------------------

type EmployeesState = {
  employees: EmployeeDto[];
  selected: EmployeeDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  search: string;
  categoryFilter: EmployeeCategory | null;
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE';
};

const initialState: EmployeesState = {
  employees: [],
  selected: null,
  loading: false,
  saving: false,
  error: null,
  search: '',
  categoryFilter: null,
  statusFilter: 'ACTIVE',
};

// ---------------------------------------------------------------------------
// EmployeesStore — signalStore, providedIn: 'root'
// FR-EMP-15, NFR-EMP-02 (signal-only), NFR-EMP-03 (inject() only)
// ---------------------------------------------------------------------------

export const EmployeesStore = signalStore(
  { providedIn: 'root' },
  withState<EmployeesState>(initialState),
  withComputed(({ employees, search, categoryFilter, statusFilter }) => ({
    /**
     * filteredEmployees — derived from the full employee list, applying:
     * 1. search: case-insensitive match on firstName + ' ' + lastName
     * 2. categoryFilter: exact match when not null
     * 3. statusFilter: isActive === true | false | no-op
     */
    filteredEmployees: computed(() => {
      const term = search().trim().toLowerCase();
      const category = categoryFilter();
      const status = statusFilter();

      return employees().filter((emp) => {
        if (term) {
          const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
          if (!fullName.includes(term)) return false;
        }
        if (category !== null && emp.category !== category) return false;
        if (status === 'ACTIVE' && !emp.isActive) return false;
        if (status === 'INACTIVE' && emp.isActive) return false;
        return true;
      });
    }),
  })),
  withMethods((store) => {
    const api = inject(EmployeesApi);
    return {
      /**
       * load() — fetches full employee list; sets loading flag around the call.
       */
      async load(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const employees = await firstValueFrom(api.list());
          patchState(store, { employees, loading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load employees';
          patchState(store, { loading: false, error: message });
        }
      },

      /**
       * create() — POSTs a new employee; appends result to in-memory list.
       */
      async create(dto: CreateEmployeeDto): Promise<void> {
        patchState(store, { saving: true, error: null });
        try {
          const created = await firstValueFrom(api.create(dto));
          patchState(store, {
            employees: [...store.employees(), created],
            saving: false,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create employee';
          patchState(store, { saving: false, error: message });
          throw err; // re-throw so the form container can show the server error
        }
      },

      /**
       * update() — PATCHes an employee; replaces matching entry in-memory.
       */
      async update(id: string, dto: UpdateEmployeeDto): Promise<void> {
        console.log('[Store.update] id:', id, 'dto:', JSON.stringify(dto));
        patchState(store, { saving: true, error: null });
        try {
          const updated = await firstValueFrom(api.update(id, dto));
          patchState(store, {
            employees: store.employees().map((e) => (e.id === id ? updated : e)),
            saving: false,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update employee';
          patchState(store, { saving: false, error: message });
          throw err;
        }
      },

      /**
       * deactivate() — POSTs to /employees/:id/terminate then patches isActive
       * to false in-place.  Does NOT trigger a full reload (AC-EMP-19).
       */
      async deactivate(id: string): Promise<void> {
        try {
          await firstValueFrom(api.terminate(id));
          patchState(store, {
            employees: store.employees().map((e) =>
              e.id === id ? { ...e, isActive: false } : e,
            ),
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to deactivate employee';
          patchState(store, { error: message });
          throw err;
        }
      },

      /** select() — sets or clears the currently viewed/edited employee. */
      select(emp: EmployeeDto | null): void {
        patchState(store, { selected: emp });
      },

      /** setSearch() — updates the search filter string. */
      setSearch(s: string): void {
        patchState(store, { search: s });
      },

      /** setCategory() — sets or clears the category filter. */
      setCategory(c: EmployeeCategory | null): void {
        patchState(store, { categoryFilter: c });
      },

      /** setStatus() — sets the status filter. */
      setStatus(s: 'ALL' | 'ACTIVE' | 'INACTIVE'): void {
        patchState(store, { statusFilter: s });
      },

      /** reactivate() — PATCHes isActive:true; updates entry in-memory. */
      async reactivate(id: string): Promise<void> {
        try {
          const updated = await firstValueFrom(api.reactivate(id));
          patchState(store, {
            employees: store.employees().map((e) => (e.id === id ? updated : e)),
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to reactivate employee';
          patchState(store, { error: message });
          throw err;
        }
      },
    };
  }),
);

// ---------------------------------------------------------------------------
// TypeScript 5.9 workaround: export explicit type for injection sites.
// Same pattern as AbsencesStore and TimeStore.
// ---------------------------------------------------------------------------
export type EmployeesStore = {
  employees(): EmployeeDto[];
  selected(): EmployeeDto | null;
  loading(): boolean;
  saving(): boolean;
  error(): string | null;
  search(): string;
  categoryFilter(): EmployeeCategory | null;
  statusFilter(): 'ALL' | 'ACTIVE' | 'INACTIVE';
  filteredEmployees(): EmployeeDto[];
  load(): Promise<void>;
  create(dto: CreateEmployeeDto): Promise<void>;
  update(id: string, dto: UpdateEmployeeDto): Promise<void>;
  deactivate(id: string): Promise<void>;
  select(emp: EmployeeDto | null): void;
  setSearch(s: string): void;
  setCategory(c: EmployeeCategory | null): void;
  setStatus(s: 'ALL' | 'ACTIVE' | 'INACTIVE'): void;
  reactivate(id: string): Promise<void>;
};
