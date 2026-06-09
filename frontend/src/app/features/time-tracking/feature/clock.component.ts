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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
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
import { ExportDialogComponent } from '../../reports/ui/export-dialog.component';
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
    ExportDialogComponent, TranslatePipe,
  ],
  styles: [`
    :host { display: block; max-width: 760px; margin: 0 auto; }

    /* ── Page header ────────────────────────────────────────────────── */
    .page-header { margin-bottom: 1.75rem; }

    .page-title {
      font-size: 1.5625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .page-sub {
      font-size: 0.8125rem;
      color: var(--text-2);
      margin-top: 0.25rem;
      text-transform: capitalize;
    }

    /* ── SSE badge ──────────────────────────────────────────────────── */
    .sse-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      color: var(--text-3);
    }

    .sse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .sse-dot.connected    { background: var(--ok); }
    .sse-dot.disconnected { background: var(--danger); }

    /* ── Clock hero card ────────────────────────────────────────────── */
    .clock-card {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 2.5rem 2rem 2rem;
      text-align: center;
      margin-bottom: 1.25rem;
      position: relative;
      overflow: hidden;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    /* Subtle radial glow behind the ring */
    .clock-card::before {
      content: '';
      position: absolute;
      top: -120px;
      left: 50%;
      transform: translateX(-50%);
      width: 520px;
      height: 380px;
      background: radial-gradient(circle, var(--primary-soft), transparent 65%);
      pointer-events: none;
    }

    .clock-card.is-clocked-in {
      border-color: var(--ok-soft);
      box-shadow: var(--shadow), 0 0 0 1px var(--ok-soft);
    }

    /* ── Status row ─────────────────────────────────────────────────── */
    .status-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 0.375rem;
      position: relative;
      z-index: 1;
    }

    .status-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--text-3);
    }

    .status-dot.online {
      background: var(--ok);
      box-shadow: 0 0 0 3px var(--ok-soft);
      animation: sdot-pulse 2s infinite;
    }

    @keyframes sdot-pulse {
      0%   { box-shadow: 0 0 0 0 var(--ok-soft); }
      70%  { box-shadow: 0 0 0 6px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }

    .status-text {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-2);
    }

    .status-text.online { color: var(--ok); }

    /* ── Ring / timer ───────────────────────────────────────────────── */
    .ring-wrap {
      position: relative;
      width: 200px;
      height: 200px;
      display: grid;
      place-items: center;
      margin: 0.75rem auto 0.25rem;
      z-index: 1;
    }

    .ring-svg {
      position: absolute;
      inset: 0;
      transform: rotate(-90deg);
      overflow: visible;
    }

    .ring-bg {
      fill: none;
      stroke: var(--border-soft);
      stroke-width: 6;
    }

    .ring-fg {
      fill: none;
      stroke: var(--primary);
      stroke-width: 6;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.5s ease, stroke var(--transition);
    }

    .ring-fg.running  { stroke: var(--ok); }
    .ring-fg.overtime { stroke: var(--warn); }

    .ring-inner {
      position: relative;
      z-index: 1;
      text-align: center;
    }

    .timer-display {
      font-size: 2.75rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      font-family: ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace;
      color: var(--text);
      transition: color var(--transition);
    }

    .timer-display.running { color: var(--ok); }

    .timer-label {
      font-size: 0.75rem;
      color: var(--text-2);
      margin-top: 0.375rem;
    }

    /* ── Location row ───────────────────────────────────────────────── */
    .location-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      margin: 1.25rem 0 0.25rem;
      color: var(--text-3);
      min-height: 1.25rem;
      position: relative;
      z-index: 1;
    }

    .location-row .pi { font-size: 0.875rem; }
    .location-row.granted   { color: var(--ok); }
    .location-row.denied    { color: var(--danger); }
    .location-row.requesting { color: var(--primary); }

    /* ── Action buttons ─────────────────────────────────────────────── */
    .clock-btn-wrap {
      display: flex;
      justify-content: center;
      margin-top: 1.25rem;
      position: relative;
      z-index: 1;
    }

    :host ::ng-deep .btn-clock-in .p-button {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
      font-size: 0.9375rem;
      font-weight: 600;
      padding: 0.875rem 2.5rem;
      border-radius: var(--radius);
      min-width: 180px;
      box-shadow: var(--glow);
      transition: background var(--transition), transform 0.1s;
    }

    :host ::ng-deep .btn-clock-in .p-button:hover:not(:disabled) {
      background: var(--primary-hover);
      border-color: var(--primary-hover);
      transform: translateY(-1px);
    }

    :host ::ng-deep .btn-clock-in .p-button:active:not(:disabled) { transform: translateY(0); }

    :host ::ng-deep .btn-clock-out .p-button {
      background: var(--danger-soft);
      border-color: var(--danger);
      color: var(--danger);
      font-size: 0.9375rem;
      font-weight: 600;
      padding: 0.875rem 2.5rem;
      border-radius: var(--radius);
      min-width: 180px;
      transition: background var(--transition), transform 0.1s;
    }

    :host ::ng-deep .btn-clock-out .p-button:hover:not(:disabled) {
      background: var(--danger);
      border-color: var(--danger);
      color: #fff;
      transform: translateY(-1px);
    }

    :host ::ng-deep .btn-clock-out .p-button:active:not(:disabled) { transform: translateY(0); }

    /* ── Source / GPS badge ─────────────────────────────────────────── */
    .source-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      background: var(--primary-soft);
      color: var(--accent-ico, var(--primary));
      border-radius: var(--radius-sm);
      padding: 2px 8px;
      margin-top: 0.75rem;
      position: relative;
      z-index: 1;
    }

    /* ── API error ──────────────────────────────────────────────────── */
    .api-error {
      margin-top: 1rem;
      text-align: left;
      position: relative;
      z-index: 1;
    }

    /* ── Stats strip ────────────────────────────────────────────────── */
    .stats-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border-soft);
      border-radius: var(--radius);
      overflow: hidden;
      margin: 1.75rem auto 0;
      max-width: 500px;
      position: relative;
      z-index: 1;
    }

    .stat-cell {
      background: var(--surface);
      padding: 0.875rem 0.5rem;
      text-align: center;
    }

    .stat-value {
      font-size: 1.125rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      font-family: ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace;
      color: var(--text);
    }

    .stat-value.ok { color: var(--ok); }

    .stat-label {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
      margin-top: 4px;
    }

    /* ── Section header ─────────────────────────────────────────────── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-title .pi { color: var(--accent-ico, var(--primary)); font-size: 0.875rem; }

    /* ── Team panel ─────────────────────────────────────────────────── */
    .team-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 1.25rem;
    }

    .team-panel .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-soft);
    }

    .team-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--border-soft);
      transition: background var(--transition);
    }

    .team-row:last-child { border-bottom: none; }
    .team-row:hover { background: var(--surface-2); }

    .team-avatar {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: linear-gradient(150deg, var(--primary-hover), var(--primary));
      display: grid;
      place-items: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .team-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
    }

    .team-since {
      font-size: 0.6875rem;
      color: var(--text-2);
      margin-top: 1px;
    }

    .team-duration {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .live-dot {
      width: 7px;
      height: 7px;
      background: var(--ok);
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 3px var(--ok-soft);
      animation: sdot-pulse 2s infinite;
    }

    /* ── Entries panel ──────────────────────────────────────────────── */
    .entries-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 1.25rem;
    }

    .entry-header-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem 0.4375rem;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-soft);
    }

    .entry-col-label {
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-3);
    }

    .entry-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--border-soft);
      transition: background var(--transition);
    }

    .entry-row:last-child { border-bottom: none; }
    .entry-row:hover { background: var(--surface-2); }

    .entry-time {
      font-size: 0.9375rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--text);
    }

    .entry-dash {
      font-size: 0.875rem;
      color: var(--text-3);
    }

    .entry-duration {
      font-size: 0.875rem;
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }

    .entry-duration.running { color: var(--ok); font-weight: 600; }

    /* ── Timeline ───────────────────────────────────────────────────── */
    .tl { padding: 0.875rem 1.25rem 1.125rem; }

    .tl-item {
      display: flex;
      gap: 0.875rem;
      position: relative;
      padding-bottom: 1.125rem;
    }

    .tl-item:last-child { padding-bottom: 0; }

    .tl-item::before {
      content: '';
      position: absolute;
      left: 6px;
      top: 18px;
      bottom: -2px;
      width: 2px;
      background: var(--border-soft);
    }

    .tl-item:last-child::before { display: none; }

    .tl-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 2px;
      border: 3px solid var(--surface);
      z-index: 1;
    }

    .tl-dot.in    { background: var(--ok); }
    .tl-dot.out   { background: var(--danger); }
    .tl-dot.pause { background: var(--warn); }

    .tl-act  { font-size: 0.8125rem; font-weight: 600; color: var(--text); }
    .tl-time { font-size: 0.8125rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text); font-family: ui-monospace, monospace; }
    .tl-meta { font-size: 0.6875rem; color: var(--text-2); margin-top: 2px; }

    /* ── Empty state ────────────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2.5rem 1rem;
      color: var(--text-3);
      font-size: 0.8125rem;
    }

    .empty-state .pi { font-size: 1.75rem; opacity: 0.5; }

    /* ── Correction section ─────────────────────────────────────────── */
    .correction-section {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .correction-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 1rem 1.25rem;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-2);
      font-size: 0.875rem;
      font-weight: 500;
      text-align: left;
      transition: color var(--transition);
    }

    .correction-toggle:hover { color: var(--text); }
    .correction-toggle .pi  { font-size: 0.875rem; color: var(--accent-ico, var(--primary)); }

    .correction-form {
      padding: 0 1.25rem 1.25rem;
      border-top: 1px solid var(--border-soft);
    }

    .form-field {
      margin-top: 1rem;
      margin-bottom: 1rem;
    }

    .form-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    :host ::ng-deep .correction-form .p-textarea {
      width: 100%;
      background: var(--bg);
      border-color: var(--border);
      color: var(--text);
      border-radius: var(--radius-sm);
      resize: vertical;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    :host ::ng-deep .correction-form .p-textarea:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
      outline: none;
    }

    /* ── Dark mode overrides ────────────────────────────────────────── */
    :host-context([data-theme="dark"]) .clock-card {
      box-shadow: var(--shadow);
    }

    :host-context([data-theme="dark"]) .clock-card.is-clocked-in {
      border-color: var(--ok-soft);
      box-shadow: var(--shadow), 0 0 0 1px var(--ok-soft);
    }

    :host-context([data-theme="dark"]) .ring-wrap {
      filter: drop-shadow(var(--glow));
    }

    :host-context([data-theme="dark"]) :host ::ng-deep .btn-clock-in .p-button {
      box-shadow: var(--glow);
    }

    :host-context([data-theme="dark"]) .stat-cell {
      background: var(--surface);
    }

    :host-context([data-theme="dark"]) .tl-dot {
      border-color: var(--surface);
    }
  `],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div class="page-title">{{ 'TIME.TITLE' | translate }}</div>
          <div class="page-sub">{{ today | date:'EEEE, d MMMM y':undefined:lang.dateLocale() }}</div>
        </div>
        <div class="sse-badge" [pTooltip]="sse.connected() ? ('COMMON.ACTIVE' | translate) : ('COMMON.ERROR' | translate)" tooltipPosition="left">
          <span class="sse-dot" [class.connected]="sse.connected()" [class.disconnected]="!sse.connected()"></span>
          {{ sse.connected() ? ('COMMON.ACTIVE' | translate) : ('COMMON.ERROR' | translate) }}
        </div>
      </div>
    </div>

    <!-- ── Clock card ─────────────────────────────────────────────── -->
    <div class="clock-card" [class.is-clocked-in]="isClockedIn()">

      <!-- Status -->
      <div class="status-row">
        <span class="status-dot" [class.online]="isClockedIn()" [class.offline]="!isClockedIn()"></span>
        <span class="status-text" [class.online]="isClockedIn()" [class.offline]="!isClockedIn()">
          {{ isClockedIn() ? ('STATUS.OPEN' | translate) : ('STATUS.CLOSED' | translate) }}
        </span>
      </div>

      <!-- Timer display -->
      <div class="timer-display" [class.running]="isClockedIn()">
        {{ timerDisplay() }}
      </div>
      <div class="timer-label">
        @if (isClockedIn()) {
          {{ 'TIME.CLOCKED_IN_SINCE' | translate }} {{ store.clockInTime() | date:'HH:mm' }}
        } @else {
          {{ 'TIME.NOT_CLOCKED_IN' | translate }}
        }
      </div>

      <!-- Geolocation indicator -->
      <div class="location-row" [class.granted]="geoStatus() === 'granted'" [class.denied]="geoStatus() === 'denied'" [class.requesting]="geoStatus() === 'requesting'">
        @switch (geoStatus()) {
          @case ('requesting') {
            <i class="pi pi-spin pi-spinner"></i>
            <span>{{ 'TIME.LOCATION_REQUESTING' | translate }}</span>
          }
          @case ('granted') {
            <i class="pi pi-map-marker"></i>
            <span>{{ geoLabel() }}</span>
          }
          @case ('denied') {
            <i class="pi pi-ban"></i>
            <span>{{ 'TIME.LOCATION_UNAVAILABLE' | translate }}</span>
          }
          @default {
            <i class="pi pi-map-marker" style="opacity:0.3;"></i>
            <span>{{ 'TIME.LOCATION_IDLE' | translate }}</span>
          }
        }
      </div>

      <!-- Action button -->
      <div class="clock-btn-wrap">
        @if (!isClockedIn()) {
          <div class="btn-clock-in">
            <p-button
              [label]="store.isClocking() ? ('TIME.CLOCKING_IN' | translate) : ('TIME.CLOCK_IN' | translate)"
              icon="pi pi-play"
              iconPos="left"
              [loading]="store.isClocking()"
              (onClick)="onClockIn()"
              [attr.aria-label]="'TIME.CLOCK_IN' | translate"
            />
          </div>
        } @else {
          <div class="btn-clock-out">
            <p-button
              [label]="store.isClocking() ? ('TIME.CLOCKING_OUT' | translate) : ('TIME.CLOCK_OUT' | translate)"
              icon="pi pi-stop"
              iconPos="left"
              [loading]="store.isClocking()"
              (onClick)="onClockOut()"
              [attr.aria-label]="'TIME.CLOCK_OUT' | translate"
            />
          </div>
        }
      </div>

      <!-- Source badge (shows GPS when active) -->
      @if (isClockedIn() && geoStatus() === 'granted') {
        <div style="display:flex; justify-content:center;">
          <span class="source-badge">
            <i class="pi pi-map-marker"></i>
            {{ 'TIME.GPS_LOGGED' | translate }}
          </span>
        </div>
      }

      <!-- 409 open-session conflict -->
      @if (store.clockInConflict()) {
        <div class="api-error">
          <p-message
            severity="warn"
            [text]="'TIME.OPEN_SESSION_CONFLICT' | translate"
          />
          <div style="margin-top: 0.75rem; display:flex; justify-content:center;">
            <p-button
              [label]="'TIME.FORCE_CLOCK_OUT' | translate"
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
          {{ 'TIME.LIVE_TEAM' | translate }}
        </div>
        <p-tag
          [value]="'DASHBOARD.ONLINE_BADGE' | translate:{ count: liveEntries().length }"
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
            <span>{{ 'TIME.EMPTY_ENTRIES' | translate }}</span>
          </div>
        } @else {
          @for (entry of liveEntries(); track entry.id) {
            <div class="team-row">
              <div>
                <div class="team-name">{{ employeeName(entry.employeeId) }}</div>
                <div class="team-since">{{ entry.clockIn | date:'HH:mm' }}</div>
              </div>
              <div class="team-duration">{{ entryDuration(entry) }}</div>
              <span class="live-dot" title="Online"></span>
            </div>
          }
        }
      </div>
    }

    <!-- ── Export for Inspection ─────────────────────────────────────── -->
    @if (isAdminOrManager()) {
      <div style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
        <p-button
          [label]="'REPORTS.EXPORT_TITLE' | translate"
          icon="pi pi-file-export"
          severity="secondary"
          size="small"
          (onClick)="showExport.set(true)"
        />
      </div>
    }

    <!-- ── Today's entries ─────────────────────────────────────────── -->
    <div class="section-header">
      <div class="section-title">
        <i class="pi pi-list"></i>
        {{ 'DASHBOARD.TODAY_ACTIVITY' | translate }}
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
          <span>{{ 'TIME.EMPTY_ENTRIES' | translate }}</span>
        </div>
      } @else {
        <div class="entry-header-row">
          <span class="entry-col-label">{{ 'TIME.ENTRY_TABLE_CLOCK_IN' | translate }}</span>
          <span class="entry-col-label">{{ 'TIME.ENTRY_TABLE_CLOCK_OUT' | translate }}</span>
          <span class="entry-col-label">{{ 'TIME.ENTRY_TABLE_DURATION' | translate }}</span>
          <span class="entry-col-label">{{ 'TIME.ENTRY_TABLE_STATUS' | translate }}</span>
        </div>
        @for (entry of todayEntries(); track entry.id) {
          <div class="entry-row">
            <span class="entry-time">{{ entry.clockIn | date:'HH:mm' }}</span>
            <span class="entry-time">
              @if (entry.clockOut) {
                {{ entry.clockOut | date:'HH:mm' }}
              } @else {
                <span class="entry-dash">{{ 'DASHBOARD.RUNNING' | translate }}</span>
              }
            </span>
            <span class="entry-duration" [class.running]="entry.status === 'OPEN'">
              {{ entryDuration(entry) }}
            </span>
            <p-tag
              [value]="entry.status === 'OPEN' ? ('STATUS.OPEN' | translate) : ('STATUS.CLOSED' | translate)"
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
        {{ 'TIME.CORRECTION_TITLE' | translate }}
      </button>

      @if (showCorrection()) {
        <div class="correction-form">
          <div class="form-field">
            <label class="form-label" for="justification">{{ 'TIME.CORRECTION_REASON' | translate }}</label>
            <textarea
              pTextarea
              id="justification"
              rows="3"
              [value]="justification()"
              (input)="justification.set($any($event.target).value)"
              [placeholder]="'TIME.CORRECTION_REASON_PLACEHOLDER' | translate"
              aria-required="true"
            ></textarea>
          </div>

          <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
            <p-button
              [label]="'TIME.CORRECTION_SUBMIT' | translate"
              icon="pi pi-send"
              [loading]="submittingCorrection()"
              [disabled]="!justification().trim() || !hasTodayEntry()"
              (onClick)="onSubmitCorrection()"
              size="small"
            />
            @if (!hasTodayEntry()) {
              <span style="font-size:0.75rem; color:var(--p-text-color-muted, var(--p-text-color-secondary));">
                {{ 'TIME.EMPTY_ENTRIES' | translate }}
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

    <app-export-dialog
      [visible]="showExport()"
      (closed)="showExport.set(false)"
    />
  `,
})
export class ClockComponent implements OnInit, OnDestroy {
  protected readonly store = inject(TimeStore) as unknown as TimeStore;
  protected readonly sse   = inject(SseService);
  private  readonly api    = inject(TimeApi);
  private  readonly apiService = inject(ApiService);
  private  readonly auth   = inject(AuthStore) as unknown as AuthStore;
  readonly lang            = inject(LanguageService);

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

  readonly showExport = signal(false);

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
