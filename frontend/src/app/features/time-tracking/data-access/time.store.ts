import { computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
import { OfflineQueueService } from '../../../core/pwa/offline-queue.service';

// withHooks omitted — TypeScript 5.9 cannot infer the store type when withHooks is present.
// SseService.connect() is called from ClockComponent / LiveDashboardComponent instead.

type TimeState = {
  currentEntry: TimeEntryDto | null;
  entries: TimeEntryDto[];
  isClocking: boolean;
  error: string | null;
  clockInConflict: boolean;
  pendingOfflineAction: 'clock-in' | 'clock-out' | null;
};

const initialState: TimeState = {
  currentEntry: null,
  entries: [],
  isClocking: false,
  error: null,
  clockInConflict: false,
  pendingOfflineAction: null,
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
    const offlineQueue = inject(OfflineQueueService);
    return {
      async clockIn(coords?: { lat: number; lng: number }): Promise<void> {
        if (!navigator.onLine) {
          offlineQueue.enqueue({ type: 'clock-in', timestamp: new Date().toISOString(), coords });
          patchState(store, { pendingOfflineAction: 'clock-in', error: null });
          return;
        }
        patchState(store, { isClocking: true, error: null, clockInConflict: false, pendingOfflineAction: null });
        try {
          const source = coords
            ? `web-gps:${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`
            : 'web';
          const entry = await firstValueFrom(api.clockIn({ source }));
          patchState(store, { currentEntry: entry, isClocking: false });
        } catch (err: unknown) {
          const is409 = (err instanceof HttpErrorResponse && err.status === 409)
                     || (err != null && (err as { status?: number }).status === 409);
          if (is409) {
            patchState(store, { isClocking: false, clockInConflict: true, error: null });
          } else {
            patchState(store, { isClocking: false, error: extractBackendMessage(err, 'Clock-in failed') });
          }
        }
      },

      async clockOut(): Promise<void> {
        if (!navigator.onLine) {
          offlineQueue.enqueue({ type: 'clock-out', timestamp: new Date().toISOString() });
          patchState(store, { pendingOfflineAction: 'clock-out', error: null });
          return;
        }
        patchState(store, { isClocking: true, error: null, clockInConflict: false, pendingOfflineAction: null });
        try {
          const entry = await firstValueFrom(api.clockOut());
          patchState(store, { currentEntry: entry, isClocking: false });
        } catch (err: unknown) {
          const message = extractBackendMessage(err, 'Clock-out failed');
          // 404 NOT_CLOCKED_IN means the session is already closed — snap UI to match.
          const alreadyOut = err instanceof HttpErrorResponse && err.status === 404;
          patchState(store, {
            isClocking: false,
            error: message,
            currentEntry: alreadyOut ? null : store.currentEntry(),
          });
        }
      },

      async loadEntries(params?: { employeeId?: string; status?: string; from?: string; to?: string }): Promise<void> {
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

function extractBackendMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    return (err.error as { message?: string } | null)?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

// TypeScript 5.9 workaround: export explicit interface for injection sites.
export type TimeStore = {
  currentEntry(): TimeEntryDto | null;
  entries(): TimeEntryDto[];
  isClocking(): boolean;
  error(): string | null;
  clockInConflict(): boolean;
  pendingOfflineAction(): 'clock-in' | 'clock-out' | null;
  isClockedIn(): boolean;
  clockInTime(): string | null;
  clockIn(coords?: { lat: number; lng: number }): Promise<void>;
  clockOut(): Promise<void>;
  loadEntries(params?: { employeeId?: string; status?: string; from?: string; to?: string }): Promise<void>;
  updateEntryFromEvent(entry: TimeEntryDto): void;
};
