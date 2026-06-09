import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TimesheetStore } from '../data-access/timesheet.store';
import { ConfirmationBadgeComponent } from '../ui/confirmation-badge.component';
import type { ConfirmationStatusRowDto } from '../data-access/timesheet.api';


/**
 * TimesheetStatusComponent — manager/admin confirmation-status overview.
 *
 * - Month / year selector.
 * - PrimeNG p-table listing all employees with their confirmation status.
 * - Columns: Employee name, Confirmed (badge), ConfirmedAt (date or "—").
 * - Role guard: route-level guard ensures only ADMIN/MANAGER can reach this component.
 */
@Component({
  selector: 'app-timesheet-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, ButtonModule, SkeletonModule, TableModule, ConfirmationBadgeComponent, TranslatePipe],
  styles: [`
    :host {
      display: block;
      padding: 28px 30px 48px;
      max-width: 1340px;
      margin: 0 auto;
    }

    /* ── Page header ──────────────────────────────────────────────── */
    .page-header { margin-bottom: 1.5rem; }

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
    }

    /* ── Month / period selector ──────────────────────────────────── */
    .month-selector {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }

    .month-selector select {
      appearance: none;
      height: 38px;
      padding: 0 2.25rem 0 0.875rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.8125rem;
      font-weight: 600;
      outline: none;
      cursor: pointer;
      transition: var(--transition);
    }

    .month-selector select:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    /* ── Summary chips (KPI strip) ────────────────────────────────── */
    .summary-chips {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .chip {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 1.125rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      transition: var(--transition);
    }

    .chip-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex: none;
      font-size: 1.25rem;
    }

    .chip-icon--ok      { background: var(--ok-soft);      color: var(--ok); }
    .chip-icon--warn    { background: var(--warn-soft);     color: var(--warn); }
    .chip-icon--violet  { background: var(--primary-soft);  color: var(--accent-ico); }

    .chip-body { display: flex; flex-direction: column; }

    .chip-value {
      font-size: 1.625rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .chip-label {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-2);
      margin-top: 0.3125rem;
    }

    .chip--confirmed .chip-value { color: var(--ok); }
    .chip--pending   .chip-value { color: var(--warn); }

    /* ── Status table ─────────────────────────────────────────────── */
    .tbl-card {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    /* PrimeNG p-table header cells */
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-soft);
      padding: 0.8125rem 1.25rem;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      font-size: 0.8125rem;
      color: var(--text);
      border-bottom: 1px solid var(--border-soft);
      padding: 0.8125rem 1.25rem;
      vertical-align: middle;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:last-child > td {
      border-bottom: none;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover > td {
      background: var(--surface-2);
    }

    :host ::ng-deep .p-datatable .p-sortable-column:focus {
      outline: 2px solid var(--primary-hover);
      outline-offset: -2px;
    }

    /* ── Empty state ──────────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--text-3);
      font-size: 0.8125rem;
    }

    .empty-state .pi { font-size: 1.75rem; opacity: 0.4; }

    /* ── Dark mode overrides ──────────────────────────────────────── */
    :host-context([data-theme="dark"]) .month-selector select {
      background: var(--surface);
      border-color: var(--border);
      color: var(--text);
    }

    :host-context([data-theme="dark"]) .month-selector select:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    :host-context([data-theme="dark"]) :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover > td {
      background: var(--p-surface-hover);
    }
  `],
  template: `
    <!-- ── Page header ─────────────────────────────── -->
    <div class="page-header">
      <div class="page-title">{{ 'TIMESHEET.STATUS_TITLE' | translate }}</div>
      <div class="page-sub">{{ 'TIMESHEET.PERIOD' | translate }}</div>
    </div>

    <!-- ── Month selector ─────────────────────────── -->
    <form [formGroup]="form" class="month-selector">
      <label for="ts-status-month" class="visually-hidden">Month</label>
      <select id="ts-status-month" formControlName="month" (change)="onMonthChange()" aria-label="Select month">
        @for (m of months(); track m.value) {
          <option [value]="m.value">{{ m.label }}</option>
        }
      </select>

      <label for="ts-status-year" class="visually-hidden">Year</label>
      <select id="ts-status-year" formControlName="year" (change)="onMonthChange()" aria-label="Select year">
        @for (y of years; track y) {
          <option [value]="y">{{ y }}</option>
        }
      </select>

      <p-button
        [label]="'COMMON.REFRESH' | translate"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        [loading]="store.loading()"
        (onClick)="onMonthChange()"
      />
    </form>

    <!-- ── Summary chips ──────────────────────────── -->
    @if (store.statusList().length > 0) {
      <div class="summary-chips">
        <div class="chip">
          <span class="chip-value">{{ store.statusList().length }}</span>
          <span class="chip-label">{{ 'COMMON.ALL' | translate }}</span>
        </div>
        <div class="chip chip--confirmed">
          <span class="chip-value">{{ confirmedCount() }}</span>
          <span class="chip-label">{{ 'TIMESHEET.CONFIRMATION_SIGNED' | translate }}</span>
        </div>
        <div class="chip chip--pending">
          <span class="chip-value">{{ pendingCount() }}</span>
          <span class="chip-label">{{ 'TIMESHEET.CONFIRMATION_PENDING' | translate }}</span>
        </div>
      </div>
    }

    <!-- ── Status table ───────────────────────────── -->
    @if (store.loading() && store.statusList().length === 0) {
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        @for (_ of [1,2,3,4]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
      </div>
    } @else if (store.statusList().length === 0) {
      <div class="empty-state">
        <i class="pi pi-users" aria-hidden="true"></i>
        <span>{{ 'TIMESHEET.EMPTY_STATE' | translate }}</span>
      </div>
    } @else {
      <p-table
        [value]="store.statusList()"
        [rows]="50"
        [paginator]="store.statusList().length > 50"
        sortField="lastName"
        [sortOrder]="1"
        [tableStyle]="{ 'min-width': '36rem' }"
        styleClass="p-datatable-sm"
        aria-label="Employee timesheet confirmation status"
      >
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="lastName" scope="col" style="width:40%">
              {{ 'TIMESHEET.TABLE_EMPLOYEE' | translate }} <p-sortIcon field="lastName" />
            </th>
            <th scope="col" style="width:25%">{{ 'TIMESHEET.TABLE_STATUS' | translate }}</th>
            <th pSortableColumn="confirmedAt" scope="col" style="width:35%">
              {{ 'TIMESHEET.TABLE_SIGNED' | translate }} <p-sortIcon field="confirmedAt" />
            </th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td>{{ row.firstName }} {{ row.lastName }}</td>
            <td><app-confirmation-badge [confirmed]="row.confirmed" /></td>
            <td>{{ row.confirmedAt ? (row.confirmedAt | date:'d MMM y, HH:mm') : '—' }}</td>
          </tr>
        </ng-template>
      </p-table>
    }
  `,
})
export class TimesheetStatusComponent implements OnInit {
  protected readonly store = inject(TimesheetStore) as unknown as TimesheetStore;
  private  readonly fb   = inject(FormBuilder);
  private  readonly lang = inject(LanguageService);

  readonly today = new Date();

  readonly months = computed(() => {
    const locale = this.lang.dateLocale();
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1)),
    }));
  });
  readonly years = Array.from({ length: 5 }, (_, i) => this.today.getFullYear() - i);

  protected readonly form = this.fb.nonNullable.group({
    month: [this.today.getMonth() + 1],
    year:  [this.today.getFullYear()],
  });

  protected selectedMonthName(): string {
    return this.months()[(this.form.getRawValue().month as number) - 1]?.label ?? '';
  }

  protected confirmedCount(): number {
    return this.store.statusList().filter((r: ConfirmationStatusRowDto) => r.confirmed).length;
  }

  protected pendingCount(): number {
    return this.store.statusList().filter((r: ConfirmationStatusRowDto) => !r.confirmed).length;
  }

  ngOnInit(): void {
    void this.store.loadStatus(
      this.form.getRawValue().year,
      this.form.getRawValue().month,
    );
  }

  protected onMonthChange(): void {
    const { year, month } = this.form.getRawValue();
    void this.store.loadStatus(year, month);
  }
}
