import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AbsencesApi } from './absences.api';
import type { AbsenceDto, AbsenceBalanceDto, CreateAbsenceDto } from './absences.api';

// ---------------------------------------------------------------------------
// AbsencesStore — satisfies FR-ABS-1..7
// SignalStore: absences entity list, balance signal, loading signal.
// ---------------------------------------------------------------------------

type AbsencesState = {
  absences: AbsenceDto[];
  balance: AbsenceBalanceDto | null;
  loading: boolean;
  error: string | null;
};

const initialState: AbsencesState = {
  absences: [],
  balance: null,
  loading: false,
  error: null,
};

export const AbsencesStore = signalStore(
  { providedIn: 'root' },
  withState<AbsencesState>(initialState),
  withComputed(({ balance }) => ({
    // Computed signal: remaining vacation days — null when balance not loaded.
    remainingDays: computed(() => balance()?.remaining ?? null),
    // Computed signal: pending absences (for approval queue).
    isBalanceLoaded: computed(() => balance() !== null),
  })),
  withMethods((store) => {
    const api = inject(AbsencesApi);
    return ({
    async loadAbsences(filter?: { employeeId?: string; status?: string; type?: string }): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const absences = await firstValueFrom(api.listAbsences(filter));
        patchState(store, { absences, loading: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load absences';
        patchState(store, { loading: false, error: message });
      }
    },

    async createAbsence(dto: CreateAbsenceDto): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const created = await firstValueFrom(api.createAbsence(dto));
        patchState(store, { absences: [created, ...store.absences()], loading: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create absence';
        patchState(store, { loading: false, error: message });
        throw err; // re-throw so forms can show validation errors
      }
    },

    async approveAbsence(id: string, comment?: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const updated = await firstValueFrom(api.approveAbsence(id, comment));
        patchState(store, {
          absences: store.absences().map((a: AbsenceDto) => (a.id === id ? updated : a)),
          loading: false,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to approve absence';
        patchState(store, { loading: false, error: message });
      }
    },

    async rejectAbsence(id: string, comment?: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const updated = await firstValueFrom(api.rejectAbsence(id, comment));
        patchState(store, {
          absences: store.absences().map((a: AbsenceDto) => (a.id === id ? updated : a)),
          loading: false,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to reject absence';
        patchState(store, { loading: false, error: message });
      }
    },

    async loadBalance(employeeId?: string, year?: number): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const balance = await firstValueFrom(api.getBalance({ employeeId, year }));
        patchState(store, { balance, loading: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load balance';
        patchState(store, { loading: false, error: message });
      }
    },
  });
  }),
);

// TypeScript 5.9 workaround: export explicit interface for injection sites.
export type AbsencesStore = {
  absences(): AbsenceDto[];
  balance(): AbsenceBalanceDto | null;
  loading(): boolean;
  error(): string | null;
  remainingDays(): number | null;
  isBalanceLoaded(): boolean;
  loadAbsences(filter?: { employeeId?: string; status?: string; type?: string }): Promise<void>;
  createAbsence(dto: CreateAbsenceDto): Promise<void>;
  approveAbsence(id: string, comment?: string): Promise<void>;
  rejectAbsence(id: string, comment?: string): Promise<void>;
  loadBalance(employeeId?: string, year?: number): Promise<void>;
};
