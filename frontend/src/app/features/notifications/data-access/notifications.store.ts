import { computed, inject, effect } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { SseService } from '../../../core/sse/sse.service';
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

/**
 * NotificationsStore — manages in-app notification list.
 *
 * Satisfies FR-NOTIF-7, FR-NOTIF-9; acceptance: AC-NOTIF-6.
 */
export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState<NotificationsState>(initialState),
  withComputed(({ notifications }) => ({
    unreadCount: computed(() => notifications().filter((n) => !n.read).length),
  })),
  withMethods((store, http = inject(HttpClient), baseUrl = inject(API_BASE_URL)) => ({
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
        patchState(store, (s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        }));
      } catch {
        // ignore — UI already shows the notification
      }
    },
  })),
  withHooks((store, sse = inject(SseService)) => ({
    onInit() {
      // Sync when a NOTIFICATION_READ event arrives from another tab/device.
      effect(() => {
        const event = sse.lastEvent();
        if (!event) return;
        if (event.type === 'NOTIFICATION_READ') {
          const payload = event.payload as { id?: string };
          if (payload.id) {
            patchState(store, (s) => ({
              notifications: s.notifications.map((n) =>
                n.id === payload.id ? { ...n, read: true } : n,
              ),
            }));
          }
        }
      });
    },
  })),
);
