import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { SchedulesStore } from '../data-access/schedules.store';
import { ShiftsApi } from '../data-access/shifts.api';
import { ApiService } from '../../../core/http/api.service';
import { CuadranteGridComponent, type EmployeeRow, type AssignmentClickEvent } from '../ui/cuadrante-grid.component';
import type { ShiftTemplate, ShiftAssignment, SwapRequest, RuleCheckResult, ShiftSchedule } from '../data-access/shifts.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { ReportsApi } from '../../reports/data-access/reports.api';
import { AbsencesApi } from '../../absences/data-access/absences.api';
import type { AbsenceDto } from '../../absences/data-access/absences.api';

interface CenterDto { id: string; name: string; }
interface EmployeeDto { id: string; firstName: string; lastName: string; category: string; }

// Spanish labels for rule-engine violation codes
const RULE_VIOLATION_LABELS: Record<string, string> = {
  MIN_REST_12H:         'Descanso entre turnos insuficiente (mín. 12 h — Art. 34.3 ET)',
  MAX_DAILY_9H:         'Jornada diaria máxima superada (máx. 9 h — Art. 34.3 ET)',
  MAX_ANNUAL_OT_80H:    'Límite anual de horas extra superado (máx. 80 h — Art. 35.2 ET)',
  WEEKLY_REST_1_5_DAYS: 'Descanso semanal insuficiente (Art. 37.1 ET)',
};

// Shift colors for the dialog picker
const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MANANA:   { bg: 'rgba(59,130,246,0.22)',  text: '#1d4ed8', border: 'rgba(59,130,246,0.5)' },
  TARDE:    { bg: 'rgba(249,115,22,0.22)',  text: '#c2410c', border: 'rgba(249,115,22,0.5)' },
  NOCHE:    { bg: 'rgba(139,92,246,0.22)',  text: '#6d28d9', border: 'rgba(139,92,246,0.5)' },
  GUARDIA:  { bg: 'rgba(239,68,68,0.22)',   text: '#b91c1c', border: 'rgba(239,68,68,0.5)'  },
  RETEN:    { bg: 'rgba(234,179,8,0.22)',   text: '#a16207', border: 'rgba(234,179,8,0.5)'  },
  REFUERZO: { bg: 'rgba(20,184,166,0.22)',  text: '#0f766e', border: 'rgba(20,184,166,0.5)' },
  LIBRANZA: { bg: 'rgba(34,197,94,0.14)',   text: '#15803d', border: 'rgba(34,197,94,0.4)'  },
};

@Component({
  selector: 'app-cuadrante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, SlicePipe, CuadranteGridComponent,
    ButtonModule, TagModule, DialogModule,
    TooltipModule, MessageModule, ToastModule, SkeletonModule, DividerModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  styles: [`
    :host { display: block; }

    /* ── Page header ─────────────────────────────────────────── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-title {
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .page-sub {
      font-size: 0.8125rem;
      color: var(--text-2);
      margin-top: 0.25rem;
    }

    /* ── Controls row ────────────────────────────────────────── */
    .controls-row {
      display: flex;
      align-items: flex-end;
      gap: 0.75rem;
      flex-wrap: wrap;
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 0.875rem 1.25rem;
      margin-bottom: 1.25rem;
    }

    .ctrl-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .ctrl-label {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
      white-space: nowrap;
      text-align: center;
    }

    .native-select {
      min-width: 110px;
      height: 36px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0 0.75rem;
      cursor: pointer;
      outline: none;
      appearance: auto;
      transition: var(--transition);
    }
    .native-select:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    .ctrl-sep { flex: 1; }

    /* ── Schedule status ─────────────────────────────────────── */
    .schedule-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: var(--text-2);
    }

    /* ── Color legend ────────────────────────────────────────── */
    .legend {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.875rem;
      padding: 0 0.125rem;
    }

    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      font-size: 0.6875rem;
      font-weight: 700;
      border: 1px solid transparent;
    }

    /* ── Warnings box ────────────────────────────────────────── */
    .warnings-box {
      background: var(--warn-soft);
      border: 1px solid var(--warn);
      border-radius: var(--radius);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }

    .warnings-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--warn);
      margin-bottom: 0.375rem;
    }

    .warnings-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .warnings-list li {
      font-size: 0.75rem;
      color: var(--text-2);
    }

    /* ── No schedule panel ───────────────────────────────────── */
    .no-schedule {
      background: var(--surface);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 3rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .no-schedule .pi { font-size: 2.5rem; color: var(--primary); opacity: 0.5; }
    .no-schedule h3  { font-size: 1.125rem; font-weight: 700; color: var(--text); margin: 0; }
    .no-schedule p   { font-size: 0.875rem; color: var(--text-2); margin: 0; }

    /* ── Swaps section ───────────────────────────────────────── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.875rem;
      margin-top: 1.75rem;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-title .pi { color: var(--accent-ico); }

    .swaps-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .swap-header-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem 0.375rem;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-soft);
    }

    .swap-col-label {
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-3);
    }

    .swap-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--border-soft);
      transition: var(--transition);
    }

    .swap-row:last-child { border-bottom: none; }

    .swap-row:hover {
      background: var(--primary-soft);
    }

    .swap-id {
      font-size: 0.75rem;
      font-family: monospace;
      color: var(--text-2);
    }

    .swap-reason {
      font-size: 0.8125rem;
      color: var(--text);
      font-style: italic;
    }

    .swap-date {
      font-size: 0.75rem;
      color: var(--text-2);
      margin-top: 0.125rem;
    }

    .swap-actions { display: flex; gap: 0.375rem; }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2rem;
      color: var(--text-3);
      font-size: 0.8125rem;
    }

    /* ── Assignment dialog ───────────────────────────────────── */
    :host ::ng-deep .assign-dialog .p-dialog {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
    }
    :host ::ng-deep .assign-dialog .p-dialog-header {
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-soft);
      padding: 1rem 1.25rem;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
    :host ::ng-deep .assign-dialog .p-dialog-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--text);
    }
    :host ::ng-deep .assign-dialog .p-dialog-content { padding: 1.25rem; }

    .assign-ctx {
      font-size: 0.8125rem;
      color: var(--text-2);
      margin-bottom: 1rem;
    }

    .template-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 0.625rem;
    }

    .template-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.875rem 0.5rem;
      border-radius: var(--radius);
      cursor: pointer;
      border: 2px solid transparent;
      transition: transform 0.15s, filter 0.15s;
    }

    .template-card:hover  { transform: translateY(-2px); filter: brightness(1.1); }
    .template-card.selected { border-color: var(--primary) !important; box-shadow: var(--glow); }
    .template-card.assigned { opacity: 0.6; }

    .tmpl-label { font-size: 1.5rem;   font-weight: 900; }
    .tmpl-name  { font-size: 0.8125rem; font-weight: 700; }
    .tmpl-times { font-size: 0.6875rem; opacity: 0.8; }

    .removal-trigger {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--border-soft);
    }

    .removal-confirm {
      margin-top: 0.75rem;
      padding: 0.625rem 0.875rem;
      border-radius: var(--radius);
      background: var(--danger-soft, rgba(239,68,68,0.08));
      border: 1px solid rgba(239,68,68,0.3);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .removal-confirm__text {
      font-size: 0.8125rem;
      color: var(--text);
    }

    .removal-confirm__actions {
      display: flex;
      gap: 0.375rem;
      flex-shrink: 0;
    }

    .assign-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-soft);
    }

    /* ── Dark mode overrides ─────────────────────────────────── */
    :host-context([data-theme="dark"]) .controls-row,
    :host-context([data-theme="dark"]) .swaps-panel,
    :host-context([data-theme="dark"]) .no-schedule {
      box-shadow: var(--shadow);
    }

    :host-context([data-theme="dark"]) .warnings-box {
      border-color: var(--warn);
      background: var(--warn-soft);
    }

    :host-context([data-theme="dark"]) .warnings-list li {
      color: var(--text-2);
    }
  `],
  template: `
    <p-toast />

    <!-- ── Page header ────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <div class="page-title">{{ pageTitle() }}</div>
        <div class="page-sub">{{ pageSub() }}</div>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <p-button
          [label]="'REPORTS.EXPORT_PDF' | translate"
          icon="pi pi-file-pdf"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          size="small"
          [loading]="downloadingSchedule()"
          (onClick)="onDownloadSchedule()"
        />
        @if (isAdminOrManager()) {
          <p-button
            [label]="'COMMON.REFRESH' | translate"
            icon="pi pi-refresh"
            [text]="true" [rounded]="true" severity="secondary"
            (onClick)="loadAll()"
            [loading]="loading()"
          />
        }
      </div>
    </div>

    <!-- ── Warnings ───────────────────────────────────────────── -->
    @if (warnings().length > 0) {
      <div class="warnings-box">
        <div class="warnings-title">⚠ Rule violations on publish ({{ warnings().length }})</div>
        <ul class="warnings-list">
          @for (w of warnings(); track w.code) {
            <li>• {{ w.message }}</li>
          }
        </ul>
        <div style="margin-top:0.5rem;">
          <p-button [label]="'COMMON.CLOSE' | translate" icon="pi pi-times" [text]="true" size="small" severity="warn"
            (onClick)="warnings.set([])" />
        </div>
      </div>
    }

    <!-- ── Controls ───────────────────────────────────────────── -->
    <div class="controls-row">
      <div class="ctrl-group">
        <span class="ctrl-label">{{ 'COMMON.YEAR' | translate }}</span>
        <select class="native-select"
          [value]="selectedYear()"
          (change)="selectedYear.set(+$any($event.target).value)">
          @for (y of yearOptions; track y.value) {
            <option [value]="y.value">{{ y.label }}</option>
          }
        </select>
      </div>

      <div class="ctrl-group">
        <span class="ctrl-label">{{ 'COMMON.MONTH' | translate }}</span>
        <select class="native-select"
          [value]="selectedMonth()"
          (change)="selectedMonth.set(+$any($event.target).value)">
          @for (m of monthOptions; track m.value) {
            <option [value]="m.value">{{ m.label }}</option>
          }
        </select>
      </div>

      <p-button
        [label]="'COMMON.SEARCH' | translate"
        icon="pi pi-search"
        size="small"
        [style]="{ height: '36px' }"
        [loading]="loading()"
        (onClick)="loadAll()"
      />

      <div class="ctrl-sep"></div>

      <!-- Schedule status + actions -->
      @if (activeSchedule(); as sched) {
        <div class="schedule-meta">
          <p-tag
            [value]="sched.status === 'DRAFT' ? 'BORRADOR' : 'PUBLICADO'"
            [severity]="sched.status === 'PUBLISHED' ? 'success' : 'secondary'"
          />
          @if (sched.status === 'DRAFT' && isAdminOrManager()) {
            <p-button
              [label]="'SHIFTS.SCHEDULE_PUBLISH' | translate"
              icon="pi pi-send"
              size="small"
              severity="secondary"
              [loading]="publishing()"
              (onClick)="publish(sched.id)"
              [pTooltip]="'SHIFTS.SCHEDULE_PUBLISH_TOOLTIP' | translate"
            />
          }
          @if (sched.status === 'PUBLISHED' && sched.publishedAt) {
            <span>Publicado el {{ sched.publishedAt | date:'d MMM y' }}</span>
          }
        </div>
      } @else if (isAdminOrManager()) {
        <p-button
          [label]="'COMMON.CREATE' | translate"
          icon="pi pi-plus"
          size="small"
          [loading]="loading()"
          (onClick)="createDraft()"
        />
      }
    </div>

    <!-- ── Color legend ───────────────────────────────────────── -->
    @if (!loading() && templates().length > 0) {
      <div class="legend">
        @for (t of templates(); track t.id) {
          <span class="legend-chip"
            [style.background]="shiftColor(t.shiftType).bg"
            [style.color]="shiftColor(t.shiftType).text"
            [style.borderColor]="shiftColor(t.shiftType).border">
            {{ t.name }}
          </span>
        }
        @if (isDraft()) {
          <span style="font-size:0.7rem; color:var(--p-text-color-muted, var(--p-text-color-secondary)); margin-left:0.5rem;">
            <i class="pi pi-info-circle"></i> Haz clic en una celda para asignar un turno
          </span>
        }
      </div>
    }

    <!-- ── Loading skeleton ───────────────────────────────────── -->
    @if (loading()) {
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        @for (_ of [1,2,3,4,5]; track $index) {
          <p-skeleton height="2.5rem" borderRadius="6px" />
        }
      </div>
    }

    <!-- ── No schedule ────────────────────────────────────────── -->
    @if (!loading() && !activeSchedule()) {
      <div class="no-schedule">
        <i class="pi pi-calendar"></i>
        <h3>No hay cuadrante para {{ monthOptions[loadedMonth()-1]?.label }} {{ loadedYear() }}</h3>
        @if (createError()) {
          <p-message severity="warn" [text]="createError()!" styleClass="w-full" />
        }
        <p>
          @if (isAdminOrManager()) {
            Haz clic en "+ Crear" para crear un cuadrante para este período.
          } @else {
            No hay cuadrante publicado para este período todavía.
          }
        </p>
      </div>
    }

    <!-- ── Grid ──────────────────────────────────────────────── -->
    @if (!loading() && activeSchedule()) {
      <app-cuadrante-grid
        [employees]="employeeRows()"
        [assignments]="assignments()"
        [templates]="templates()"
        [year]="selectedYear()"
        [month]="selectedMonth()"
        [editable]="isDraft() && isAdminOrManager()"
        [absences]="monthAbsences()"
        (assignmentClick)="onCellClick($event)"
      />
    }

    <!-- ── Swap requests (admin/manager) ─────────────────────── -->
    @if (isAdminOrManager()) {
      <div class="section-header">
        <div class="section-title">
          <i class="pi pi-arrows-h"></i>
          {{ 'SHIFTS.SWAP_APPROVAL_TITLE' | translate }}
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          @if (pendingSwaps().length > 0) {
            <p-tag [value]="pendingSwaps().length + ' pending'" severity="warn" [rounded]="true" />
          }
          <p-button icon="pi pi-refresh" [text]="true" [rounded]="true" severity="secondary"
            (onClick)="loadSwaps()" [loading]="swapsLoading()" pTooltip="Refresh" />
        </div>
      </div>

      @if (swapViolations().length > 0) {
        <div class="warnings-box" style="margin-bottom:0.875rem;">
          <div class="warnings-title">{{ 'SHIFTS.RULE_VIOLATION' | translate }}</div>
          <ul class="warnings-list">
            @for (v of swapViolations(); track v.code) {
              <li>• {{ v.message }}</li>
            }
          </ul>
          <div style="margin-top:0.5rem;">
            <p-button [label]="'COMMON.CLOSE' | translate" icon="pi pi-times" [text]="true" size="small" severity="warn"
              (onClick)="swapViolations.set([])" />
          </div>
        </div>
      }

      <div class="swaps-panel">
        @if (swapsLoading()) {
          <div style="padding:1rem; display:flex; flex-direction:column; gap:0.5rem;">
            @for (_ of [1,2]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
          </div>
        } @else if (pendingSwaps().length === 0) {
          <div class="empty-state">
            <i class="pi pi-check-circle" style="font-size:1.25rem; opacity:0.4;"></i>
            {{ 'SHIFTS.SWAP_EMPTY' | translate }}
          </div>
        } @else {
          <div class="swap-header-row">
            <span class="swap-col-label">{{ 'SHIFTS.SWAP_FROM_LABEL' | translate }}</span>
            <span class="swap-col-label">{{ 'SHIFTS.SWAP_TO_LABEL' | translate }}</span>
            <span class="swap-col-label">{{ 'SHIFTS.SWAP_REASON_LABEL' | translate }}</span>
            <span class="swap-col-label">{{ 'COMMON.ACTIONS' | translate }}</span>
          </div>
          @for (swap of pendingSwaps(); track swap.id) {
            <div class="swap-row">
              <span class="swap-id">{{ swap.requesterAssignmentId | slice:0:8 }}…</span>
              <span class="swap-id">{{ swap.targetAssignmentId ? (swap.targetAssignmentId | slice:0:8) + '…' : '— open' }}</span>
              <div>
                <div class="swap-reason">{{ swap.reason ?? '—' }}</div>
                <div class="swap-date">{{ swap.createdAt | date:'d MMM y, HH:mm' }}</div>
              </div>
              <div class="swap-actions">
                <p-button
                  icon="pi pi-check"
                  severity="success"
                  size="small"
                  [loading]="processingSwap() === swap.id"
                  [disabled]="!!processingSwap()"
                  (onClick)="approveSwap(swap.id)"
                  pTooltip="Approve"
                />
                <p-button
                  icon="pi pi-times"
                  severity="danger"
                  size="small"
                  [loading]="processingSwap() === swap.id"
                  [disabled]="!!processingSwap()"
                  (onClick)="rejectSwap(swap.id)"
                  pTooltip="Reject"
                />
              </div>
            </div>
          }
        }
      </div>
    }

    <!-- ── Assignment dialog ──────────────────────────────────── -->
    <p-dialog
      [visible]="showAssignDialog()"
      (visibleChange)="showAssignDialog.set($event)"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="assign-dialog"
      [header]="dialogHeader()"
      [style]="{ width: '440px' }"
    >
      @if (dialogCtx(); as ctx) {
        <div class="assign-ctx">
          <strong>{{ ctx.employeeName }}</strong> — {{ formatAssignDate(ctx.date) }}
        </div>

        <div class="template-grid">
          @for (t of templates(); track t.id) {
            <div
              class="template-card"
              [class.selected]="selectedTemplateId() === t.id"
              [style.background]="shiftColor(t.shiftType).bg"
              [style.color]="shiftColor(t.shiftType).text"
              [style.borderColor]="shiftColor(t.shiftType).border"
              (click)="selectedTemplateId.set(t.id)"
              role="button"
              tabindex="0"
              (keydown.enter)="selectedTemplateId.set(t.id)"
              [attr.aria-pressed]="selectedTemplateId() === t.id"
            >
              <span class="tmpl-label">{{ t.shiftType === 'LIBRANZA' ? 'L' : t.name.charAt(0) }}</span>
              <span class="tmpl-name">{{ t.name }}</span>
              <span class="tmpl-times">
                @if (t.shiftType !== 'LIBRANZA') { {{ t.startTime }}–{{ t.endTime }} }
                @else { Libranza }
              </span>
            </div>
          }
        </div>

        @if (ctx.currentAssignmentId) {
          @if (confirmingRemoval()) {
            <div class="removal-confirm">
              <span class="removal-confirm__text">¿Quitar este turno del empleado?</span>
              <div class="removal-confirm__actions">
                <p-button
                  label="Cancelar"
                  [text]="true"
                  severity="secondary"
                  size="small"
                  (onClick)="confirmingRemoval.set(false)"
                />
                <p-button
                  label="Sí, quitar"
                  icon="pi pi-trash"
                  severity="danger"
                  size="small"
                  [loading]="removing()"
                  (onClick)="removeAssignment()"
                />
              </div>
            </div>
          } @else {
            <div class="removal-trigger">
              <p-button
                label="Quitar turno"
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                size="small"
                (onClick)="confirmingRemoval.set(true)"
              />
            </div>
          }
        }

        <div class="assign-footer">
          <p-button [label]="'COMMON.CANCEL' | translate" [text]="true" severity="secondary" (onClick)="closeDialog()" />
          <p-button
            [label]="'COMMON.CONFIRM' | translate"
            icon="pi pi-check"
            [disabled]="!selectedTemplateId()"
            [loading]="assigning()"
            (onClick)="confirmAssignment()"
          />
        </div>
      }
    </p-dialog>
  `,
})
export class CuadranteComponent implements OnInit {
  private readonly schedulesStore  = inject(SchedulesStore) as unknown as SchedulesStore;
  private readonly api             = inject(ShiftsApi);
  private readonly httpApi         = inject(ApiService);
  private readonly auth            = inject(AuthStore) as unknown as AuthStore;
  private readonly reportsApi      = inject(ReportsApi);
  private readonly absencesApi     = inject(AbsencesApi);
  private readonly messageService  = inject(MessageService);

  // ── State ──────────────────────────────────────────────────────────────────
  readonly loading             = signal(false);
  readonly downloadingSchedule = signal(false);
  readonly publishing          = signal(false);
  readonly assigning    = signal(false);
  readonly swapsLoading = signal(false);
  readonly warnings     = signal<RuleCheckResult[]>([]);
  readonly swapViolations = signal<RuleCheckResult[]>([]);
  readonly createError  = signal<string | null>(null);
  readonly processingSwap = signal<string | null>(null);

  readonly employees     = signal<EmployeeDto[]>([]);
  readonly templates     = signal<ShiftTemplate[]>([]);
  readonly assignments   = signal<ShiftAssignment[]>([]);
  readonly pendingSwaps  = signal<SwapRequest[]>([]);
  readonly monthAbsences = signal<AbsenceDto[]>([]);

  // Month/year picker — selectedYear/Month drive the dropdowns only;
  // loadedYear/Month track the last committed Buscar search.
  readonly selectedYear  = signal(new Date().getFullYear());
  readonly selectedMonth = signal(new Date().getMonth() + 1);
  readonly loadedYear    = signal(new Date().getFullYear());
  readonly loadedMonth   = signal(new Date().getMonth() + 1);

  // Dialog state
  readonly showAssignDialog    = signal(false);
  readonly confirmingRemoval   = signal(false);
  readonly removing            = signal(false);
  readonly dialogCtx = signal<{
    employeeId: string;
    employeeName: string;
    date: string;
    scheduleId: string;
    currentTemplate: ShiftTemplate | null;
    currentAssignmentId: string | null;
  } | null>(null);
  readonly selectedTemplateId = signal<string | null>(null);

  // Center (for creating schedules)
  private centerId: string | null = null;

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  readonly currentEmployeeId = computed(() => this.auth.user()?.employeeId ?? null);

  readonly pageTitle = computed(() => this.isAdminOrManager() ? 'Turnos — Cuadrante' : 'Mi horario');
  readonly pageSub   = computed(() => this.isAdminOrManager() ? 'Gestión mensual de turnos' : 'Tus turnos asignados');

  readonly activeSchedule = computed((): ShiftSchedule | null =>
    this.schedulesStore.schedules().find(
      s => s.year === this.loadedYear() && s.month === this.loadedMonth(),
    ) ?? null,
  );

  readonly isDraft = computed(() => this.activeSchedule()?.status === 'DRAFT');

  readonly dialogHeader = computed(() => {
    const ctx = this.dialogCtx();
    return ctx?.currentTemplate ? `Turno asignado: ${ctx.currentTemplate.name}` : 'Asignar turno';
  });

  readonly employeeRows = computed((): EmployeeRow[] => {
    const allRows = this.employees().map(e => ({
      id: e.id, firstName: e.firstName, lastName: e.lastName, category: e.category,
    }));
    if (this.isAdminOrManager()) return allRows;
    const myId = this.currentEmployeeId();
    return myId ? allRows.filter(r => r.id === myId) : allRows;
  });

  // ── Options ───────────────────────────────────────────────────────────────
  readonly yearOptions = (() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1].map(v => ({ label: String(v), value: v }));
  })();

  readonly monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' })
             .replace(/^\w/, c => c.toUpperCase()),
    value: i + 1,
  }));

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
    this.loadSwaps();
  }

  async loadAll(): Promise<void> {
    // Commit the current dropdown selection before fetching.
    this.loadedYear.set(this.selectedYear());
    this.loadedMonth.set(this.selectedMonth());
    this.loading.set(true);
    try {
      const [emps, tmpls, centers] = await Promise.all([
        firstValueFrom(this.httpApi.get<EmployeeDto[]>('/employees', { activeOnly: 'true' })),
        firstValueFrom(this.api.listTemplates()),
        firstValueFrom(this.httpApi.get<CenterDto[]>('/centers')),
      ]);
      this.employees.set(emps);
      this.templates.set(tmpls);
      this.centerId = centers[0]?.id ?? null;

      await this.schedulesStore.loadSchedules({
        year: String(this.loadedYear()),
      });

      const sched = this.activeSchedule();
      if (sched) {
        await this.loadAssignments(sched.id);
      }

      // Load approved absences for the loaded month (for grid overlay)
      try {
        const y = this.loadedYear(), m = this.loadedMonth();
        const from = `${y}-${String(m).padStart(2, '0')}-01`;
        const to   = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
        const absences = await firstValueFrom(
          this.absencesApi.listAbsences({ status: 'APPROVED', from, to }),
        );
        this.monthAbsences.set(absences);
      } catch {
        this.monthAbsences.set([]);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAssignments(scheduleId: string): Promise<void> {
    const list = await firstValueFrom(this.api.listAssignments({ scheduleId }));
    this.assignments.set(list);
  }

  loadSwaps(): void {
    this.swapsLoading.set(true);
    this.api.listSwaps({ status: 'REQUESTED' }).subscribe({
      next:  s => { this.pendingSwaps.set(s); this.swapsLoading.set(false); },
      error: () => this.swapsLoading.set(false),
    });
  }

  // ── Schedule CRUD ─────────────────────────────────────────────────────────
  async createDraft(): Promise<void> {
    if (!this.centerId) return;
    this.createError.set(null);
    this.loading.set(true);
    try {
      const schedule = await this.schedulesStore.createSchedule({
        centerId: this.centerId,
        year:  this.loadedYear(),
        month: this.loadedMonth(),
      });
      await this.loadAssignments(schedule.id);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        this.createError.set('Ya existe un cuadrante para este período.');
        await this.schedulesStore.loadSchedules({ year: String(this.loadedYear()) });
      }
    } finally {
      this.loading.set(false);
    }
  }

  async publish(scheduleId: string): Promise<void> {
    this.publishing.set(true);
    try {
      const warns = await this.schedulesStore.publishSchedule(scheduleId);
      if (warns.length) {
        this.warnings.set(warns);
        this.toast('warn', `Publicado con ${warns.length} advertencia(s)`);
      } else {
        this.toast('success', 'Cuadrante publicado correctamente');
      }
    } catch (err: unknown) {
      const httpErr = err as { status?: number; error?: { code?: string; details?: Array<{ code: string; message: string }> } };
      if (httpErr.status === 422 && httpErr.error?.code === 'RULE_VIOLATION') {
        const msgs = (httpErr.error.details ?? [])
          .map(d => RULE_VIOLATION_LABELS[d.code] ?? d.message)
          .join(' · ');
        this.toast('warn', 'Publicación bloqueada por infracciones laborales', msgs || undefined);
      } else {
        this.toast('error', 'Error al publicar el cuadrante. Inténtalo de nuevo.');
      }
    } finally {
      this.publishing.set(false);
    }
  }

  // ── Assignment ────────────────────────────────────────────────────────────
  onCellClick(event: AssignmentClickEvent): void {
    const sched = this.activeSchedule();
    if (!sched) return;

    const emp = this.employees().find(e => e.id === event.employeeId);
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : event.employeeId.slice(0, 8);

    // Find the current template if there is an assignment
    let currentTemplate: ShiftTemplate | null = null;
    if (event.assignment) {
      currentTemplate = this.templates().find(t => t.id === event.assignment!.shiftTemplateId) ?? null;
    }

    this.dialogCtx.set({
      employeeId:          event.employeeId,
      employeeName:        empName,
      date:                event.date,
      scheduleId:          sched.id,
      currentTemplate,
      currentAssignmentId: event.assignment?.id ?? null,
    });
    this.selectedTemplateId.set(event.assignment?.shiftTemplateId ?? null);
    this.confirmingRemoval.set(false);
    this.showAssignDialog.set(true);
  }

  closeDialog(): void {
    this.showAssignDialog.set(false);
    this.dialogCtx.set(null);
    this.selectedTemplateId.set(null);
    this.confirmingRemoval.set(false);
  }

  async confirmAssignment(): Promise<void> {
    const ctx      = this.dialogCtx();
    const tmplId   = this.selectedTemplateId();
    if (!ctx || !tmplId) return;

    this.assigning.set(true);
    try {
      const result = await firstValueFrom(
        this.api.createAssignment({
          scheduleId:      ctx.scheduleId,
          employeeId:      ctx.employeeId,
          shiftTemplateId: tmplId,
          date:            ctx.date,
        }),
      );
      await this.loadAssignments(ctx.scheduleId);
      this.closeDialog();
      if (result.warnings.length > 0) {
        const msgs = result.warnings
          .map(w => RULE_VIOLATION_LABELS[w.code] ?? w.message)
          .join(' · ');
        this.toast('warn', 'Turno asignado con advertencias', msgs);
      }
    } catch (err: unknown) {
      const httpErr = err as { status?: number; error?: { code?: string; details?: Array<{ code: string; message: string }> } };
      if (httpErr.status === 422 && httpErr.error?.code === 'RULE_VIOLATION') {
        const msgs = (httpErr.error.details ?? [])
          .map(d => RULE_VIOLATION_LABELS[d.code] ?? d.message)
          .join(' · ');
        this.toast('warn', 'Turno bloqueado por regla laboral', msgs || undefined);
      } else {
        this.toast('error', 'Error al asignar el turno. Inténtalo de nuevo.');
      }
    } finally {
      this.assigning.set(false);
    }
  }

  // ── Remove assignment ────────────────────────────────────────────────────────
  async removeAssignment(): Promise<void> {
    const ctx = this.dialogCtx();
    if (!ctx?.currentAssignmentId) return;
    this.removing.set(true);
    try {
      await firstValueFrom(this.api.deleteAssignment(ctx.currentAssignmentId));
      await this.loadAssignments(ctx.scheduleId);
      this.closeDialog();
      this.toast('success', 'Turno eliminado correctamente');
    } catch {
      this.toast('error', 'Error al eliminar el turno. Inténtalo de nuevo.');
    } finally {
      this.removing.set(false);
    }
  }

  // ── Swap actions ──────────────────────────────────────────────────────────
  approveSwap(swapId: string): void {
    this.processingSwap.set(swapId);
    this.swapViolations.set([]);
    this.api.approveSwap(swapId).subscribe({
      next: result => {
        this.pendingSwaps.update(list => list.filter(s => s.id !== swapId));
        if (result.warnings.length) this.swapViolations.set(result.warnings);
        this.processingSwap.set(null);
      },
      error: () => { this.processingSwap.set(null); },
    });
  }

  rejectSwap(swapId: string): void {
    this.processingSwap.set(swapId);
    this.api.rejectSwap(swapId).subscribe({
      next: () => {
        this.pendingSwaps.update(list => list.filter(s => s.id !== swapId));
        this.processingSwap.set(null);
      },
      error: () => { this.processingSwap.set(null); },
    });
  }

  async onDownloadSchedule(): Promise<void> {
    this.downloadingSchedule.set(true);
    try {
      await firstValueFrom(
        this.reportsApi.downloadSchedule({
          year:  this.selectedYear(),
          month: this.selectedMonth(),
          employeeId: this.auth.user()?.employeeId ?? undefined,
        }),
      );
    } catch {
      this.toast('error', 'Error al generar el PDF. Inténtalo de nuevo.');
    } finally {
      this.downloadingSchedule.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  shiftColor(shiftType: string) {
    return SHIFT_COLORS[shiftType] ?? { bg: 'rgba(100,100,100,0.2)', text: '#aaa', border: 'rgba(100,100,100,0.4)' };
  }

  formatAssignDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const dayName = d.toLocaleDateString('es-ES', { weekday: 'long' });
    const month   = d.toLocaleDateString('es-ES', { month: 'long' });
    return `${cap(dayName)}, ${d.getDate()} de ${cap(month)} de ${d.getFullYear()}`;
  }

  private toast(severity: 'success' | 'error' | 'warn', summary: string, detail?: string): void {
    this.messageService.add({ severity, summary, detail, life: 4000 });
  }
}
