import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { NotificationsStore } from '../data-access/notifications.store';

@Component({
  selector: 'app-notification-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe, ButtonModule, ProgressSpinnerModule],
  styles: [`
    :host {
      display: block;
    }

    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1rem 0.75rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .notif-header h4 {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--p-text-color);
      margin: 0;
    }

    .notif-empty,
    .notif-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      font-size: 0.8125rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .notif-list {
      list-style: none;
      margin: 0;
      padding: 0.375rem 0;
    }

    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: background 0.15s ease;
      border: none;
      background: transparent;
    }

    .notif-item:hover {
      background: var(--p-surface-hover, color-mix(in srgb, var(--p-primary-color) 6%, transparent));
    }

    .notif-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--p-primary-color);
      flex-shrink: 0;
      margin-top: 5px;
    }

    .notif-item.read .notif-dot {
      background: transparent;
      border: 1.5px solid var(--p-surface-400, #555);
    }

    .notif-body {
      flex: 1;
      min-width: 0;
    }

    .notif-type {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--p-text-color);
      text-transform: lowercase;
      display: block;
      margin-bottom: 2px;
    }

    .notif-item.read .notif-type {
      font-weight: 400;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .notif-time {
      font-size: 0.6875rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }
  `],
  template: `
    <section aria-label="Notifications">
      <div class="notif-header">
        <h4>Notifications</h4>
        @if (store.unreadCount() > 0) {
          <span style="font-size: 0.75rem; color: var(--p-primary-color); font-weight: 600;">
            {{ store.unreadCount() }} unread
          </span>
        }
      </div>

      @if (store.loading()) {
        <div class="notif-loading">
          <p-progress-spinner strokeWidth="4" [style]="{ width: '24px', height: '24px' }" />
          <span>Loading…</span>
        </div>
      } @else if (store.notifications().length === 0) {
        <div class="notif-empty">
          <i class="pi pi-bell-slash" style="font-size: 1.25rem; opacity: 0.4;"></i>
          <span>All caught up!</span>
        </div>
      } @else {
        <ul class="notif-list">
          @for (n of store.notifications(); track n.id) {
            <li
              class="notif-item"
              [class.read]="n.read"
              (click)="onNotificationClick(n.id)"
              (keydown.enter)="onNotificationClick(n.id)"
              tabindex="0"
              role="button"
              [attr.aria-label]="n.type + (n.read ? ' (read)' : ' (unread)')"
            >
              <span class="notif-dot"></span>
              <div class="notif-body">
                <span class="notif-type">{{ n.type.replace('_', ' ') }}</span>
                <span class="notif-time">{{ n.createdAt | slice: 0 : 10 }}</span>
              </div>
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
