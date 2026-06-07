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
  imports: [DatePipe, LowerCasePipe, TitleCasePipe, CardModule, ChartModule, TagModule, SkeletonModule, DividerModule, ButtonModule, MessageModule, TooltipModule],
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
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--p-text-color);
    }
    .dash-subtitle {
      font-size: 0.8125rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 0.125rem;
    }

    /* ── Stat cards ─────────────────────────────────────────────────── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .stat-card {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
      padding: 1.25rem 1.25rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      border-color: var(--p-primary-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .stat-icon-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.25rem;
    }

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      font-size: 1.1rem;
    }

    .stat-icon--primary { background: color-mix(in srgb, var(--p-primary-color) 15%, transparent); color: var(--p-primary-color); }
    .stat-icon--green   { background: color-mix(in srgb, var(--color-stat-green)  15%, transparent); color: var(--color-stat-green); }
    .stat-icon--orange  { background: color-mix(in srgb, var(--color-stat-orange) 15%, transparent); color: var(--color-stat-orange); }
    .stat-icon--blue    { background: color-mix(in srgb, var(--color-stat-blue)   15%, transparent); color: var(--color-stat-blue); }

    .stat-number {
      font-size: 2rem;
      font-weight: 800;
      color: var(--p-text-color);
      line-height: 1;
    }

    .stat-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* ── Two-column middle row ──────────────────────────────────────── */
    .mid-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    /* ── Panel shared styles ────────────────────────────────────────── */
    .panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem 0.75rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--p-text-color);
    }

    .panel-title .pi { font-size: 0.9rem; color: var(--p-primary-color); }

    .panel-body { padding: 0.5rem 0; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2.5rem 1rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-size: 0.8125rem;
    }

    .empty-state .pi { font-size: 1.75rem; opacity: 0.35; }

    /* ── Live clock-in feed ─────────────────────────────────────────── */
    .feed-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
      transition: background 0.15s;
    }

    .feed-row:last-child { border-bottom: none; }
    .feed-row:hover { background: color-mix(in srgb, var(--p-primary-color) 5%, transparent); }

    .feed-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .feed-category {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 1px;
    }

    .feed-time {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--p-text-color);
      white-space: nowrap;
    }

    .feed-duration {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      white-space: nowrap;
    }

    .online-dot {
      width: 8px;
      height: 8px;
      background: var(--color-status-online);
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-status-online) 30%, transparent);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ── Incidents ──────────────────────────────────────────────────── */
    .incident-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .incident-row:last-child { border-bottom: none; }

    .incident-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }

    .incident-dot--danger { background: var(--p-red-500, #ef4444); }
    .incident-dot--warn   { background: var(--p-yellow-500, #eab308); }
    .incident-dot--info   { background: var(--p-blue-400, #60a5fa); }

    .incident-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color);
      line-height: 1.3;
    }

    .incident-detail {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 2px;
    }

    /* ── Weekly chart ───────────────────────────────────────────────── */
    .chart-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .chart-body {
      padding: 1rem 1.25rem 1.25rem;
      min-height: 260px;
      position: relative;
    }

    /* ── Skeleton loading ───────────────────────────────────────────── */
    .skel-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .skel-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .skel-box {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
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
      padding: 0.625rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
      transition: background 0.15s;
    }
    .shift-row:last-child { border-bottom: none; }
    .shift-row:hover { background: color-mix(in srgb, var(--p-primary-color) 5%, transparent); }

    .shift-date-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
      border-radius: 8px;
      flex-shrink: 0;
    }
    .shift-day   { font-size: 1rem;   font-weight: 800; color: var(--p-primary-color); line-height: 1; }
    .shift-month { font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; color: var(--p-primary-color); letter-spacing: 0.04em; }

    .shift-name   { font-size: 0.875rem; font-weight: 600; color: var(--p-text-color); }
    .shift-times  { font-size: 0.75rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin-top: 1px; }

    .my-status-dot {
      width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
    }
    .my-status-dot.active { background: var(--color-status-online); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-status-online) 25%, transparent); animation: pulse 2s infinite; }
    .my-status-dot.idle   { background: var(--color-status-idle); }

    /* ── Responsive ─────────────────────────────────────────────────── */
    @media (max-width: 1100px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .mid-row   { grid-template-columns: 1fr; }
    }
  `],
  template: `
    <!-- Header -->
    <div class="dash-header">
      <div>
        <div class="dash-title">Dashboard</div>
        <div class="dash-subtitle">{{ today | date:'EEEE, d MMMM y' }}</div>
      </div>
      <p-button
        icon="pi pi-refresh"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        pTooltip="Refresh"
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
      <div style="padding: 2rem; text-align: center; color: var(--p-red-400);">
        <i class="pi pi-exclamation-circle" style="font-size: 2rem;"></i>
        <p style="margin-top: 0.75rem;">{{ error() }}</p>
        <p-button label="Retry" icon="pi pi-refresh" severity="danger" [text]="true" (onClick)="load()" />
      </div>
    }

    <!-- ── EMPLOYEE VIEW ─────────────────────────────────────────── -->
    @if (!loading() && !error() && data() && isEmployee()) {
      <!-- Employee stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon" [class.stat-icon--green]="myOpenEntry()" [class.stat-icon--primary]="!myOpenEntry()">
              <i class="pi pi-clock"></i>
            </div>
            <span class="my-status-dot" [class.active]="myOpenEntry()" [class.idle]="!myOpenEntry()"></span>
          </div>
          <div class="stat-number" style="font-size:1.125rem; font-weight:700; line-height:1.3;">
            {{ myOpenEntry() ? 'Clocked In' : 'Clocked Out' }}
          </div>
          <div class="stat-label">My Status</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--green"><i class="pi pi-stopwatch"></i></div>
          </div>
          <div class="stat-number">{{ myTodayHours() }}</div>
          <div class="stat-label">Today</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--blue"><i class="pi pi-chart-bar"></i></div>
          </div>
          <div class="stat-number">{{ myWeekHours() }}</div>
          <div class="stat-label">This Week</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--orange"><i class="pi pi-calendar"></i></div>
          </div>
          <div class="stat-number">{{ myUpcomingShifts().length }}</div>
          <div class="stat-label">Upcoming Shifts</div>
        </div>
      </div>

      <!-- Employee mid row: today's activity + upcoming shifts -->
      <div class="mid-row">

        <!-- Today's time activity -->
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title"><i class="pi pi-list"></i>Today's Activity</div>
          </div>
          <div class="panel-body">
            @if (myTodayEntries().length === 0) {
              <div class="empty-state">
                <i class="pi pi-clock"></i>
                <span>No entries today — clock in to start your session</span>
              </div>
            } @else {
              @for (entry of myTodayEntries(); track entry.id) {
                <div class="feed-row">
                  <div>
                    <div class="feed-time">{{ entry.clockIn | date:'HH:mm' }}</div>
                    <div class="feed-duration">
                      @if (entry.clockOut) { → {{ entry.clockOut | date:'HH:mm' }} }
                      @else { running… }
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div class="feed-duration">{{ entryDuration(entry) }}</div>
                  </div>
                  <p-tag
                    [value]="entry.status === 'OPEN' ? 'Active' : 'Closed'"
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
            <div class="panel-title"><i class="pi pi-calendar"></i>Upcoming Shifts</div>
            @if (upcomingLoading()) {
              <i class="pi pi-spin pi-spinner" style="font-size:0.875rem; color:var(--p-primary-color);"></i>
            }
          </div>
          <div class="panel-body">
            @if (myUpcomingShifts().length === 0 && !upcomingLoading()) {
              <div class="empty-state">
                <i class="pi pi-calendar"></i>
                <span>No upcoming shifts scheduled</span>
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

    <!-- ── ADMIN / MANAGER DATA ───────────────────────────────────── -->
    @if (!loading() && !error() && data() && !isEmployee()) {

      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--primary"><i class="pi pi-users"></i></div>
          </div>
          <div class="stat-number">{{ stats().totalEmployees }}</div>
          <div class="stat-label">Total Employees</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--green"><i class="pi pi-clock"></i></div>
          </div>
          <div class="stat-number">{{ stats().clockedIn }}</div>
          <div class="stat-label">Currently Clocked In</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--orange"><i class="pi pi-calendar-times"></i></div>
          </div>
          <div class="stat-number">{{ stats().onAbsenceToday }}</div>
          <div class="stat-label">On Absence Today</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-row">
            <div class="stat-icon stat-icon--blue"><i class="pi pi-arrows-h"></i></div>
          </div>
          <div class="stat-number">{{ stats().pendingSwaps }}</div>
          <div class="stat-label">Pending Shift Swaps</div>
        </div>
      </div>

      <!-- Mid row: live feed + incidents -->
      <div class="mid-row">

        <!-- Live clock-in feed -->
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <i class="pi pi-wifi"></i>
              Live Clock-In Feed
            </div>
            <p-tag
              [value]="feed().length + ' online'"
              severity="success"
              [rounded]="true"
              [style]="{ fontSize: '0.7rem' }"
            />
          </div>
          <div class="panel-body">
            @if (feed().length === 0) {
              <div class="empty-state">
                <i class="pi pi-moon"></i>
                <span>No one is clocked in right now</span>
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
              Daily Incidents
            </div>
            @if (incidents().length > 0) {
              <p-tag
                [value]="incidents().length + ' alerts'"
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
                <span>No incidents today — all clear!</span>
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
                      label="Close session"
                      icon="pi pi-sign-out"
                      size="small"
                      severity="danger"
                      [text]="true"
                      [loading]="closingIncidentId() === inc.id"
                      [disabled]="closingIncidentId() !== null"
                      pTooltip="Force clock out this employee"
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
            Weekly Hours — {{ weekLabel }}
          </div>
          @if (weeklyHours().length > 0) {
            <span style="font-size: 0.75rem; color: var(--p-text-color-muted, var(--p-text-color-secondary));">
              {{ weeklyHours().length }} employee(s) with activity
            </span>
          }
        </div>
        <div class="chart-body">
          @if (weeklyHours().length === 0) {
            <div class="empty-state" style="padding-top: 3rem;">
              <i class="pi pi-chart-bar"></i>
              <span>No closed time entries this week yet</span>
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
  `,
})
export class DashboardComponent implements OnInit {
  private readonly dashApi   = inject(DashboardApi);
  private readonly timeApi   = inject(TimeApi);
  private readonly auth      = inject(AuthStore) as unknown as AuthStore;
  private readonly shiftsApi = inject(ShiftsApi);
  private readonly theme     = inject(ThemeService);

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
    const surface  = s.getPropertyValue('--p-surface-card').trim()  || '#1e293b';
    const border   = s.getPropertyValue('--p-surface-border').trim() || 'rgba(255,255,255,0.12)';
    const textMuted = s.getPropertyValue('--p-text-color-secondary').trim() || '#94a3b8';
    const textBody = s.getPropertyValue('--p-text-color').trim()     || '#e2e8f0';
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
      this.incidentCloseError.set('Failed to close the session. Please try again.');
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
