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
    :host { display: block; max-width: 960px; margin: 0 auto; }

    .page-header { margin-bottom: 1.75rem; }
    .page-title  { font-size: 1.375rem; font-weight: 700; color: var(--p-text-color); }
    .page-sub    { font-size: 0.8125rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin-top: 0.125rem; }

    .month-selector {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .month-selector select {
      height: 36px;
      padding: 0 0.75rem;
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 8px;
      color: var(--p-text-color);
      font-size: 0.875rem;
      outline: none;
      appearance: auto;
      cursor: pointer;
    }

    .month-selector select:focus { border-color: var(--p-primary-color); }

    .summary-chips {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }

    .chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.625rem 1.25rem;
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 10px;
      min-width: 90px;
    }

    .chip-value { font-size: 1.5rem; font-weight: 700; color: var(--p-text-color); font-variant-numeric: tabular-nums; }
    .chip-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin-top: 2px; }
    .chip--confirmed .chip-value { color: #15803d; }
    .chip--pending .chip-value   { color: #b45309; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-size: 0.8125rem;
    }
    .empty-state .pi { font-size: 1.75rem; opacity: 0.35; }
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
