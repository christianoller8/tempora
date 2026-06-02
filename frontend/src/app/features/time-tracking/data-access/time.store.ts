import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TimeApi } from './time.api';
import type { TimeEntryDto } from './time.api';

// withHooks omitted — TypeScript 5.9 cannot infer the store type when withHooks is present.
// SseService.connect() is called from ClockComponent / LiveDashboardComponent instead.

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
  withMethods((store) => {
    const api = inject(TimeApi);
    return {
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
          const openEntry = entries.find((e) => e.status === 'OPEN') ?? null;
          patchState(store, { entries, currentEntry: openEntry });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load entries';
          patchState(store, { error: message });
        }
      },

      updateEntryFromEvent(entry: TimeEntryDto): void {
        const entries = store.entries() as TimeEntryDto[];
        const existing = entries.findIndex((e: TimeEntryDto) => e.id === entry.id);
        const updated =
          existing >= 0
            ? [...entries.slice(0, existing), entry, ...entries.slice(existing + 1)]
            : [entry, ...entries];
        const currentEntry = entry.status === 'OPEN' ? entry : store.currentEntry();
        patchState(store, { entries: updated, currentEntry });
      },
    };
  }),
);

// TypeScript 5.9 workaround: export explicit interface for injection sites.
export type TimeStore = {
  currentEntry(): TimeEntryDto | null;
  entries(): TimeEntryDto[];
  isClocking(): boolean;
  error(): string | null;
  isClockedIn(): boolean;
  clockInTime(): string | null;
  clockIn(): Promise<void>;
  clockOut(): Promise<void>;
  loadEntries(params?: { employeeId?: string; status?: string }): Promise<void>;
  updateEntryFromEvent(entry: TimeEntryDto): void;
};
