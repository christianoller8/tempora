import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { NotificationsStore } from '../data-access/notifications.store';

/**
 * NotificationListComponent — smart container.
 *
 * Shows the user's notification list. Marks a notification as read when clicked.
 * Injects NotificationsStore for state.
 *
 * Satisfies FR-NOTIF-7, FR-NOTIF-9.
 */
@Component({
  selector: 'app-notification-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe],
  template: `
    <section aria-label="Notification list" class="notification-list">
      @if (store.loading()) {
        <p role="status">Loading notifications…</p>
      } @else if (store.notifications().length === 0) {
        <p>No notifications.</p>
      } @else {
        <ul>
          @for (n of store.notifications(); track n.id) {
            <li
              [class]="n.read ? 'read' : 'unread'"
              (click)="onNotificationClick(n.id)"
              (keydown.enter)="onNotificationClick(n.id)"
              tabindex="0"
              role="button"
              [attr.aria-label]="n.type + (n.read ? ' (read)' : ' (unread)')"
            >
              <span class="type">{{ n.type }}</span>
              <span class="time">{{ n.createdAt | slice: 0 : 10 }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class NotificationListComponent {
  protected readonly store = inject(NotificationsStore) as unknown as NotificationsStore;

  onNotificationClick(id: string): void {
    void this.store.markRead(id);
  }
}
