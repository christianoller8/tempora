import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import type { SseEvent } from '@tempora/shared';

export interface NotificationItem {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  payload: unknown;
  read: boolean;
  createdAt: string;
}

type NotificationsState = {
  notifications: NotificationItem[];
  loading: boolean;
};

const initialState: NotificationsState = {
  notifications: [],
  loading: false,
};

// withHooks omitted — TypeScript 5.9 cannot infer the store type when withHooks is present.
// SSE multi-tab NOTIFICATION_READ sync is bridged via ShellComponent effect (ADR-6).
export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState<NotificationsState>(initialState),
  withComputed(({ notifications }) => ({
    unreadCount: computed(() =>
      (notifications() as NotificationItem[]).filter((n: NotificationItem) => !n.read).length,
    ),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const baseUrl = inject(API_BASE_URL);
    return {
      async loadNotifications(): Promise<void> {
        patchState(store, { loading: true });
        try {
          const items = await firstValueFrom(
            http
              .get<{ data: NotificationItem[] }>(`${baseUrl}/notifications`, {
                withCredentials: true,
              })
              .pipe(map((res) => res.data)),
          );
          patchState(store, { notifications: items, loading: false });
        } catch {
          patchState(store, { loading: false });
        }
      },

      async markRead(id: string): Promise<void> {
        try {
          await firstValueFrom(
            http.patch<{ data: NotificationItem }>(
              `${baseUrl}/notifications/${id}/read`,
              {},
              { withCredentials: true },
            ),
          );
          // Replace callback form with direct signal read (TypeScript 5.9 NoInfer workaround).
          patchState(store, {
            notifications: (store.notifications() as NotificationItem[]).map((n: NotificationItem) =>
              n.id === id ? { ...n, read: true } : n,
            ),
          });
        } catch {
          // ignore — UI already shows the notification
        }
      },

      // T07: mark all notifications read — calls PATCH /notifications/read-all
      async markAllRead(): Promise<void> {
        try {
          await firstValueFrom(
            http.patch<{ updated: number }>(
              `${baseUrl}/notifications/read-all`,
              {},
              { withCredentials: true },
            ),
          );
          patchState(store, {
            notifications: (store.notifications() as NotificationItem[]).map(
              (n: NotificationItem) => ({ ...n, read: true }),
            ),
          });
        } catch {
          // keep state as-is on error
        }
      },

      // T07: apply an SSE event — called from ShellComponent effect (ADR-6)
      applySseEvent(event: SseEvent): void {
        if (event.type === 'NOTIFICATION') {
          const payload = event.payload as {
            type?: string;
            absenceId?: string;
            employeeId?: string;
          } | null;
          const item: NotificationItem = {
            id: (event as unknown as { id?: string }).id ?? crypto.randomUUID(),
            organizationId: (event as unknown as { organizationId?: string }).organizationId ?? '',
            userId: (event as unknown as { targetUserId?: string }).targetUserId ?? '',
            type: 'NOTIFICATION',
            payload: payload ?? {},
            read: false,
            createdAt: (event as unknown as { emittedAt?: string }).emittedAt ?? new Date().toISOString(),
          };
          patchState(store, {
            notifications: [item, ...(store.notifications() as NotificationItem[])],
          });
        } else if (event.type === 'NOTIFICATION_READ') {
          const id = (event.payload as { id?: string; notificationId?: string } | null)?.id
            ?? (event.payload as { id?: string; notificationId?: string } | null)?.notificationId;
          if (id) {
            patchState(store, {
              notifications: (store.notifications() as NotificationItem[]).map(
                (n: NotificationItem) => (n.id === id ? { ...n, read: true } : n),
              ),
            });
          }
        }
      },
    };
  }),
);

// TypeScript 5.9 workaround: export explicit interface for injection sites.
export type NotificationsStore = {
  notifications(): NotificationItem[];
  loading(): boolean;
  unreadCount(): number;
  loadNotifications(): Promise<void>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;          // T10: new
  applySseEvent(event: SseEvent): void;  // T10: new
};
