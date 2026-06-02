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
// SSE multi-tab NOTIFICATION_READ sync can be wired at the component level if needed.
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
};
