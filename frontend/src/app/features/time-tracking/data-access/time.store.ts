import { computed, inject, effect } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SseService } from '../../../core/sse/sse.service';
import { TimeApi } from './time.api';
import type { TimeEntryDto } from './time.api';

// ---------------------------------------------------------------------------
// TimeStore — manages clock state and time entries.
// Reacts to SSE events for real-time dashboard updates (FR-TIME-9).
// ---------------------------------------------------------------------------

type TimeState = {
  currentEntry: TimeEntryDto | null;
  entries: TimeEntryDto[];
  isClocking: boolean;
  error: string | null;
};

const initialState: TimeState = {
  currentEntry: null,
  entries: [],
  isClocking: false,
  error: null,
};

export const TimeStore = signalStore(
  { providedIn: 'root' },
  withState<TimeState>(initialState),
  withComputed(({ currentEntry }) => ({
    isClockedIn: computed(() => currentEntry()?.status === 'OPEN'),
    clockInTime: computed(() => currentEntry()?.clockIn ?? null),
  })),
  withMethods((store, api = inject(TimeApi)) => ({
    async clockIn(): Promise<void> {
      patchState(store, { isClocking: true, error: null });
      try {
        const entry = await firstValueFrom(api.clockIn());
        patchState(store, { currentEntry: entry, isClocking: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Clock-in failed';
        patchState(store, { isClocking: false, error: message });
      }
    },

    async clockOut(): Promise<void> {
      patchState(store, { isClocking: true, error: null });
      try {
        const entry = await firstValueFrom(api.clockOut());
        patchState(store, { currentEntry: entry, isClocking: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Clock-out failed';
        patchState(store, { isClocking: false, error: message });
      }
    },

    async loadEntries(params?: { employeeId?: string; status?: string }): Promise<void> {
      try {
        const entries = await firstValueFrom(api.listEntries(params));
        // Set currentEntry to the first OPEN entry if any.
        const openEntry = entries.find((e) => e.status === 'OPEN') ?? null;
        patchState(store, { entries, currentEntry: openEntry });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load entries';
        patchState(store, { error: message });
      }
    },

    updateEntryFromEvent(entry: TimeEntryDto): void {
      const entries = store.entries();
      const existing = entries.findIndex((e) => e.id === entry.id);
      const updated =
        existing >= 0
          ? [...entries.slice(0, existing), entry, ...entries.slice(existing + 1)]
          : [entry, ...entries];
      const currentEntry = entry.status === 'OPEN' ? entry : store.currentEntry();
      patchState(store, { entries: updated, currentEntry });
    },
  })),
  withHooks((store, sse = inject(SseService)) => ({
    onInit() {
      // Connect SSE and react to CLOCK_IN / CLOCK_OUT events for real-time updates.
      sse.connect();

      effect(() => {
        const event = sse.lastEvent();
        if (!event) return;
        if (event.type === 'CLOCK_IN' || event.type === 'CLOCK_OUT') {
          // Re-load entries to get the latest state from server.
          store.loadEntries();
        }
      });
    },
  })),
);
