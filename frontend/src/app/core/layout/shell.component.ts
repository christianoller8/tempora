import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthStore } from '../auth/auth.store';
import { NotificationsStore } from '../../features/notifications/data-access/notifications.store';
import { NotificationBellComponent } from '../../features/notifications/ui/notification-bell.component';
import { NotificationListComponent } from '../../features/notifications/feature/notification-list.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, NotificationBellComponent, NotificationListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav>
      <a routerLink="/dashboard">Dashboard</a>
      @if (isAdmin()) {
        <a routerLink="/employees">Employees</a>
      }
      <a routerLink="/shifts">Shifts</a>
      <a routerLink="/time-tracking">Time Tracking</a>
      <a routerLink="/absences">Absences</a>
      @if (isAdminOrManager()) {
        <a routerLink="/reports">Reports</a>
      }
      @if (isAdmin()) {
        <a routerLink="/admin">Admin</a>
      }
      <app-notification-bell
        [count]="notificationsStore.unreadCount()"
        (open)="showNotifications.set(!showNotifications())"
      />
      <button type="button" (click)="logout()">Logout</button>
    </nav>

    @if (showNotifications()) {
      <app-notification-list />
    }

    <main>
      <router-outlet />
    </main>
  `,
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthStore) as unknown as AuthStore;
  protected readonly notificationsStore = inject(NotificationsStore) as unknown as NotificationsStore;

  readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  readonly showNotifications = signal(false);

  ngOnInit(): void {
    void this.notificationsStore.loadNotifications();
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
