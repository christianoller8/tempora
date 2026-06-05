import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { forkJoin, firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { SchedulesStore } from '../data-access/schedules.store';
import { ShiftsApi } from '../data-access/shifts.api';
import { ApiService } from '../../../core/http/api.service';
import { CuadranteGridComponent, type EmployeeRow, type AssignmentClickEvent } from '../ui/cuadrante-grid.component';
import type { ShiftTemplate, ShiftAssignment, SwapRequest, RuleCheckResult, ShiftSchedule } from '../data-access/shifts.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { ReportsApi } from '../../reports/data-access/reports.api';

interface CenterDto { id: string; name: string; }
interface EmployeeDto { id: string; firstName: string; lastName: string; category: string; }

// Shift colors for the dialog picker
const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MANANA:   { bg: 'rgba(59,130,246,0.22)',  text: '#93c5fd', border: 'rgba(59,130,246,0.5)' },
  TARDE:    { bg: 'rgba(249,115,22,0.22)',  text: '#fdba74', border: 'rgba(249,115,22,0.5)' },
  NOCHE:    { bg: 'rgba(139,92,246,0.22)',  text: '#c4b5fd', border: 'rgba(139,92,246,0.5)' },
  GUARDIA:  { bg: 'rgba(239,68,68,0.22)',   text: '#fca5a5', border: 'rgba(239,68,68,0.5)'  },
  RETEN:    { bg: 'rgba(234,179,8,0.22)',   text: '#fde047', border: 'rgba(234,179,8,0.5)'  },
  REFUERZO: { bg: 'rgba(20,184,166,0.22)',  text: '#5eead4', border: 'rgba(20,184,166,0.5)' },
  LIBRANZA: { bg: 'rgba(34,197,94,0.14)',   text: '#86efac', border: 'rgba(34,197,94,0.4)'  },
};

@Component({
  selector: 'app-cuadrante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, SlicePipe, CuadranteGridComponent,
    ButtonModule, TagModule, DialogModule,
    TooltipModule, MessageModule, SkeletonModule, DividerModule,
  ],
  styles: [`
    :host { display: block; }

    /* ── Page header ────────────────────────────────────────── */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
    .page-title  { font-size: 1.375rem; font-weight: 700; color: var(--p-text-color); }
    .page-sub    { font-size: 0.8125rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin-top: 0.125rem; }

    /* ── Controls row ───────────────────────────────────────── */
    .controls-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      padding: 0.875rem 1.125rem;
      margin-bottom: 1.25rem;
    }

    .ctrl-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .native-select {
      min-width: 120px;
      height: 36px;
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 8px;
      color: var(--p-text-color);
      font-size: 0.875rem;
      padding: 0 0.75rem;
      cursor: pointer;
      outline: none;
      appearance: auto;
    }
    .native-select:focus {
      border-color: var(--p-primary-color);
    }

    .ctrl-sep {
      flex: 1;
    }

    /* ── Status badge ───────────────────────────────────────── */
    .schedule-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    /* ── Color legend ───────────────────────────────────────── */
    .legend {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.875rem;
    }

    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 700;
      border: 1px solid transparent;
    }

    /* ── Warnings ───────────────────────────────────────────── */
    .warnings-box {
      background: color-mix(in srgb, var(--p-yellow-500, #eab308) 10%, transparent);
      border: 1px solid var(--p-yellow-500, #eab308);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }

    .warnings-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--p-yellow-300, #fde047);
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
      color: var(--p-yellow-200, #fef08a);
    }

    /* ── No schedule panel ──────────────────────────────────── */
    .no-schedule {
      background: var(--p-surface-card);
      border: 1px dashed var(--p-surface-border);
      border-radius: 12px;
      padding: 3rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .no-schedule .pi { font-size: 2.5rem; color: var(--p-primary-color); opacity: 0.5; }
    .no-schedule h3  { font-size: 1.125rem; font-weight: 700; color: var(--p-text-color); margin: 0; }
    .no-schedule p   { font-size: 0.875rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin: 0; }

    /* ── Swaps section ──────────────────────────────────────── */
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
      color: var(--p-text-color);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-title .pi { color: var(--p-primary-color); }

    .swaps-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      overflow: hidden;
    }

    .swap-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .swap-row:last-child { border-bottom: none; }
    .swap-row:hover { background: color-mix(in srgb, var(--p-primary-color) 4%, transparent); }

    .swap-header-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem 0.375rem;
      background: var(--p-surface-section);
      border-bottom: 1px solid var(--p-surface-border);
    }

    .swap-col-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .swap-id {
      font-size: 0.75rem;
      font-family: monospace;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .swap-reason {
      font-size: 0.8125rem;
      color: var(--p-text-color);
      font-style: italic;
    }

    .swap-date { font-size: 0.8125rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); }

    .swap-actions { display: flex; gap: 0.375rem; }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-size: 0.8125rem;
    }

    /* ── Assignment dialog ──────────────────────────────────── */
    :host ::ng-deep .assign-dialog .p-dialog { background: var(--p-surface-card); border: 1px solid var(--p-surface-border); border-radius: 14px; }
    :host ::ng-deep .assign-dialog .p-dialog-header { background: var(--p-surface-section); border-bottom: 1px solid var(--p-surface-border); padding: 1rem 1.25rem; border-radius: 14px 14px 0 0; }
    :host ::ng-deep .assign-dialog .p-dialog-title { font-size: 0.9375rem; font-weight: 700; color: var(--p-text-color); }
    :host ::ng-deep .assign-dialog .p-dialog-content { padding: 1.25rem; }

    .assign-ctx {
      font-size: 0.8125rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
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
      border-radius: 10px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: transform 0.15s, filter 0.15s;
    }

    .template-card:hover { transform: translateY(-2px); filter: brightness(1.1); }
    .template-card.selected { border-color: var(--p-primary-color) !important; }

    .template-card.assigned { opacity: 0.6; }

    .tmpl-label { font-size: 1.5rem; font-weight: 900; }
    .tmpl-name  { font-size: 0.8125rem; font-weight: 700; }
    .tmpl-times { font-size: 0.6875rem; opacity: 0.8; }

    .assign-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--p-surface-border);
    }
  `],
  template: `
    <!-- ── Page header ────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <div class="page-title">{{ pageTitle() }}</div>
        <div class="page-sub">{{ pageSub() }}</div>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <p-button
          label="Schedule PDF"
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
            label="Refresh"
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
          <p-button label="Dismiss" icon="pi pi-times" [text]="true" size="small" severity="warn"
            (onClick)="warnings.set([])" />
        </div>
      </div>
    }

    <!-- ── Controls ───────────────────────────────────────────── -->
    <div class="controls-row">
      <span class="ctrl-label">Year</span>
      <select class="native-select"
        [value]="selectedYear()"
        (change)="selectedYear.set(+$any($event.target).value)">
        @for (y of yearOptions; track y.value) {
          <option [value]="y.value">{{ y.label }}</option>
        }
      </select>

      <span class="ctrl-label">Month</span>
      <select class="native-select"
        [value]="selectedMonth()"
        (change)="selectedMonth.set(+$any($event.target).value)">
        @for (m of monthOptions; track m.value) {
          <option [value]="m.value">{{ m.label }}</option>
        }
      </select>

      <p-button
        label="Load"
        icon="pi pi-search"
        size="small"
        [loading]="loading()"
        (onClick)="loadAll()"
      />

      <div class="ctrl-sep"></div>

      <!-- Schedule status + actions -->
      @if (activeSchedule(); as sched) {
        <div class="schedule-meta">
          <p-tag
            [value]="sched.status"
            [severity]="sched.status === 'PUBLISHED' ? 'success' : 'warn'"
          />
          @if (sched.status === 'DRAFT' && isAdminOrManager()) {
            <p-button
              label="Publish"
              icon="pi pi-send"
              size="small"
              severity="success"
              [loading]="publishing()"
              (onClick)="publish(sched.id)"
              pTooltip="Publish this draft and enforce rule checks"
            />
          }
          @if (sched.status === 'PUBLISHED' && sched.publishedAt) {
            <span>Published {{ sched.publishedAt | date:'d MMM y' }}</span>
          }
        </div>
      } @else if (isAdminOrManager()) {
        <p-button
          label="New Draft"
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
            <i class="pi pi-info-circle"></i> Click a cell to assign a shift
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
        <h3>No schedule for {{ monthOptions[selectedMonth()-1]?.label }} {{ selectedYear() }}</h3>
        <p>
          @if (isAdminOrManager()) {
            Click "New Draft" to create a schedule for this period.
          } @else {
            No schedule has been published for this period yet.
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
        (assignmentClick)="onCellClick($event)"
      />
    }

    <!-- ── Swap requests (admin/manager) ─────────────────────── -->
    @if (isAdminOrManager()) {
      <div class="section-header">
        <div class="section-title">
          <i class="pi pi-arrows-h"></i>
          Pending Shift Swaps
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
          <div class="warnings-title">Swap blocked by rule check</div>
          <ul class="warnings-list">
            @for (v of swapViolations(); track v.code) {
              <li>• {{ v.message }}</li>
            }
          </ul>
          <div style="margin-top:0.5rem;">
            <p-button label="Dismiss" icon="pi pi-times" [text]="true" size="small" severity="warn"
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
            No pending swap requests
          </div>
        } @else {
          <div class="swap-header-row">
            <span class="swap-col-label">Requester Assignment</span>
            <span class="swap-col-label">Target Assignment</span>
            <span class="swap-col-label">Reason / Date</span>
            <span class="swap-col-label">Actions</span>
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
      [(visible)]="showAssignDialog"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="assign-dialog"
      header="Assign Shift"
      [style]="{ width: '440px' }"
    >
      @if (dialogCtx(); as ctx) {
        <div class="assign-ctx">
          <strong>{{ ctx.employeeName }}</strong> — {{ ctx.date | date:'EEEE, d MMMM y' }}
          @if (ctx.currentTemplate) {
            <span> — currently: <strong>{{ ctx.currentTemplate.name }}</strong></span>
          }
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
                @else { Day off }
              </span>
            </div>
          }
        </div>

        <div class="assign-footer">
          <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="closeDialog()" />
          <p-button
            label="Assign"
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
  private readonly schedulesStore = inject(SchedulesStore) as unknown as SchedulesStore;
  private readonly api            = inject(ShiftsApi);
  private readonly httpApi        = inject(ApiService);
  private readonly auth           = inject(AuthStore) as unknown as AuthStore;
  private readonly reportsApi     = inject(ReportsApi);

  // ── State ──────────────────────────────────────────────────────────────────
  readonly loading             = signal(false);
  readonly downloadingSchedule = signal(false);
  readonly publishing          = signal(false);
  readonly assigning    = signal(false);
  readonly swapsLoading = signal(false);
  readonly warnings     = signal<RuleCheckResult[]>([]);
  readonly swapViolations = signal<RuleCheckResult[]>([]);
  readonly processingSwap = signal<string | null>(null);

  readonly employees   = signal<EmployeeDto[]>([]);
  readonly templates   = signal<ShiftTemplate[]>([]);
  readonly assignments = signal<ShiftAssignment[]>([]);
  readonly pendingSwaps = signal<SwapRequest[]>([]);

  // Month/year picker
  readonly selectedYear  = signal(new Date().getFullYear());
  readonly selectedMonth = signal(new Date().getMonth() + 1);

  // Dialog state
  showAssignDialog = false;
  readonly dialogCtx = signal<{
    employeeId: string;
    employeeName: string;
    date: string;
    scheduleId: string;
    currentTemplate: ShiftTemplate | null;
  } | null>(null);
  readonly selectedTemplateId = signal<string | null>(null);

  // Center (for creating schedules)
  private centerId: string | null = null;

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  readonly currentEmployeeId = computed(() => this.auth.user()?.employeeId ?? null);

  readonly pageTitle = computed(() => this.isAdminOrManager() ? 'Shifts — Cuadrante' : 'My Schedule');
  readonly pageSub   = computed(() => this.isAdminOrManager() ? 'Monthly schedule management' : 'Your upcoming shift assignments');

  readonly activeSchedule = computed((): ShiftSchedule | null =>
    this.schedulesStore.schedules().find(
      s => s.year === this.selectedYear() && s.month === this.selectedMonth(),
    ) ?? null,
  );

  readonly isDraft = computed(() => this.activeSchedule()?.status === 'DRAFT');

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
    label: new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' }),
    value: i + 1,
  }));

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
    this.loadSwaps();
  }

  async loadAll(): Promise<void> {
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

      // Load schedules for the selected year/month
      await this.schedulesStore.loadSchedules({
        year:  String(this.selectedYear()),
        month: String(this.selectedMonth()),
      });

      const sched = this.activeSchedule();
      if (sched) {
        await this.loadAssignments(sched.id);
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
    this.loading.set(true);
    try {
      const schedule = await this.schedulesStore.createSchedule({
        centerId: this.centerId,
        year:  this.selectedYear(),
        month: this.selectedMonth(),
      });
      await this.loadAssignments(schedule.id);
    } finally {
      this.loading.set(false);
    }
  }

  async publish(scheduleId: string): Promise<void> {
    this.publishing.set(true);
    try {
      const warns = await this.schedulesStore.publishSchedule(scheduleId);
      if (warns.length) this.warnings.set(warns);
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
      employeeId:      event.employeeId,
      employeeName:    empName,
      date:            event.date,
      scheduleId:      sched.id,
      currentTemplate,
    });
    this.selectedTemplateId.set(event.assignment?.shiftTemplateId ?? null);
    this.showAssignDialog = true;
  }

  closeDialog(): void {
    this.showAssignDialog = false;
    this.dialogCtx.set(null);
    this.selectedTemplateId.set(null);
  }

  async confirmAssignment(): Promise<void> {
    const ctx      = this.dialogCtx();
    const tmplId   = this.selectedTemplateId();
    if (!ctx || !tmplId) return;

    this.assigning.set(true);
    try {
      await firstValueFrom(
        this.api.createAssignment({
          scheduleId:      ctx.scheduleId,
          employeeId:      ctx.employeeId,
          shiftTemplateId: tmplId,
          date:            ctx.date,
        }),
      );
      // Reload assignments to reflect the new cell
      await this.loadAssignments(ctx.scheduleId);
      this.closeDialog();
    } finally {
      this.assigning.set(false);
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
    } finally {
      this.downloadingSchedule.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  shiftColor(shiftType: string) {
    return SHIFT_COLORS[shiftType] ?? { bg: 'rgba(100,100,100,0.2)', text: '#aaa', border: 'rgba(100,100,100,0.4)' };
  }
}
