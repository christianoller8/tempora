import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { PopoverModule } from 'primeng/popover';
import { AuthStore } from '../auth/auth.store';
import { NotificationsStore } from '../../features/notifications/data-access/notifications.store';
import { NotificationListComponent } from '../../features/notifications/feature/notification-list.component';
import { NotificationBellComponent } from '../../features/notifications/ui/notification-bell.component';
import { ThemeService } from '../theme/theme.service';
import { SseService } from '../sse/sse.service';
import { LanguageService } from '../i18n/language.service';
import { TranslatePipe } from '@ngx-translate/core';

interface NavItem {
  labelKey: string;
  route: string;
  icon: string;
  comingSoon?: boolean;
}

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet,
    ButtonModule, AvatarModule, BadgeModule, TooltipModule, DividerModule,
    PopoverModule,
    NotificationListComponent,
    NotificationBellComponent,
    TranslatePipe,
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

    .nav-link--soon {
      opacity: 0.45;
      cursor: default;
      pointer-events: none;
    }

    .nav-soon-badge {
      margin-left: auto;
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 4px;
      padding: 1px 5px;
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

    .role-badge {
      font-size: 0.6rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid transparent;
    }
    .role-badge--admin    { background: var(--color-role-admin-bg);    color: var(--color-role-admin);    border-color: var(--color-role-admin-border); }
    .role-badge--manager  { background: var(--color-role-manager-bg);  color: var(--color-role-manager);  border-color: var(--color-role-manager-border); }
    .role-badge--employee { background: var(--color-role-employee-bg); color: var(--color-role-employee); border-color: var(--color-role-employee-border); }
    .role-badge--unknown  { background: color-mix(in srgb, var(--p-surface-400) 18%, transparent); color: var(--p-surface-400); border-color: color-mix(in srgb, var(--p-surface-400) 35%, transparent); }

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
          <span class="brand-sub">{{ 'NAV.BRAND_SUBTITLE' | translate }}</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list">
          @for (item of navItems(); track item.route) {
            <li>
              @if (item.comingSoon) {
                <span class="nav-link nav-link--soon" aria-disabled="true" role="link">
                  <i class="pi {{ item.icon }}"></i>
                  <span>{{ item.labelKey | translate }}</span>
                  <span class="nav-soon-badge">{{ 'NAV.COMING_SOON' | translate }}</span>
                </span>
              } @else {
                <a
                  class="nav-link"
                  [routerLink]="item.route"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
                  [pTooltip]="item.labelKey | translate"
                  tooltipPosition="right"
                  [showDelay]="600"
                  [attr.aria-label]="item.labelKey | translate"
                >
                  <i class="pi {{ item.icon }}"></i>
                  <span>{{ item.labelKey | translate }}</span>
                </a>
              }
            </li>
          }
        </ul>
      </nav>

      <div class="sidebar-footer">
        <a
          class="nav-link"
          (click)="logout()"
          style="cursor:pointer"
          [attr.aria-label]="'NAV.SIGN_OUT' | translate"
          [pTooltip]="'NAV.SIGN_OUT' | translate"
          tooltipPosition="right"
          [showDelay]="600"
        >
          <i class="pi pi-sign-out"></i>
          <span>{{ 'NAV.SIGN_OUT' | translate }}</span>
        </a>
      </div>
    </aside>

    <!-- ─ Main area ────────────────────────────────────────────────────── -->
    <div class="main-area">
      <!-- Topbar -->
      <header class="topbar">
        <span class="topbar-org">{{ orgName() }}</span>
        <div class="topbar-end">
          <!-- Notification bell + popover -->
          <app-notification-bell
            [count]="notificationsStore.unreadCount()"
            (open)="notifPanel.toggle($event)"
          />
          <p-popover #notifPanel [style]="{ width: 'min(380px, calc(100vw - 2rem))' }" (onShow)="onPopoverOpen()">
            <app-notification-list (navigated)="notifPanel.hide()" />
          </p-popover>

          <!-- Language toggle -->
          <p-button
            [label]="lang.current() === 'es' ? 'EN' : 'ES'"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [pTooltip]="lang.current() === 'es' ? ('TOPBAR.SWITCH_TO_ENGLISH' | translate) : ('TOPBAR.SWITCH_TO_SPANISH' | translate)"
            tooltipPosition="bottom"
            (onClick)="lang.toggle()"
            [attr.aria-label]="lang.current() === 'es' ? ('TOPBAR.SWITCH_TO_ENGLISH' | translate) : ('TOPBAR.SWITCH_TO_SPANISH' | translate)"
          />

          <!-- Theme toggle -->
          <p-button
            [icon]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [pTooltip]="theme.isDark() ? ('TOPBAR.SWITCH_TO_LIGHT' | translate) : ('TOPBAR.SWITCH_TO_DARK' | translate)"
            tooltipPosition="bottom"
            (onClick)="theme.toggle()"
            [attr.aria-label]="theme.isDark() ? ('TOPBAR.SWITCH_TO_LIGHT' | translate) : ('TOPBAR.SWITCH_TO_DARK' | translate)"
          />
          <div class="user-block">
            <span class="user-email">{{ userEmail() }}</span>
            <span
              class="role-badge"
              [class.role-badge--admin]="userRole() === 'ADMIN'"
              [class.role-badge--manager]="userRole() === 'MANAGER'"
              [class.role-badge--employee]="userRole() === 'EMPLOYEE'"
              [class.role-badge--unknown]="!userRole()"
            >{{ userRole() || '…' }}</span>
          </div>
          <p-avatar
            [label]="userInitials()"
            shape="circle"
            [style]="{ background: 'var(--p-primary-color)', color: '#fff', fontWeight: '600', fontSize: '0.8rem' }"
          />
        </div>
      </header>

      <!-- Page content -->
      <main class="page-content" role="main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  private readonly auth   = inject(AuthStore) as unknown as AuthStore;
  private readonly router = inject(Router);
  private readonly sse    = inject(SseService);
  protected readonly notificationsStore = inject(NotificationsStore) as unknown as NotificationsStore;
  protected readonly theme = inject(ThemeService);
  protected readonly lang  = inject(LanguageService);

  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  readonly orgName = computed(() => 'Tempora Demo');
  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly userRole = computed(() => this.auth.role() ?? '');
  readonly userInitials = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return email.substring(0, 2).toUpperCase();
  });

  readonly navItems = computed((): NavItem[] => {
    const role = this.auth.role();
    if (role === 'EMPLOYEE') {
      return [
        { labelKey: 'NAV.MY_SCHEDULE',  route: '/shifts',        icon: 'pi-calendar' },
        { labelKey: 'NAV.MY_TIME',      route: '/time-tracking', icon: 'pi-clock' },
        { labelKey: 'NAV.MY_ABSENCES',  route: '/absences',      icon: 'pi-calendar-times' },
        { labelKey: 'NAV.MY_TIMESHEET', route: '/timesheet',     icon: 'pi-file-check' },
        { labelKey: 'NAV.MY_DOCUMENTS', route: '/documents',     icon: 'pi-file', comingSoon: true },
      ];
    }
    if (role === 'MANAGER') {
      return [
        { labelKey: 'NAV.DASHBOARD',         route: '/dashboard',        icon: 'pi-home' },
        { labelKey: 'NAV.SHIFTS',            route: '/shifts',           icon: 'pi-calendar' },
        { labelKey: 'NAV.TIME_TRACKING',     route: '/time-tracking',    icon: 'pi-clock' },
        { labelKey: 'NAV.ABSENCES',          route: '/absences',         icon: 'pi-calendar-times' },
        { labelKey: 'NAV.MY_TIMESHEET',      route: '/timesheet',        icon: 'pi-file-check' },
        { labelKey: 'NAV.TIMESHEET_STATUS',  route: '/timesheet-status', icon: 'pi-list-check' },
      ];
    }
    // ADMIN
    return [
      { labelKey: 'NAV.DASHBOARD',        route: '/dashboard',        icon: 'pi-home' },
      { labelKey: 'NAV.SHIFTS',           route: '/shifts',           icon: 'pi-calendar' },
      { labelKey: 'NAV.TIME_TRACKING',    route: '/time-tracking',    icon: 'pi-clock' },
      { labelKey: 'NAV.ABSENCES',         route: '/absences',         icon: 'pi-calendar-times' },
      { labelKey: 'NAV.MY_TIMESHEET',     route: '/timesheet',        icon: 'pi-file-check' },
      { labelKey: 'NAV.TIMESHEET_STATUS', route: '/timesheet-status', icon: 'pi-list-check' },
      { labelKey: 'NAV.EMPLOYEES',        route: '/employees',        icon: 'pi-users' },
      { labelKey: 'NAV.DOCUMENTS',        route: '/documents',        icon: 'pi-file', comingSoon: true },
      { labelKey: 'NAV.REPORTS',          route: '/reports',          icon: 'pi-chart-bar' },
      { labelKey: 'NAV.SETTINGS',         route: '/admin',            icon: 'pi-cog' },
    ];
  });

  constructor() {
    // ADR-6: bridge SSE events into the store via an effect.
    // The store stays HTTP-only and unit-testable; the shell is the single integration point.
    effect(() => {
      const ev = this.sse.lastEvent();
      if (ev) this.notificationsStore.applySseEvent(ev);
    });
  }

  ngOnInit(): void {
    void this.notificationsStore.loadNotifications();
  }

  /** Called when the notifications popover opens — refreshes the list (FR-NOT-14). */
  onPopoverOpen(): void {
    void this.notificationsStore.loadNotifications();
  }

  logout(): void {
    this.auth.logout().subscribe({
      complete: () => void this.router.navigate(['/auth/login']),
      error:    () => void this.router.navigate(['/auth/login']),
    });
  }
}
