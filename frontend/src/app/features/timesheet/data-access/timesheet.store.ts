import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TimesheetApi } from './timesheet.api';
import type {
  TimesheetSummaryDto,
  TimesheetSignatureDto,
  ConfirmationStatusRowDto,
} from './timesheet.api';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type TimesheetState = {
  summary: TimesheetSummaryDto | null;
  statusList: ConfirmationStatusRowDto[];
  selectedYear: number;
  selectedMonth: number;
  loading: boolean;
  error: string | null;
  /** Set to true after a successful confirmMonth() call. Reset to null on next loadSummary. */
  confirmedOverride: boolean | null;
};

const now = new Date();

const initialState: TimesheetState = {
  summary: null,
  statusList: [],
  selectedYear: now.getFullYear(),
  selectedMonth: now.getMonth() + 1,
  loading: false,
  error: null,
  confirmedOverride: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const TimesheetStore = signalStore(
  { providedIn: 'root' },
  withState<TimesheetState>(initialState),
  withComputed(({ summary }) => ({
    /** True when the employee can submit a confirmation (not yet confirmed and no open entries). */
    canConfirm: computed(() => {
      const s = summary();
      if (!s) return false;
      return !s.confirmed && !s.hasOpenEntry;
    }),
  })),
  withMethods((store) => {
    const api = inject(TimesheetApi);
    return {
      /**
       * True when the current month is confirmed.
       * Reads confirmedOverride first (set after a successful confirm()), then falls back to summary.confirmed.
       */
      isConfirmed(): boolean {
        return store.confirmedOverride() ?? store.summary()?.confirmed ?? false;
      },

      /**
       * Load the employee monthly summary.
       * Optionally pass employeeId for manager/admin view.
       */
      async loadSummary(year: number, month: number, employeeId?: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const summary = await firstValueFrom(api.getSummary(year, month, employeeId));
          patchState(store, { summary, confirmedOverride: null, selectedYear: year, selectedMonth: month, loading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load timesheet summary';
          patchState(store, { loading: false, error: message });
        }
      },

      /**
       * Confirm the employee's monthly timesheet.
       * On success, sets confirmedOverride = true so isConfirmed() returns true immediately.
       * Re-throws so the caller (component) can show a success/error toast.
       */
      async confirmMonth(year: number, month: number): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const sig: TimesheetSignatureDto = await firstValueFrom(api.confirmMonth(year, month));
          patchState(store, (state) => ({
            confirmedOverride: true,
            summary: state.summary
              ? { ...state.summary, confirmed: true, confirmedAt: sig.confirmedAt }
              : null,
            loading: false,
          }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to confirm timesheet';
          patchState(store, { loading: false, error: message });
          throw err; // re-throw so the component can show an error toast
        }
      },

      /**
       * Load the confirmation-status list (manager/admin only).
       * Optionally pass centerId for center-scoped filtering.
       */
      async loadStatus(year: number, month: number, centerId?: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const statusList = await firstValueFrom(api.getConfirmationStatus(year, month, centerId));
          patchState(store, { statusList, selectedYear: year, selectedMonth: month, loading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load confirmation status';
          patchState(store, { loading: false, error: message });
        }
      },
    };
  }),
);

// ---------------------------------------------------------------------------
// TypeScript 5.9 workaround: export explicit interface for injection sites.
// Consumers cast via `inject(TimesheetStore) as unknown as TimesheetStore`.
// ---------------------------------------------------------------------------

export type TimesheetStore = {
  summary(): TimesheetSummaryDto | null;
  statusList(): ConfirmationStatusRowDto[];
  selectedYear(): number;
  selectedMonth(): number;
  loading(): boolean;
  error(): string | null;
  confirmedOverride(): boolean | null;
  isConfirmed(): boolean;
  canConfirm(): boolean;
  loadSummary(year: number, month: number, employeeId?: string): Promise<void>;
  confirmMonth(year: number, month: number): Promise<void>;
  loadStatus(year: number, month: number, centerId?: string): Promise<void>;
};
