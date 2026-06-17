import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, LowerCasePipe, TitleCasePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { forkJoin, firstValueFrom } from 'rxjs';
import {
  DashboardApi,
  DashboardData,
  deriveStats,
  deriveFeed,
  deriveIncidents,
  deriveWeeklyHours,
  formatDuration,
  type Incident,
  type IncidentSeverity,
} from '../data-access/dashboard.api';
import { TimeApi } from '../../time-tracking/data-access/time.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { ShiftsApi, type ShiftAssignment, type ShiftTemplate } from '../../shifts/data-access/shifts.api';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe, TitleCasePipe, CardModule, ChartModule, TagModule, SkeletonModule, DividerModule, ButtonModule, MessageModule, TooltipModule, TranslatePipe],
  styles: [`
    :host { display: block; }

    /* ── Page header ────────────────────────────────────────────────── */
    .dash-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .dash-title {
      font-size: 1.5625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .dash-subtitle {
      font-size: 0.8125rem;
      color: var(--text-2);
      margin-top: 0.25rem;
      text-transform: capitalize;
    }

    /* ── KPI / stat cards ───────────────────────────────────────────── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      margin-bottom: 18px;
    }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      position: relative;
      overflow: hidden;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    .stat-card::after {
      content: '';
      position: absolute;
      right: -40px;
      top: -40px;
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--primary-soft), transparent 70%);
      pointer-events: none;
    }

    .stat-card:hover {
      border-color: var(--primary);
      box-shadow: var(--glow);
    }

    .stat-icon-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .stat-icon {
      width: 42px;
      height: 42px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      border: 1px solid transparent;
    }

    /* Light: primary-tinted icons */
    .stat-icon--primary { background: var(--primary-soft); color: var(--accent-ico); border-color: var(--border-soft); }
    .stat-icon--green   { background: var(--ok-soft);      color: var(--ok);         border-color: var(--border-soft); }
    .stat-icon--orange  { background: var(--warn-soft);    color: var(--warn);        border-color: var(--border-soft); }
    .stat-icon--blue    { background: var(--primary-soft); color: var(--accent-ico); border-color: var(--border-soft); }

    .stat-number {
      font-size: 2.125rem;
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1;
      color: var(--text);
    }

    .stat-number small {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-2);
      letter-spacing: 0;
    }

    .stat-label {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.075em;
      color: var(--text-2);
      text-transform: uppercase;
      margin-top: 9px;
    }

    /* ── Trend badges ───────────────────────────────────────────────── */
    .trend {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.71875rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
    }
    .trend--up   { color: var(--ok);     background: var(--ok-soft); }
    .trend--down { color: var(--danger); background: var(--danger-soft); }
    .trend--flat { color: var(--text-2); background: var(--surface-2); }

    /* ── Two-column middle row ──────────────────────────────────────── */
    .mid-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 18px;
    }

    /* ── Panel / card shared ────────────────────────────────────────── */
    .panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border-soft);
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 0.90625rem;
      font-weight: 600;
      color: var(--text);
    }

    .panel-title .pi { font-size: 0.9rem; color: var(--accent-ico); }

    .panel-body { padding: 8px 8px 12px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 46px 1rem;
      color: var(--text-3);
      font-size: 0.8125rem;
      text-align: center;
    }

    .empty-state .pi { font-size: 2.5rem; }

    .empty-state__title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-2);
    }

    .empty-state__sub {
      font-size: 0.75rem;
      color: var(--text-3);
      margin-top: -4px;
    }

    .chart-placeholder {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      justify-content: center;
      padding: 4px 0 8px;
    }

    .chart-placeholder__bar {
      width: 26px;
      border-radius: 3px 3px 0 0;
      border: 2px dashed var(--border-soft);
      opacity: 0.5;
    }

    .stats-row--3col {
      grid-template-columns: repeat(3, 1fr);
    }

    /* ── Status pill (online badge) ─────────────────────────────────── */
    .pill--ok {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      color: var(--ok);
      background: var(--ok-soft);
    }

    .pill--warn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      color: var(--warn);
      background: var(--warn-soft);
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse-ring 2s infinite;
    }

    @keyframes pulse-ring {
      0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
      70%  { box-shadow: 0 0 0 6px transparent; opacity: 0.7; }
      100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
    }

    /* ── Live clock-in feed rows ────────────────────────────────────── */
    .feed-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 12px;
      border-radius: 11px;
      transition: background var(--transition);
    }

    .feed-row:hover { background: var(--surface-2); }

    .feed-name {
      font-size: 0.84375rem;
      font-weight: 600;
      color: var(--text);
    }

    .feed-category {
      font-size: 0.71875rem;
      color: var(--text-2);
      margin-top: 2px;
    }

    .feed-time {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .feed-duration {
      font-size: 0.6875rem;
      color: var(--text-2);
      white-space: nowrap;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }

    .online-dot {
      width: 7px;
      height: 7px;
      background: var(--ok);
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 3px var(--ok-soft);
    }

    /* ── Entry status badges ────────────────────────────────────────── */
    .badge--in  { font-size: 0.59375rem; font-weight: 700; letter-spacing: 0.025em; padding: 2px 7px; border-radius: 5px; text-transform: uppercase; color: var(--ok);     background: var(--ok-soft); }
    .badge--out { font-size: 0.59375rem; font-weight: 700; letter-spacing: 0.025em; padding: 2px 7px; border-radius: 5px; text-transform: uppercase; color: var(--text-2); background: var(--surface-2); }

    /* ── Incidents ──────────────────────────────────────────────────── */
    .incident-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 13px 12px;
      border-radius: 11px;
      transition: background var(--transition);
    }

    .incident-row:hover { background: var(--surface-2); }

    .incident-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }

    .incident-dot--danger { background: var(--danger); box-shadow: 0 0 0 4px var(--danger-soft); }
    .incident-dot--warn   { background: var(--warn);   box-shadow: 0 0 0 4px var(--warn-soft); }
    .incident-dot--info   { background: var(--primary); box-shadow: 0 0 0 4px var(--primary-soft); }

    .incident-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1.3;
    }

    .incident-detail {
      font-size: 0.71875rem;
      color: var(--text-2);
      margin-top: 3px;
    }

    /* ── Weekly chart panel ─────────────────────────────────────────── */
    .chart-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .chart-body {
      padding: 22px 24px 18px;
      min-height: 260px;
      position: relative;
    }

    /* ── Skeleton loading ───────────────────────────────────────────── */
    .skel-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      margin-bottom: 18px;
    }

    .skel-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 18px;
    }

    .skel-box {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* ── Employee upcoming shifts ───────────────────────────────────── */
    .shift-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 12px;
      border-radius: 11px;
      transition: background var(--transition);
    }

    .shift-row:hover { background: var(--surface-2); }

    .shift-date-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: var(--primary-soft);
      border-radius: var(--radius-sm);
      flex-shrink: 0;
    }

    .shift-day   { font-size: 1rem;      font-weight: 800; color: var(--primary); line-height: 1; }
    .shift-month { font-size: 0.5625rem; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em; }

    .shift-name  { font-size: 0.875rem; font-weight: 600; color: var(--text); }
    .shift-times { font-size: 0.75rem;  color: var(--text-2); margin-top: 1px; }

    .my-status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .my-status-dot.active { background: var(--ok); box-shadow: 0 0 0 3px var(--ok-soft); animation: pulse-ring 2s infinite; }
    .my-status-dot.idle   { background: var(--text-3); }

    /* ── Link text ──────────────────────────────────────────────────── */
    .text-link {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      cursor: pointer;
      transition: color var(--transition);
    }
    .text-link:hover { color: var(--primary-hover); }

    /* ── Responsive ─────────────────────────────────────────────────── */
    @media (max-width: 1100px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .mid-row   { grid-template-columns: 1fr; }
      .skel-stats { grid-template-columns: repeat(2, 1fr); }
      .skel-row   { grid-template-columns: 1fr; }
    }

    /* ── Dark mode overrides ────────────────────────────────────────── */
    :host-context([data-theme="dark"]) .stat-icon--primary {
      background: var(--primary-soft);
      border-color: var(--border-soft);
      color: var(--accent-ico);
    }

    :host-context([data-theme="dark"]) .stat-icon--green {
      background: var(--ok-soft);
      border-color: var(--border-soft);
      color: var(--ok);
    }

    :host-context([data-theme="dark"]) .stat-icon--orange {
      background: var(--warn-soft);
      border-color: var(--border-soft);
      color: var(--warn);
    }

    :host-context([data-theme="dark"]) .stat-icon--blue {
      background: var(--primary-soft);
      border-color: var(--border-soft);
      color: var(--accent-ico);
    }

    :host-context([data-theme="dark"]) .panel-title .pi {
      color: var(--accent-ico);
    }

    :host-context([data-theme="dark"]) .feed-row:hover {
      background: var(--surface-2);
    }

    :host-context([data-theme="dark"]) .incident-row:hover {
      background: var(--surface-2);
    }

    :host-context([data-theme="dark"]) .shift-row:hover {
      background: var(--surface-2);
    }

    :host-context([data-theme="dark"]) .badge--out {
      background: var(--surface-2);
      color: var(--text-2);
    }

    :host-context([data-theme="dark"]) .trend--flat {
      background: var(--surface-2);
    }
  `],
  template: `
    <!-- Header -->
    <div class="dash-header">
      <div>
        <div class="dash-title">{{ 'DASHBOARD.TITLE' | translate }}</div>
        <div class="dash-subtitle">{{ today | date:'EEEE, d MMMM y':undefined:lang.dateLocale() }}</div>
      </div>
      <p-button
        icon="pi pi-refresh"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [pTooltip]="'COMMON.REFRESH' | translate"
        (onClick)="load()"
        [loading]="loading()"
      />
    </div>

    <!-- ── LOADING SKELETONS ───────────────────────────────────────── -->
    @if (loading()) {
      <div class="skel-stats">
        @for (_ of [1,2,3,4]; track $index) {
          <div class="skel-box">
            <p-skeleton width="40px" height="40px" borderRadius="10px" />
            <p-skeleton height="2rem" width="60%" />
            <p-skeleton height="0.75rem" width="80%" />
          </div>
        }
      </div>
      <div class="skel-row">
        <div class="skel-box" style="height:280px"></div>
        <div class="skel-box" style="height:280px"></div>
      </div>
      <div class="skel-box" style="height:280px">
        <p-skeleton height="1rem" width="30%" />
      </div>
    }

    <!-- ── ERROR ──────────────────────────────────────────────────── -->
    @if (!loading() && error()) {
      <div style="padding: 2rem; text-align: center; color: var(--danger);">
        <i class="pi pi-exclamation-circle" style="font-size: 2rem;"></i>
        <p style="margin-top: 0.75rem;">{{ error() }}</p>
        <p-button label="Retry" icon="pi pi-refresh" severity="danger" [text]="true" (onClick)="load()" />
      </div>
    }

    <!-- ── MAIN DATA VIEW ────────────────────────────────────────── -->
    @if (!loading() && !error() && data()) {

      <!-- Stats row — 3 cards for EMPLOYEE, 4 for ADMIN/MANAGER -->
      <div class="stats-row" [class.stats-row--3col]="isEmployee()">
        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--primary"><i class="pi pi-users"></i></div>
          </div>
          <div class="stat-number">{{ stats().totalEmployees }}</div>
          <div class="stat-label">{{ 'DASHBOARD.TOTAL_EMPLOYEES' | translate }}</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--green"><i class="pi pi-clock"></i></div>
          </div>
          <div class="stat-number">{{ stats().clockedIn }}</div>
          <div class="stat-label">{{ 'DASHBOARD.CLOCKED_IN' | translate }}</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--orange"><i class="pi pi-calendar-times"></i></div>
          </div>
          <div class="stat-number">{{ stats().onAbsenceToday }}</div>
          <div class="stat-label">{{ 'DASHBOARD.ON_ABSENCE' | translate }}</div>
        </div>

        @if (!isEmployee()) {
          <div class="stat-card">
            <div class="stat-icon-row">
              <div class="stat-icon stat-icon--blue"><i class="pi pi-arrows-h"></i></div>
            </div>
            <div class="stat-number">{{ stats().pendingSwaps }}</div>
            <div class="stat-label">{{ 'DASHBOARD.PENDING_SWAPS' | translate }}</div>
          </div>
        }
      </div>

      <!-- ── EMPLOYEE mid section ──────────────────────────────── -->
      @if (isEmployee()) {
        <div class="mid-row">

          <!-- Today's time activity -->
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title"><i class="pi pi-list"></i>{{ 'DASHBOARD.TODAY_ACTIVITY' | translate }}</div>
            </div>
            <div class="panel-body">
              @if (myTodayEntries().length === 0) {
                <div class="empty-state">
                  <i class="pi pi-clock"></i>
                  <span>{{ 'DASHBOARD.NO_ENTRIES_TODAY' | translate }}</span>
                </div>
              } @else {
                @for (entry of myTodayEntries(); track entry.id) {
                  <div class="feed-row">
                    <div>
                      <div class="feed-time">{{ entry.clockIn | date:'HH:mm' }}</div>
                      <div class="feed-duration">
                        @if (entry.clockOut) { → {{ entry.clockOut | date:'HH:mm' }} }
                        @else { {{ 'DASHBOARD.RUNNING' | translate }} }
                      </div>
                    </div>
                    <div style="text-align:right;">
                      <div class="feed-duration">{{ entryDuration(entry) }}</div>
                    </div>
                    <p-tag
                      [value]="entry.status === 'OPEN' ? ('STATUS.OPEN' | translate) : ('STATUS.CLOSED' | translate)"
                      [severity]="entry.status === 'OPEN' ? 'success' : 'secondary'"
                      [rounded]="true" [style]="{ fontSize: '0.7rem' }"
                    />
                  </div>
                }
              }
            </div>
          </div>

          <!-- Upcoming shifts -->
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title"><i class="pi pi-calendar"></i>{{ 'DASHBOARD.UPCOMING_SHIFTS' | translate }}</div>
              @if (upcomingLoading()) {
                <i class="pi pi-spin pi-spinner" style="font-size:0.875rem; color:var(--primary);"></i>
              }
            </div>
            <div class="panel-body">
              @if (myUpcomingShifts().length === 0 && !upcomingLoading()) {
                <div class="empty-state">
                  <i class="pi pi-calendar"></i>
                  <span>{{ 'DASHBOARD.NO_UPCOMING_SHIFTS' | translate }}</span>
                </div>
              } @else {
                @for (shift of myUpcomingShifts(); track shift.id) {
                  <div class="shift-row">
                    <div class="shift-date-block">
                      <span class="shift-day">{{ shift.date | date:'d' }}</span>
                      <span class="shift-month">{{ shift.date | date:'MMM' }}</span>
                    </div>
                    <div>
                      <div class="shift-name">{{ shift.templateName }}</div>
                      <div class="shift-times">{{ shift.times }}</div>
                    </div>
                    <p-tag [value]="(shift.date | date:'EEE') ?? ''" severity="secondary" [rounded]="true" [style]="{ fontSize: '0.7rem' }" />
                  </div>
                }
              }
            </div>
          </div>

        </div>
      }

      <!-- ── ADMIN / MANAGER mid section + chart ───────────────── -->
      @if (!isEmployee()) {

        <!-- Mid row: live feed + incidents -->
        <div class="mid-row">

          <!-- Live clock-in feed -->
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <i class="pi pi-wifi"></i>
                {{ 'DASHBOARD.LIVE_FEED_TITLE' | translate }}
              </div>
              <p-tag
                [value]="'DASHBOARD.ONLINE_BADGE' | translate:{ count: feed().length }"
                severity="success"
                [rounded]="true"
                [style]="{ fontSize: '0.7rem' }"
              />
            </div>
            <div class="panel-body">
              @if (feed().length === 0) {
                <div class="empty-state">
                  <i class="pi pi-clock"></i>
                  <span class="empty-state__title">No hay fichajes activos ahora mismo</span>
                  <span class="empty-state__sub">El equipo está fuera de turno</span>
                </div>
              } @else {
                @for (entry of feed(); track entry.employeeId) {
                  <div class="feed-row">
                    <div>
                      <div class="feed-name">{{ entry.fullName }}</div>
                      <div class="feed-category">{{ entry.category | lowercase | titlecase }}</div>
                    </div>
                    <div style="text-align:right;">
                      <div class="feed-time">{{ entry.clockInTime | date:'HH:mm' }}</div>
                      <div class="feed-duration">{{ entry.duration }}</div>
                    </div>
                    <span class="online-dot" title="Online"></span>
                  </div>
                }
              }
            </div>
          </div>

          <!-- Daily incidents -->
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <i class="pi pi-exclamation-triangle"></i>
                {{ 'DASHBOARD.INCIDENTS_TITLE' | translate }}
              </div>
              @if (incidents().length > 0) {
                <p-tag
                  [value]="(incidents().length === 1 ? 'DASHBOARD.ALERTS_BADGE_ONE' : 'DASHBOARD.ALERTS_BADGE') | translate:{ count: incidents().length }"
                  severity="warn"
                  [rounded]="true"
                  [style]="{ fontSize: '0.7rem' }"
                />
              }
            </div>
            <div class="panel-body">
              @if (incidents().length === 0) {
                <div class="empty-state">
                  <i class="pi pi-check-circle"></i>
                  <span class="empty-state__title">Todo en orden</span>
                  <span class="empty-state__sub">Sin incidencias registradas hoy</span>
                </div>
              } @else {
                @if (incidentCloseError()) {
                  <div style="padding: 0.75rem 1.25rem;">
                    <p-message severity="error" [text]="incidentCloseError()!" styleClass="w-full" />
                  </div>
                }
                @for (inc of incidents(); track inc.id) {
                  <div class="incident-row">
                    <span class="incident-dot incident-dot--{{ inc.severity }}"></span>
                    <div style="flex:1; min-width:0;">
                      <div class="incident-label">{{ inc.label }}</div>
                      <div class="incident-detail">{{ inc.detail }}</div>
                    </div>
                    @if (inc.employeeId) {
                      <p-button
                        [label]="'DASHBOARD.CLOSE_SESSION' | translate"
                        icon="pi pi-sign-out"
                        size="small"
                        severity="danger"
                        [text]="true"
                        [loading]="closingIncidentId() === inc.id"
                        [disabled]="closingIncidentId() !== null"
                        [pTooltip]="'DASHBOARD.CLOSE_SESSION_TOOLTIP' | translate"
                        tooltipPosition="left"
                        (onClick)="closeIncident(inc)"
                      />
                    }
                  </div>
                }
              }
            </div>
          </div>

        </div>

        <!-- Weekly hours bar chart -->
        <div class="chart-panel">
          <div class="panel-header">
            <div class="panel-title">
              <i class="pi pi-chart-bar"></i>
              {{ 'DASHBOARD.WEEKLY_CHART_TITLE' | translate }} — {{ weekLabel }}
            </div>
            @if (weeklyHours().length > 0) {
              <span style="font-size: 0.75rem; color: var(--text-3);">
                {{ (weeklyHours().length === 1 ? 'DASHBOARD.EMPLOYEES_ACTIVITY_ONE' : 'DASHBOARD.EMPLOYEES_ACTIVITY') | translate:{ count: weeklyHours().length } }}
              </span>
            }
          </div>
          <div class="chart-body">
            @if (weeklyHours().length === 0) {
              <div class="empty-state" style="padding-top: 2rem;">
                <div class="chart-placeholder" aria-hidden="true">
                  <div class="chart-placeholder__bar" style="height:48px"></div>
                  <div class="chart-placeholder__bar" style="height:30px"></div>
                  <div class="chart-placeholder__bar" style="height:64px"></div>
                  <div class="chart-placeholder__bar" style="height:22px"></div>
                  <div class="chart-placeholder__bar" style="height:56px"></div>
                  <div class="chart-placeholder__bar" style="height:38px"></div>
                  <div class="chart-placeholder__bar" style="height:44px"></div>
                </div>
                <span class="empty-state__title">Sin actividad registrada esta semana</span>
              </div>
            } @else {
              <p-chart
                type="bar"
                [data]="chartData()"
                [options]="chartOptions()"
                [style]="{ height: (weeklyHours().length * 36 + 40) + 'px', minHeight: '200px' }"
              />
            }
          </div>
        </div>

      }

    }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly dashApi   = inject(DashboardApi);
  private readonly timeApi   = inject(TimeApi);
  private readonly auth      = inject(AuthStore) as unknown as AuthStore;
  private readonly shiftsApi = inject(ShiftsApi);
  private readonly theme     = inject(ThemeService);
  private readonly translate = inject(TranslateService);
  readonly lang              = inject(LanguageService);

  readonly today = new Date();

  readonly weekLabel = (() => {
    const d = new Date();
    const day  = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon  = new Date(d);
    mon.setDate(d.getDate() + diff);
    const sun  = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return `${mon.toLocaleDateString('en', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en', { day: 'numeric', month: 'short' })}`;
  })();

  // ── State ──────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<DashboardData | null>(null);

  readonly closingIncidentId  = signal<string | null>(null);
  readonly incidentCloseError = signal<string | null>(null);

  // ── Employee-specific ────────────────────────────────────────────────────
  readonly isEmployee = computed(() => this.auth.role() === 'EMPLOYEE');

  readonly upcomingAssignments = signal<ShiftAssignment[]>([]);
  readonly shiftTemplates      = signal<ShiftTemplate[]>([]);
  readonly upcomingLoading     = signal(false);

  readonly myOpenEntry = computed(() => this.data()?.openEntries[0] ?? null);

  readonly myTodayEntries = computed(() => {
    const d = this.data();
    if (!d) return [];
    const today = new Date().toISOString().slice(0, 10);
    return [...d.weekEntries, ...(this.myOpenEntry() && d.weekEntries.every(e => e.id !== this.myOpenEntry()!.id) ? d.openEntries : [])]
      .filter(e => e.clockIn.slice(0, 10) === today)
      .sort((a, b) => b.clockIn.localeCompare(a.clockIn));
  });

  readonly myTodayHours = computed(() => {
    let ms = 0;
    for (const e of this.myTodayEntries()) {
      const end = e.clockOut ? new Date(e.clockOut) : new Date();
      ms += end.getTime() - new Date(e.clockIn).getTime();
    }
    return formatDuration(ms);
  });

  readonly myWeekHours = computed(() => {
    const d = this.data();
    if (!d) return '0m';
    let ms = 0;
    for (const e of d.weekEntries) {
      if (e.status === 'CLOSED' && e.clockOut) {
        ms += new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime();
      }
    }
    return formatDuration(ms);
  });

  readonly myUpcomingShifts = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tMap  = new Map(this.shiftTemplates().map(t => [t.id, t]));
    return this.upcomingAssignments()
      .filter(a => a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7)
      .map(a => {
        const t = tMap.get(a.shiftTemplateId);
        return {
          ...a,
          templateName: t?.name ?? 'Shift',
          times: t && t.shiftType !== 'LIBRANZA' ? `${t.startTime}–${t.endTime}` : 'Day off',
        };
      });
  });

  entryDuration(entry: { clockIn: string; clockOut: string | null }): string {
    const ms = (entry.clockOut ? new Date(entry.clockOut) : new Date()).getTime() - new Date(entry.clockIn).getTime();
    if (ms < 0) return '—';
    return formatDuration(ms);
  }

  // ── Derived signals ─────────────────────────────────────────────────────
  readonly stats = computed(() => {
    const d = this.data();
    return d ? deriveStats(d) : { totalEmployees: 0, clockedIn: 0, onAbsenceToday: 0, pendingSwaps: 0 };
  });

  readonly feed = computed(() => {
    const d = this.data();
    return d ? deriveFeed(d) : [];
  });

  readonly incidents = computed(() => {
    const d = this.data();
    return d ? deriveIncidents(d) : [];
  });

  readonly weeklyHours = computed(() => {
    const d = this.data();
    return d ? deriveWeeklyHours(d) : [];
  });

  private readonly chartColors = computed(() => {
    this.theme.isDark(); // track for reactivity on theme change
    const s = getComputedStyle(document.documentElement);
    return Array.from({ length: 8 }, (_, i) =>
      s.getPropertyValue(`--chart-color-${i + 1}`).trim(),
    );
  });

  readonly chartData = computed(() => {
    const wh = this.weeklyHours();
    if (wh.length === 0) return null;
    const palette = this.chartColors();
    return {
      labels: wh.map(e => e.name),
      datasets: [{
        label: 'Hours',
        data:  wh.map(e => e.hours),
        backgroundColor: wh.map((_, i) => `color-mix(in srgb, ${palette[i % palette.length]} 75%, transparent)`),
        borderColor:     wh.map((_, i) => palette[i % palette.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    };
  });

  readonly chartOptions = computed(() => {
    this.theme.isDark(); // track for reactivity
    const s        = getComputedStyle(document.documentElement);
    const surface  = s.getPropertyValue('--surface').trim()  || '#1e293b';
    const border   = s.getPropertyValue('--border-soft').trim() || 'rgba(255,255,255,0.12)';
    const textMuted = s.getPropertyValue('--text-2').trim() || '#94a3b8';
    const textBody = s.getPropertyValue('--text').trim()     || '#e2e8f0';
    return {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surface,
          titleColor:      textBody,
          bodyColor:       textMuted,
          borderColor:     border,
          borderWidth:     1,
          padding:         10,
          callbacks: {
            label: (ctx: { raw: unknown }) => ` ${Number(ctx.raw).toFixed(1)} h`,
          },
        },
      },
      scales: {
        x: {
          min: 0,
          suggestedMax: 45,
          grid:  { color: border },
          ticks: { color: textMuted, font: { size: 11 } },
        },
        y: {
          grid:  { display: false },
          ticks: { color: textBody, font: { size: 12 } },
        },
      },
    };
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  async closeIncident(inc: Incident): Promise<void> {
    if (!inc.employeeId) return;
    this.closingIncidentId.set(inc.id);
    this.incidentCloseError.set(null);
    try {
      await firstValueFrom(this.timeApi.clockOut({ employeeId: inc.employeeId }));
      this.load();
    } catch {
      this.incidentCloseError.set(this.translate.instant('DASHBOARD.CLOSE_SESSION_ERROR'));
    } finally {
      this.closingIncidentId.set(null);
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashApi.load().subscribe({
      next: d => {
        this.data.set(d);
        this.loading.set(false);
        if (this.isEmployee()) this.loadEmployeeExtras();
      },
      error: e => {
        this.error.set(e?.message ?? 'Failed to load dashboard data');
        this.loading.set(false);
      },
    });
  }

  private loadEmployeeExtras(): void {
    this.upcomingLoading.set(true);
    forkJoin({
      assignments: this.shiftsApi.listAssignments(),
      templates:   this.shiftsApi.listTemplates(),
    }).subscribe({
      next: ({ assignments, templates }) => {
        this.upcomingAssignments.set(assignments);
        this.shiftTemplates.set(templates);
        this.upcomingLoading.set(false);
      },
      error: () => this.upcomingLoading.set(false),
    });
  }
}
