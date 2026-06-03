import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { AuthStore } from '../auth/auth.store';
import { NotificationsStore } from '../../features/notifications/data-access/notifications.store';
import { NotificationListComponent } from '../../features/notifications/feature/notification-list.component';
import { ThemeService } from '../theme/theme.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet,
    ButtonModule, AvatarModule, BadgeModule, TooltipModule, DividerModule,
    NotificationListComponent,
  ],
  styles: [`
    /* ── Layout ─────────────────────────────────────────────────────── */
    :host {
      display: grid;
      grid-template-columns: 260px 1fr;
      grid-template-rows: 100vh;
      overflow: hidden;
    }

    /* ── Sidebar ─────────────────────────────────────────────────────── */
    .sidebar {
      display: flex;
      flex-direction: column;
      background: var(--p-surface-card);
      border-right: 1px solid var(--p-surface-border);
      overflow: hidden;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem 1.25rem 1rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .brand-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--p-primary-color);
      border-radius: 10px;
      flex-shrink: 0;
    }

    .brand-icon-wrap .pi {
      font-size: 1.1rem;
      color: #fff;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .brand-name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--p-text-color);
      letter-spacing: -0.01em;
    }

    .brand-sub {
      font-size: 0.65rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 500;
    }

    /* ── Nav ─────────────────────────────────────────────────────────── */
    .sidebar-nav {
      flex: 1;
      padding: 0.75rem 0.75rem 0;
      overflow-y: auto;
    }

    .nav-section-label {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      padding: 1rem 0.5rem 0.375rem;
    }

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.875rem;
      border-radius: 8px;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      text-decoration: none;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      position: relative;
    }

    .nav-link:hover {
      background: var(--p-surface-hover, color-mix(in srgb, var(--p-primary-color) 8%, transparent));
      color: var(--p-text-color);
    }

    .nav-link.active {
      background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
      color: var(--p-primary-color);
    }

    .nav-link .pi {
      font-size: 1rem;
      width: 1rem;
      flex-shrink: 0;
    }

    .nav-link.active .pi {
      color: var(--p-primary-color);
    }

    .nav-notif-badge {
      margin-left: auto;
      background: var(--p-red-500, #ef4444);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      padding: 0 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    /* ── Sidebar footer ──────────────────────────────────────────────── */
    .sidebar-footer {
      padding: 0.75rem;
      border-top: 1px solid var(--p-surface-border);
    }

    /* ── Main area ───────────────────────────────────────────────────── */
    .main-area {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--p-surface-ground);
    }

    /* ── Topbar ──────────────────────────────────────────────────────── */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 1.5rem;
      background: var(--p-surface-card);
      border-bottom: 1px solid var(--p-surface-border);
      flex-shrink: 0;
    }

    .topbar-org {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      letter-spacing: 0.01em;
    }

    .topbar-end {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }

    .user-block {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.25;
    }

    .user-email {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .user-role {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Page content ────────────────────────────────────────────────── */
    .page-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 1.5rem;
    }
  `],
  template: `
    <!-- ─ Sidebar ─────────────────────────────────────────────────────── -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon-wrap">
          <i class="pi pi-heart"></i>
        </div>
        <div class="brand-text">
          <span class="brand-name">Tempora</span>
          <span class="brand-sub">Healthcare</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list">
          @for (item of mainNavItems; track item.route) {
            <li>
              <a
                class="nav-link"
                [routerLink]="item.route"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
                [pTooltip]="item.label"
                tooltipPosition="right"
                [showDelay]="600"
                [attr.aria-label]="item.label"
              >
                <i class="pi {{ item.icon }}"></i>
                <span>{{ item.label }}</span>
              </a>
            </li>
          }

          <!-- Notifications -->
          <li>
            <button
              class="nav-link"
              [class.active]="showNotifications()"
              (click)="toggleNotifications()"
              [pTooltip]="'Notifications'"
              tooltipPosition="right"
              [showDelay]="600"
              aria-label="Notifications"
              type="button"
            >
              <i class="pi pi-bell"></i>
              <span>Notifications</span>
              @if (notificationsStore.unreadCount() > 0) {
                <span class="nav-notif-badge" aria-live="polite" aria-atomic="true">
                  {{ notificationsStore.unreadCount() }}
                </span>
              }
            </button>
          </li>
        </ul>

        @if (isAdminOrManager()) {
          <div class="nav-section-label">Management</div>
          <ul class="nav-list">
            @for (item of mgmtNavItems(); track item.route) {
              <li>
                <a
                  class="nav-link"
                  [routerLink]="item.route"
                  routerLinkActive="active"
                  [pTooltip]="item.label"
                  tooltipPosition="right"
                  [showDelay]="600"
                  [attr.aria-label]="item.label"
                >
                  <i class="pi {{ item.icon }}"></i>
                  <span>{{ item.label }}</span>
                </a>
              </li>
            }
          </ul>
        }
      </nav>

      <div class="sidebar-footer">
        <a
          class="nav-link"
          (click)="logout()"
          style="cursor:pointer"
          aria-label="Sign out"
          pTooltip="Sign out"
          tooltipPosition="right"
          [showDelay]="600"
        >
          <i class="pi pi-sign-out"></i>
          <span>Sign out</span>
        </a>
      </div>
    </aside>

    <!-- ─ Main area ────────────────────────────────────────────────────── -->
    <div class="main-area">
      <!-- Topbar -->
      <header class="topbar">
        <span class="topbar-org">{{ orgName() }}</span>
        <div class="topbar-end">
          <!-- Theme toggle -->
          <p-button
            [icon]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [pTooltip]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
            tooltipPosition="bottom"
            (onClick)="theme.toggle()"
            [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          />
          <div class="user-block">
            <span class="user-email">{{ userEmail() }}</span>
            <span class="user-role">{{ userRole() }}</span>
          </div>
          <p-avatar
            [label]="userInitials()"
            shape="circle"
            [style]="{ background: 'var(--p-primary-color)', color: '#fff', fontWeight: '600', fontSize: '0.8rem' }"
          />
        </div>
      </header>

      <!-- Notification panel -->
      @if (showNotifications()) {
        <app-notification-list class="notifications-panel" />
      }

      <!-- Page content -->
      <main class="page-content" role="main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthStore) as unknown as AuthStore;
  protected readonly notificationsStore = inject(NotificationsStore) as unknown as NotificationsStore;
  protected readonly theme = inject(ThemeService);

  readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  readonly showNotifications = signal(false);

  readonly orgName = computed(() => 'Tempora Demo');
  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly userRole = computed(() => this.auth.role() ?? '');
  readonly userInitials = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return email.substring(0, 2).toUpperCase();
  });

  readonly mainNavItems: NavItem[] = [
    { label: 'Dashboard',     route: '/dashboard',      icon: 'pi-home' },
    { label: 'Shifts',        route: '/shifts',          icon: 'pi-calendar' },
    { label: 'Time Tracking', route: '/time-tracking',   icon: 'pi-clock' },
    { label: 'Absences',      route: '/absences',        icon: 'pi-calendar-times' },
  ];

  readonly mgmtNavItems = computed((): NavItem[] => {
    const items: NavItem[] = [];
    if (this.isAdminOrManager()) {
      items.push({ label: 'Reports', route: '/reports', icon: 'pi-chart-bar' });
    }
    if (this.isAdmin()) {
      items.push({ label: 'Employees', route: '/employees', icon: 'pi-users' });
      items.push({ label: 'Admin',     route: '/admin',     icon: 'pi-cog' });
    }
    return items;
  });

  ngOnInit(): void {
    void this.notificationsStore.loadNotifications();
  }

  toggleNotifications(): void {
    this.showNotifications.update(v => !v);
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
