import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import type { ShiftSchedule, RuleCheckResult, CreateSchedule } from './shifts.api';
import { ShiftsApi } from './shifts.api';

// ---------------------------------------------------------------------------
// SchedulesStore — NgRx SignalStore with entity collection for ShiftSchedule.
// Handles rule violation warnings from publish responses.
// ---------------------------------------------------------------------------

type SchedulesState = {
  loading: boolean;
  error: string | null;
  lastWarnings: RuleCheckResult[];
};

const initialState: SchedulesState = {
  loading: false,
  error: null,
  lastWarnings: [],
};

export const SchedulesStore = signalStore(
  { providedIn: 'root' },
  withState<SchedulesState>(initialState),
  withEntities<ShiftSchedule>(),
  withComputed(({ entities }) => ({
    draftSchedules: computed(() => entities().filter((s) => s.status === 'DRAFT')),
    publishedSchedules: computed(() => entities().filter((s) => s.status === 'PUBLISHED')),
    hasWarnings: computed(() => initialState.lastWarnings.length > 0),
  })),
  withMethods((store, api = inject(ShiftsApi)) => ({
    async loadSchedules(params?: { centerId?: string; year?: string; month?: string }): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const schedules = await firstValueFrom(api.listSchedules(params));
        patchState(store, setAllEntities(schedules), { loading: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load schedules';
        patchState(store, { loading: false, error: message });
      }
    },

    async createSchedule(dto: CreateSchedule): Promise<ShiftSchedule> {
      patchState(store, { loading: true, error: null });
      try {
        const schedule = await firstValueFrom(api.createSchedule(dto));
        patchState(store, setEntity(schedule), { loading: false });
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
        patchState(store, setEntity(result.schedule), {
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
  })),
);
