import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TimesheetStore } from '../data-access/timesheet.store';
import { ConfirmationBadgeComponent } from '../ui/confirmation-badge.component';


/**
 * TimesheetReviewComponent — employee's monthly timesheet review.
 *
 * - Month / year selector at the top.
 * - Summary: total hours worked, overtime, absences.
 * - ConfirmationBadge for current status.
 * - "Confirm [Month Year] timesheet" button (disabled if already confirmed or loading or OPEN entries exist).
 * - Locked banner when status is confirmed (FR-TSS-015, AC-TSS-012).
 */
@Component({
  selector: 'app-timesheet-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, ButtonModule, SkeletonModule, ToastModule, ConfirmationBadgeComponent, TranslatePipe],
  providers: [MessageService],
  styles: [`
    :host { display: block; max-width: 760px; margin: 0 auto; }

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

    .panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
    }

    .panel-title {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--p-text-color);
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .stat-value {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--p-text-color);
      font-variant-numeric: tabular-nums;
    }

    .status-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .locked-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: color-mix(in srgb, #22c55e 10%, var(--p-surface-card));
      border: 1px solid color-mix(in srgb, #22c55e 35%, transparent);
      border-radius: 10px;
      margin-bottom: 1.25rem;
    }

    .locked-banner .pi {
      font-size: 1.125rem;
      color: #15803d;
      flex-shrink: 0;
    }

    .locked-banner-text {
      font-size: 0.875rem;
      color: var(--p-text-color);
    }

    .locked-banner-text strong { color: #15803d; }

    .open-entries-warning {
      font-size: 0.8125rem;
      color: var(--p-orange-500, #f59e0b);
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.5rem;
    }

    .confirm-actions {
      margin-top: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

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
    <p-toast position="top-right" />

    <!-- ── Page header ─────────────────────────────── -->
    <div class="page-header">
      <div class="page-title">{{ 'TIMESHEET.MY_TIMESHEET' | translate }}</div>
      <div class="page-sub">{{ 'TIMESHEET.SIGN_BANNER' | translate }}</div>
    </div>

    <!-- ── Month selector ─────────────────────────── -->
    <form [formGroup]="form" (ngSubmit)="onMonthChange()" class="month-selector">
      <label for="ts-month" class="visually-hidden">Month</label>
      <select id="ts-month" formControlName="month" (change)="onMonthChange()" aria-label="Select month">
        @for (m of months(); track m.value) {
          <option [value]="m.value">{{ m.label }}</option>
        }
      </select>

      <label for="ts-year" class="visually-hidden">Year</label>
      <select id="ts-year" formControlName="year" (change)="onMonthChange()" aria-label="Select year">
        @for (y of years; track y) {
          <option [value]="y">{{ y }}</option>
        }
      </select>
    </form>

    <!-- ── Locked banner (when confirmed) ─────────── -->
    @if (store.isConfirmed()) {
      <div class="locked-banner" role="status" aria-live="polite">
        <i class="pi pi-lock" aria-hidden="true"></i>
        <span class="locked-banner-text">
          <strong>{{ 'TIMESHEET.STATUS_LOCKED' | translate }}</strong>
          {{ selectedMonthName() }} {{ form.getRawValue().year }} —
          {{ store.summary()?.confirmedAt | date:'d MMM y, HH:mm' }}
        </span>
      </div>
    }

    <!-- ── Summary panel ──────────────────────────── -->
    <div class="panel">
      <div class="panel-title">
        <i class="pi pi-chart-bar" aria-hidden="true"></i>
        Summary — {{ selectedMonthName() }} {{ form.getRawValue().year }}
      </div>

      @if (store.loading()) {
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          @for (_ of [1,2]; track $index) { <p-skeleton height="2rem" borderRadius="6px" /> }
        </div>
      } @else if (!store.summary()) {
        <div class="empty-state">
          <i class="pi pi-calendar-times" aria-hidden="true"></i>
          <span>{{ 'TIMESHEET.EMPTY_STATE' | translate }}</span>
        </div>
      } @else {
        <div class="stats-grid">
          <div class="stat">
            <span class="stat-label">{{ 'TIMESHEET.TOTAL_HOURS' | translate }}</span>
            <span class="stat-value">
              @if (store.summary()?.hours) {
                {{ store.summary()!.hours!.regularHours | number:'1.1-1' }}
              } @else { — }
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">{{ 'TIMESHEET.EXPECTED_HOURS' | translate }}</span>
            <span class="stat-value">
              @if (store.summary()?.hours) {
                {{ store.summary()!.hours!.overtimeHours | number:'1.1-1' }}
              } @else { — }
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">{{ 'TIMESHEET.DAYS_WORKED' | translate }}</span>
            <span class="stat-value">{{ store.summary()?.totalAbsenceDays }}</span>
          </div>
        </div>

        <!-- Status row -->
        <div class="status-row" style="margin-top:1.25rem;">
          <span style="font-size:0.8125rem; color:var(--p-text-color-muted, var(--p-text-color-secondary));">
            {{ 'TIMESHEET.STATUS_OPEN' | translate }}:
          </span>
          <app-confirmation-badge [confirmed]="store.isConfirmed()" />
        </div>

        <!-- Open entries warning -->
        @if (store.summary()?.hasOpenEntry) {
          <div class="open-entries-warning" role="alert">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            {{ 'TIMESHEET.SIGN_BANNER' | translate }}
          </div>
        }

        <!-- Confirm button (hidden when already confirmed) -->
        @if (!store.isConfirmed()) {
          <div class="confirm-actions">
            <p-button
              [label]="('TIMESHEET.SIGN_BUTTON' | translate) + ' ' + selectedMonthName() + ' ' + form.getRawValue().year"
              icon="pi pi-check"
              severity="success"
              [loading]="store.loading()"
              [disabled]="!store.canConfirm() || store.loading()"
              [attr.aria-label]="('TIMESHEET.SIGN_BUTTON' | translate) + ' ' + selectedMonthName() + ' ' + form.getRawValue().year"
              (onClick)="onConfirm()"
            />
            @if (store.summary()?.hasOpenEntry) {
              <span style="font-size:0.8125rem; color:var(--p-text-color-muted);">
                {{ 'TIMESHEET.SIGN_BANNER' | translate }}
              </span>
            }
          </div>
        }
      }
    </div>
  `,
})
export class TimesheetReviewComponent implements OnInit {
  protected readonly store   = inject(TimesheetStore) as unknown as TimesheetStore;
  private  readonly msg      = inject(MessageService);
  private  readonly fb       = inject(FormBuilder);
  private  readonly t        = inject(TranslateService);
  private  readonly lang     = inject(LanguageService);

  protected readonly successMessage = signal<string | null>(null);

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

  ngOnInit(): void {
    void this.store.loadSummary(
      this.form.getRawValue().year,
      this.form.getRawValue().month,
    );
  }

  protected onMonthChange(): void {
    const { year, month } = this.form.getRawValue();
    void this.store.loadSummary(year, month);
  }

  protected async onConfirm(): Promise<void> {
    const { year, month } = this.form.getRawValue();
    try {
      await this.store.confirmMonth(year, month);
      this.msg.add({
        severity: 'success',
        summary: this.t.instant('TIMESHEET.SIGN_SUCCESS_SUMMARY'),
        detail:  this.t.instant('TIMESHEET.SIGN_SUCCESS_DETAIL'),
      });
    } catch {
      this.msg.add({
        severity: 'error',
        summary: this.t.instant('COMMON.ERROR'),
        detail:  this.store.error() ?? this.t.instant('TIMESHEET.SIGN_ERROR'),
      });
    }
  }
}
