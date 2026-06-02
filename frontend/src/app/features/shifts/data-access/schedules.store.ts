import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import type { ShiftSchedule, RuleCheckResult, CreateSchedule } from './shifts.api';
import { ShiftsApi } from './shifts.api';

// ---------------------------------------------------------------------------
// SchedulesStore — NgRx SignalStore managing the ShiftSchedule list.
// Plain array state (not withEntities) for TypeScript 5.9 compatibility.
// ---------------------------------------------------------------------------

type SchedulesState = {
  schedules: ShiftSchedule[];
  loading: boolean;
  error: string | null;
  lastWarnings: RuleCheckResult[];
};

const initialState: SchedulesState = {
  schedules: [],
  loading: false,
  error: null,
  lastWarnings: [],
};

export const SchedulesStore = signalStore(
  { providedIn: 'root' },
  withState<SchedulesState>(initialState),
  withComputed(({ schedules }) => ({
    draftSchedules: computed(() =>
      (schedules() as ShiftSchedule[]).filter((s: ShiftSchedule) => s.status === 'DRAFT'),
    ),
    publishedSchedules: computed(() =>
      (schedules() as ShiftSchedule[]).filter((s: ShiftSchedule) => s.status === 'PUBLISHED'),
    ),
  })),
  withMethods((store) => {
    const api = inject(ShiftsApi);
    return {
      async loadSchedules(params?: { centerId?: string; year?: string; month?: string }): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const schedules = await firstValueFrom(api.listSchedules(params));
          patchState(store, { schedules, loading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load schedules';
          patchState(store, { loading: false, error: message });
        }
      },

      async createSchedule(dto: CreateSchedule): Promise<ShiftSchedule> {
        patchState(store, { loading: true, error: null });
        try {
          const schedule = await firstValueFrom(api.createSchedule(dto));
          patchState(store, { schedules: [...store.schedules(), schedule], loading: false });
          return schedule;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create schedule';
          patchState(store, { loading: false, error: message });
          throw err;
        }
      },

      async publishSchedule(id: string): Promise<RuleCheckResult[]> {
        patchState(store, { loading: true, error: null, lastWarnings: [] });
        try {
          const result = await firstValueFrom(api.publishSchedule(id));
          patchState(store, {
            schedules: store.schedules().map((sc: ShiftSchedule) =>
              sc.id === id ? result.schedule : sc,
            ),
            loading: false,
            lastWarnings: result.warnings,
          });
          return result.warnings;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to publish schedule';
          patchState(store, { loading: false, error: message });
          throw err;
        }
      },

      clearWarnings(): void {
        patchState(store, { lastWarnings: [] });
      },
    };
  }),
);

// TypeScript 5.9 workaround: export explicit interface for injection sites.
export type SchedulesStore = {
  schedules(): ShiftSchedule[];
  loading(): boolean;
  error(): string | null;
  lastWarnings(): RuleCheckResult[];
  draftSchedules(): ShiftSchedule[];
  publishedSchedules(): ShiftSchedule[];
  loadSchedules(params?: { centerId?: string; year?: string; month?: string }): Promise<void>;
  createSchedule(dto: CreateSchedule): Promise<ShiftSchedule>;
  publishSchedule(id: string): Promise<RuleCheckResult[]>;
  clearWarnings(): void;
};
