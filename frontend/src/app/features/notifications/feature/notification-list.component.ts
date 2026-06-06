import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { NotificationItem, NotificationsStore } from '../data-access/notifications.store';

/** Routes per notification payload type (spec §2.5). */
const NOTIF_ROUTES: Record<string, string> = {
  ABSENCE_APPROVED:  '/absences',
  ABSENCE_REJECTED:  '/absences',
  ABSENCE_REQUESTED: '/absences',
};

/** Human-readable message per payload type (spec §2.3). */
function notificationMessage(item: NotificationItem): string {
  const p = item.payload as { type?: string } | null;
  switch (p?.type) {
    case 'ABSENCE_APPROVED':  return 'Your absence request was approved.';
    case 'ABSENCE_REJECTED':  return 'Your absence request was rejected.';
    case 'ABSENCE_REQUESTED': return 'A new absence request was submitted.';
    default: return p?.type ?? 'Notification';
  }
}

/** Icon class per payload type. */
function iconForItem(item: NotificationItem): string {
  const p = item.payload as { type?: string } | null;
  switch (p?.type) {
    case 'ABSENCE_APPROVED':  return 'pi-check-circle';
    case 'ABSENCE_REJECTED':  return 'pi-times-circle';
    case 'ABSENCE_REQUESTED': return 'pi-calendar';
    default: return 'pi-bell';
  }
}

/** Relative time string from an ISO timestamp. */
function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

@Component({
  selector: 'app-notification-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, ProgressSpinnerModule],
  styles: [`
    :host {
      display: block;
    }

    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem 0.5rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .notif-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--p-text-color);
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
      padding: 0;
      max-height: 420px;
      overflow-y: auto;
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
      width: 100%;
      text-align: left;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .notif-item:last-child {
      border-bottom: none;
    }

    .notif-item:hover {
      background: color-mix(in srgb, var(--p-primary-color) 5%, transparent);
    }

    .notif-item--unread {
      background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
    }

    .notif-item--unread:hover {
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
    }

    .notif-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .notif-icon .pi {
      color: var(--p-primary-color);
      font-size: 0.875rem;
    }

    .notif-body {
      flex: 1;
      min-width: 0;
    }

    .notif-msg {
      font-size: 0.875rem;
      color: var(--p-text-color);
      line-height: 1.4;
    }

    .notif-time {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 2px;
    }

    .notif-unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--p-primary-color);
      flex-shrink: 0;
      margin-top: 4px;
    }
  `],
  template: `
    <section aria-label="Notifications">
      <div class="notif-header">
        <span class="notif-title">Notifications</span>
        @if (store.unreadCount() > 0) {
          <p-button
            label="Mark all read"
            [text]="true"
            size="small"
            severity="secondary"
            (onClick)="onMarkAllRead()"
          />
        }
      </div>

      @if (store.loading()) {
        <div class="notif-loading">
          <p-progress-spinner strokeWidth="4" [style]="{ width: '24px', height: '24px' }" />
          <span>Loading…</span>
        </div>
      } @else if (store.notifications().length === 0) {
        <div class="notif-empty">
          <i class="pi pi-check-circle" style="font-size: 1.5rem; opacity: 0.4;"></i>
          <span>All caught up!</span>
        </div>
      } @else {
        <ul class="notif-list">
          @for (n of store.notifications(); track n.id) {
            <li
              class="notif-item"
              [class.notif-item--unread]="!n.read"
              (click)="onItemClick(n)"
              (keydown.enter)="onItemClick(n)"
              tabindex="0"
              role="button"
              [attr.aria-label]="messageFor(n) + (n.read ? ' (read)' : ' (unread)')"
            >
              <div class="notif-icon">
                <i class="pi {{ iconFor(n) }}"></i>
              </div>
              <div class="notif-body">
                <div class="notif-msg">{{ messageFor(n) }}</div>
                <div class="notif-time">{{ timeFor(n) }}</div>
              </div>
              @if (!n.read) {
                <div class="notif-unread-dot" aria-hidden="true"></div>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class NotificationListComponent {
  protected readonly store = inject(NotificationsStore) as unknown as NotificationsStore;
  private readonly router = inject(Router);

  /** Emitted after a row click that triggers navigation, so the host can close the popover. */
  readonly navigated = output<void>();

  messageFor(item: NotificationItem): string {
    return notificationMessage(item);
  }

  iconFor(item: NotificationItem): string {
    return iconForItem(item);
  }

  timeFor(item: NotificationItem): string {
    return relativeTime(item.createdAt);
  }

  onMarkAllRead(): void {
    void this.store.markAllRead();
  }

  onItemClick(item: NotificationItem): void {
    if (!item.read) {
      void this.store.markRead(item.id);
    }
    const p = item.payload as { type?: string } | null;
    const route = p?.type ? NOTIF_ROUTES[p.type] : undefined;
    if (route) {
      void this.router.navigate([route]);
      this.navigated.emit();
    }
  }
}
