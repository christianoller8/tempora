import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { TimeStore } from '../data-access/time.store';
import { TimeApi } from '../data-access/time.api';
import { SseService } from '../../../core/sse/sse.service';
import { ApiService } from '../../../core/http/api.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { firstValueFrom } from 'rxjs';
import type { TimeEntryDto } from '../data-access/time.api';

interface LiveEmployee { id: string; firstName: string; lastName: string; }

type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

@Component({
  selector: 'app-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, ButtonModule, TagModule, DividerModule,
    TooltipModule, SkeletonModule, TextareaModule, MessageModule,
  ],
  styles: [`
    :host { display: block; max-width: 760px; margin: 0 auto; }

    /* ── Page header ────────────────────────────────────────────────── */
    .page-header {
      margin-bottom: 1.75rem;
    }
    .page-title  { font-size: 1.375rem; font-weight: 700; color: var(--p-text-color); }
    .page-sub    { font-size: 0.8125rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin-top: 0.125rem; }

    /* ── Clock card ─────────────────────────────────────────────────── */
    .clock-card {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 16px;
      padding: 2.5rem 2rem 2rem;
      text-align: center;
      margin-bottom: 1.5rem;
      transition: border-color 0.3s ease;
    }

    .clock-card.is-clocked-in {
      border-color: color-mix(in srgb, #22c55e 30%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, #22c55e 15%, transparent),
                  inset 0 1px 0 color-mix(in srgb, #22c55e 8%, transparent);
    }

    /* ── Status badge ───────────────────────────────────────────────── */
    .status-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .status-dot.online {
      background: #22c55e;
      box-shadow: 0 0 0 3px color-mix(in srgb, #22c55e 25%, transparent);
      animation: pulse-green 2s infinite;
    }

    .status-dot.offline {
      background: var(--p-text-color-muted, var(--p-surface-400, #666));
    }

    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, #22c55e 25%, transparent); }
      50%       { box-shadow: 0 0 0 5px color-mix(in srgb, #22c55e 10%, transparent); }
    }

    .status-text {
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .status-text.online  { color: #22c55e; }
    .status-text.offline { color: var(--p-text-color-muted, var(--p-text-color-secondary)); }

    /* ── Timer ──────────────────────────────────────────────────────── */
    .timer-display {
      font-size: 4rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--p-text-color);
      margin-bottom: 0.375rem;
      font-family: 'Inter', monospace;
    }

    .timer-display.running {
      color: #22c55e;
    }

    .timer-label {
      font-size: 0.8rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-bottom: 2rem;
    }

    /* ── Location row ───────────────────────────────────────────────── */
    .location-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      margin-bottom: 2rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      min-height: 1.25rem;
    }

    .location-row .pi { font-size: 0.875rem; }
    .location-row.granted  { color: #22c55e; }
    .location-row.denied   { color: var(--p-red-400, #f87171); }
    .location-row.requesting { color: var(--p-primary-color); }

    /* ── Clock action button ────────────────────────────────────────── */
    .clock-btn-wrap {
      display: flex;
      justify-content: center;
    }

    :host ::ng-deep .btn-clock-in .p-button {
      background: #22c55e;
      border-color: #16a34a;
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
      padding: 0.875rem 2.5rem;
      border-radius: 12px;
      min-width: 180px;
      transition: background 0.2s, transform 0.1s;
    }
    :host ::ng-deep .btn-clock-in .p-button:hover:not(:disabled) {
      background: #16a34a;
      transform: translateY(-1px);
    }
    :host ::ng-deep .btn-clock-in .p-button:active:not(:disabled) {
      transform: translateY(0);
    }

    :host ::ng-deep .btn-clock-out .p-button {
      background: var(--p-red-600, #dc2626);
      border-color: var(--p-red-700, #b91c1c);
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
      padding: 0.875rem 2.5rem;
      border-radius: 12px;
      min-width: 180px;
      transition: background 0.2s, transform 0.1s;
    }
    :host ::ng-deep .btn-clock-out .p-button:hover:not(:disabled) {
      background: var(--p-red-700, #b91c1c);
      transform: translateY(-1px);
    }
    :host ::ng-deep .btn-clock-out .p-button:active:not(:disabled) {
      transform: translateY(0);
    }

    /* ── Source badge ───────────────────────────────────────────────── */
    .source-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
      color: var(--p-primary-color);
      border-radius: 4px;
      padding: 1px 6px;
      margin-top: 1rem;
    }

    /* ── Error message ──────────────────────────────────────────────── */
    .api-error {
      margin-top: 1rem;
      text-align: left;
    }

    /* ── Today's entries ────────────────────────────────────────────── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.875rem;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--p-text-color);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-title .pi { color: var(--p-primary-color); font-size: 0.9rem; }

    .entries-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }

    .entry-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
      transition: background 0.15s;
    }

    .entry-row:last-child { border-bottom: none; }
    .entry-row:hover { background: color-mix(in srgb, var(--p-primary-color) 4%, transparent); }

    .entry-header-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem 0.375rem;
      background: var(--p-surface-section);
      border-bottom: 1px solid var(--p-surface-border);
    }

    .entry-col-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .entry-time {
      font-size: 0.9375rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--p-text-color);
    }

    .entry-dash {
      font-size: 0.875rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .entry-duration {
      font-size: 0.875rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-variant-numeric: tabular-nums;
    }

    .entry-duration.running {
      color: #22c55e;
      font-weight: 600;
    }

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

    /* ── Correction form ────────────────────────────────────────────── */
    .correction-section {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      overflow: hidden;
    }

    .correction-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.875rem 1.25rem;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-size: 0.8125rem;
      font-weight: 500;
      text-align: left;
      transition: color 0.15s;
    }

    .correction-toggle:hover { color: var(--p-text-color); }
    .correction-toggle .pi  { font-size: 0.875rem; }

    .correction-form {
      padding: 0 1.25rem 1.25rem;
      border-top: 1px solid var(--p-surface-border);
    }

    .form-field {
      margin-bottom: 1rem;
      margin-top: 1rem;
    }

    .form-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.5rem;
    }

    :host ::ng-deep .correction-form .p-textarea {
      width: 100%;
      background: var(--p-surface-section);
      border-color: var(--p-surface-border);
      resize: vertical;
    }

    /* ── SSE connection indicator ───────────────────────────────────── */
    .sse-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .sse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .sse-dot.connected    { background: #22c55e; }
    .sse-dot.disconnected { background: var(--p-red-400, #f87171); }

    /* ── Live team status (admin/manager) ───────────────────────────── */
    .team-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }

    .team-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
      transition: background 0.15s;
    }

    .team-row:last-child { border-bottom: none; }
    .team-row:hover { background: color-mix(in srgb, var(--p-primary-color) 5%, transparent); }

    .team-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .team-since {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 1px;
    }

    .team-duration {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--p-text-color);
      white-space: nowrap;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 30%, transparent);
      animation: pulse-green 2s infinite;
    }
  `],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div class="page-title">Time Tracking</div>
          <div class="page-sub">{{ today | date:'EEEE, d MMMM y' }}</div>
        </div>
        <div class="sse-badge" [pTooltip]="sse.connected() ? 'Live updates active' : 'Not connected'" tooltipPosition="left">
          <span class="sse-dot" [class.connected]="sse.connected()" [class.disconnected]="!sse.connected()"></span>
          {{ sse.connected() ? 'Live' : 'Offline' }}
        </div>
      </div>
    </div>

    <!-- ── Clock card ─────────────────────────────────────────────── -->
    <div class="clock-card" [class.is-clocked-in]="isClockedIn()">

      <!-- Status -->
      <div class="status-row">
        <span class="status-dot" [class.online]="isClockedIn()" [class.offline]="!isClockedIn()"></span>
        <span class="status-text" [class.online]="isClockedIn()" [class.offline]="!isClockedIn()">
          {{ isClockedIn() ? 'Clocked In' : 'Clocked Out' }}
        </span>
      </div>

      <!-- Timer display -->
      <div class="timer-display" [class.running]="isClockedIn()">
        {{ timerDisplay() }}
      </div>
      <div class="timer-label">
        @if (isClockedIn()) {
          Session running since {{ store.clockInTime() | date:'HH:mm' }}
        } @else {
          Ready to start your session
        }
      </div>

      <!-- Geolocation indicator -->
      <div class="location-row" [class.granted]="geoStatus() === 'granted'" [class.denied]="geoStatus() === 'denied'" [class.requesting]="geoStatus() === 'requesting'">
        @switch (geoStatus()) {
          @case ('requesting') {
            <i class="pi pi-spin pi-spinner"></i>
            <span>Requesting location…</span>
          }
          @case ('granted') {
            <i class="pi pi-map-marker"></i>
            <span>{{ geoLabel() }}</span>
          }
          @case ('denied') {
            <i class="pi pi-ban"></i>
            <span>Location unavailable — clocking in without coordinates</span>
          }
          @default {
            <i class="pi pi-map-marker" style="opacity:0.3;"></i>
            <span>Location will be requested on clock-in</span>
          }
        }
      </div>

      <!-- Action button -->
      <div class="clock-btn-wrap">
        @if (!isClockedIn()) {
          <div class="btn-clock-in">
            <p-button
              [label]="store.isClocking() ? 'Clocking in…' : 'Clock In'"
              icon="pi pi-play"
              iconPos="left"
              [loading]="store.isClocking()"
              (onClick)="onClockIn()"
              [attr.aria-label]="'Clock in'"
            />
          </div>
        } @else {
          <div class="btn-clock-out">
            <p-button
              [label]="store.isClocking() ? 'Clocking out…' : 'Clock Out'"
              icon="pi pi-stop"
              iconPos="left"
              [loading]="store.isClocking()"
              (onClick)="onClockOut()"
              [attr.aria-label]="'Clock out'"
            />
          </div>
        }
      </div>

      <!-- Source badge (shows GPS when active) -->
      @if (isClockedIn() && geoStatus() === 'granted') {
        <div style="display:flex; justify-content:center;">
          <span class="source-badge">
            <i class="pi pi-map-marker"></i>
            GPS logged
          </span>
        </div>
      }

      <!-- 409 open-session conflict -->
      @if (store.clockInConflict()) {
        <div class="api-error">
          <p-message
            severity="warn"
            text="You have an open session from a previous day that was never closed."
          />
          <div style="margin-top: 0.75rem; display:flex; justify-content:center;">
            <p-button
              label="Force Clock Out"
              icon="pi pi-sign-out"
              severity="warn"
              size="small"
              [loading]="forceClockingOut()"
              (onClick)="onForceClockOut()"
            />
          </div>
        </div>
      }

      <!-- API error -->
      @if (store.error()) {
        <div class="api-error">
          <p-message severity="error" [text]="store.error()!" />
        </div>
      }
    </div>

    <!-- ── Live team status (admin/manager only) ────────────────────── -->
    @if (isAdminOrManager()) {
      <div class="section-header">
        <div class="section-title">
          <i class="pi pi-wifi"></i>
          Live Team Status
        </div>
        <p-tag
          [value]="liveEntries().length + ' clocked in'"
          severity="success"
          [rounded]="true"
          [style]="{ fontSize: '0.7rem' }"
        />
      </div>

      <div class="team-panel">
        @if (liveEntriesLoading()) {
          <div style="padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;">
            @for (_ of [1,2,3]; track $index) {
              <p-skeleton height="2.25rem" borderRadius="6px" />
            }
          </div>
        } @else if (liveEntries().length === 0) {
          <div class="empty-state">
            <i class="pi pi-moon"></i>
            <span>No employees currently clocked in</span>
          </div>
        } @else {
          @for (entry of liveEntries(); track entry.id) {
            <div class="team-row">
              <div>
                <div class="team-name">{{ employeeName(entry.employeeId) }}</div>
                <div class="team-since">Since {{ entry.clockIn | date:'HH:mm' }}</div>
              </div>
              <div class="team-duration">{{ entryDuration(entry) }}</div>
              <span class="live-dot" title="Online"></span>
            </div>
          }
        }
      </div>
    }

    <!-- ── Today's entries ─────────────────────────────────────────── -->
    <div class="section-header">
      <div class="section-title">
        <i class="pi pi-list"></i>
        Today's Activity
      </div>
      <span style="font-size:0.75rem; color:var(--p-text-color-muted, var(--p-text-color-secondary));">
        {{ todayEntries().length }} {{ todayEntries().length === 1 ? 'entry' : 'entries' }}
      </span>
    </div>

    <div class="entries-panel">
      @if (loadingEntries()) {
        <div style="padding: 1.25rem; display:flex; flex-direction:column; gap:0.75rem;">
          @for (_ of [1,2]; track $index) {
            <p-skeleton height="2.5rem" borderRadius="6px" />
          }
        </div>
      } @else if (todayEntries().length === 0) {
        <div class="empty-state">
          <i class="pi pi-clock"></i>
          <span>No entries today yet — clock in to start your session</span>
        </div>
      } @else {
        <div class="entry-header-row">
          <span class="entry-col-label">Clock In</span>
          <span class="entry-col-label">Clock Out</span>
          <span class="entry-col-label">Duration</span>
          <span class="entry-col-label">Status</span>
        </div>
        @for (entry of todayEntries(); track entry.id) {
          <div class="entry-row">
            <span class="entry-time">{{ entry.clockIn | date:'HH:mm' }}</span>
            <span class="entry-time">
              @if (entry.clockOut) {
                {{ entry.clockOut | date:'HH:mm' }}
              } @else {
                <span class="entry-dash">running…</span>
              }
            </span>
            <span class="entry-duration" [class.running]="entry.status === 'OPEN'">
              {{ entryDuration(entry) }}
            </span>
            <p-tag
              [value]="entry.status === 'OPEN' ? 'Active' : 'Closed'"
              [severity]="entry.status === 'OPEN' ? 'success' : 'secondary'"
              [rounded]="true"
              [style]="{ fontSize: '0.7rem' }"
            />
          </div>
        }
      }
    </div>

    <!-- ── Correction request ──────────────────────────────────────── -->
    <div class="correction-section">
      <button
        type="button"
        class="correction-toggle"
        (click)="showCorrection.set(!showCorrection())"
        [attr.aria-expanded]="showCorrection()"
      >
        <i class="pi" [class.pi-chevron-right]="!showCorrection()" [class.pi-chevron-down]="showCorrection()"></i>
        Request a time correction
      </button>

      @if (showCorrection()) {
        <div class="correction-form">
          <div class="form-field">
            <label class="form-label" for="justification">Justification *</label>
            <textarea
              pTextarea
              id="justification"
              rows="3"
              [value]="justification()"
              (input)="justification.set($any($event.target).value)"
              placeholder="Describe what needs to be corrected and why…"
              aria-required="true"
            ></textarea>
          </div>

          <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
            <p-button
              label="Submit correction"
              icon="pi pi-send"
              [loading]="submittingCorrection()"
              [disabled]="!justification().trim() || !hasTodayEntry()"
              (onClick)="onSubmitCorrection()"
              size="small"
            />
            @if (!hasTodayEntry()) {
              <span style="font-size:0.75rem; color:var(--p-text-color-muted, var(--p-text-color-secondary));">
                No entries today to correct
              </span>
            }
          </div>

          @if (correctionSuccess()) {
            <p-message severity="success" text="Correction request submitted successfully." styleClass="w-full mt-3" />
          }
          @if (correctionError()) {
            <p-message severity="error" [text]="correctionError()!" styleClass="w-full mt-3" />
          }
        </div>
      }
    </div>
  `,
})
export class ClockComponent implements OnInit, OnDestroy {
  protected readonly store = inject(TimeStore) as unknown as TimeStore;
  protected readonly sse   = inject(SseService);
  private  readonly api    = inject(TimeApi);
  private  readonly apiService = inject(ApiService);
  private  readonly auth   = inject(AuthStore) as unknown as AuthStore;

  readonly today = new Date();

  // ── Signals ───────────────────────────────────────────────────────────────
  readonly geoStatus  = signal<GeoStatus>('idle');
  readonly geoCoords  = signal<{ lat: number; lng: number } | null>(null);
  readonly geoLabel   = computed(() => {
    const c = this.geoCoords();
    if (!c) return '';
    return `${Math.abs(c.lat).toFixed(2)}°${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lng).toFixed(2)}°${c.lng >= 0 ? 'E' : 'W'}`;
  });

  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  readonly liveEntries        = signal<TimeEntryDto[]>([]);
  readonly liveEntriesLoading = signal(false);
  private readonly liveEmployees = signal<LiveEmployee[]>([]);

  readonly loadingEntries = signal(true);
  readonly forceClockingOut = signal(false);
  readonly showCorrection  = signal(false);
  readonly justification   = signal('');
  readonly correctionError = signal<string | null>(null);
  readonly correctionSuccess = signal(false);
  readonly submittingCorrection = signal(false);

  // ── Timer ─────────────────────────────────────────────────────────────────
  private timerSub: Subscription | null = null;
  readonly elapsedSeconds = signal(0);

  readonly isClockedIn  = computed(() => this.store.isClockedIn());
  readonly hasTodayEntry = computed(() => this.todayEntries().length > 0);

  readonly todayEntries = computed((): TimeEntryDto[] => {
    const today = new Date().toISOString().slice(0, 10);
    return (this.store.entries() as TimeEntryDto[])
      .filter(e => e.clockIn.slice(0, 10) === today)
      .sort((a, b) => b.clockIn.localeCompare(a.clockIn));
  });

  readonly timerDisplay = computed(() => {
    const s = this.elapsedSeconds();
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (s === 0 && !this.isClockedIn()) return '00:00:00';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  constructor() {
    // React to timer: start/stop when clock-in time changes.
    // allowSignalWrites is required because startTimer/stopTimer write
    // to elapsedSeconds synchronously during the effect body.
    effect(() => {
      const clockInTime = this.store.clockInTime();
      if (clockInTime && this.isClockedIn()) {
        this.startTimer(clockInTime);
      } else {
        this.stopTimer();
      }
    }, { allowSignalWrites: true });

    // React to SSE events: refresh entries (and live feed for admin/manager)
    effect(() => {
      const ev = this.sse.lastEvent();
      if (ev && (ev.type === 'CLOCK_IN' || ev.type === 'CLOCK_OUT')) {
        void this.loadTodayEntries();
        if (this.isAdminOrManager()) void this.loadLiveEntries();
      }
    });
  }

  ngOnInit(): void {
    this.sse.connect();
    void this.loadTodayEntries();
    if (this.isAdminOrManager()) void this.loadLiveEntries();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async loadTodayEntries(): Promise<void> {
    this.loadingEntries.set(true);
    const { from, to } = todayRange();
    await this.store.loadEntries({ from, to });
    this.loadingEntries.set(false);
  }

  private async loadLiveEntries(): Promise<void> {
    this.liveEntriesLoading.set(true);
    try {
      const [entries, employees] = await Promise.all([
        firstValueFrom(this.api.listEntries({ status: 'OPEN' })),
        firstValueFrom(this.apiService.get<LiveEmployee[]>('/employees', { activeOnly: 'true' })),
      ]);
      this.liveEntries.set(entries);
      this.liveEmployees.set(employees);
    } finally {
      this.liveEntriesLoading.set(false);
    }
  }

  employeeName(employeeId: string): string {
    const emp = this.liveEmployees().find(e => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId.slice(0, 8) + '…';
  }

  private startTimer(clockInTime: string): void {
    this.stopTimer();
    // Set immediately then tick every second
    const tick = () => {
      const secs = Math.floor((Date.now() - new Date(clockInTime).getTime()) / 1000);
      this.elapsedSeconds.set(Math.max(0, secs));
    };
    tick();
    this.timerSub = interval(1000).subscribe(tick);
  }

  private stopTimer(): void {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
    this.elapsedSeconds.set(0);
  }

  entryDuration(entry: TimeEntryDto): string {
    const start = new Date(entry.clockIn);
    const end   = entry.clockOut ? new Date(entry.clockOut) : new Date();
    const ms    = end.getTime() - start.getTime();
    if (ms < 0) return '—';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async onClockIn(): Promise<void> {
    // 1. Request geolocation (non-blocking — we clock in regardless)
    const coords = await this.requestGeolocation();

    // 2. Call API
    await this.store.clockIn(coords ?? undefined);

    // 3. Reload today's entries to show the new record
    if (!this.store.error()) {
      await this.loadTodayEntries();
    }
  }

  async onClockOut(): Promise<void> {
    await this.store.clockOut();

    if (!this.store.error()) {
      await this.loadTodayEntries();
    }
  }

  async onForceClockOut(): Promise<void> {
    this.forceClockingOut.set(true);
    await this.store.clockOut();
    if (!this.store.error()) {
      await this.onClockIn();
    }
    this.forceClockingOut.set(false);
  }

  private requestGeolocation(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation) {
      this.geoStatus.set('unavailable');
      return Promise.resolve(null);
    }

    this.geoStatus.set('requesting');

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this.geoCoords.set(coords);
          this.geoStatus.set('granted');
          resolve(coords);
        },
        () => {
          this.geoStatus.set('denied');
          resolve(null);
        },
        { timeout: 8_000, maximumAge: 60_000 },
      );
    });
  }

  async onSubmitCorrection(): Promise<void> {
    const latestEntry = this.todayEntries()[0];
    if (!latestEntry) return;

    this.submittingCorrection.set(true);
    this.correctionError.set(null);
    this.correctionSuccess.set(false);

    try {
      await firstValueFrom(
        this.api.createCorrection({
          timeEntryId: latestEntry.id,
          justification: this.justification(),
        }),
      );
      this.correctionSuccess.set(true);
      this.justification.set('');
      this.showCorrection.set(false);
    } catch (err: unknown) {
      this.correctionError.set(err instanceof Error ? err.message : 'Failed to submit correction');
    } finally {
      this.submittingCorrection.set(false);
    }
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

function todayRange(): { from: string; to: string } {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  const to   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  return { from, to };
}
