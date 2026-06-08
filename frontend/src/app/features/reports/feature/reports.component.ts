import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ReportsApi } from '../data-access/reports.api';
import type { ReportRow, ReportFormat } from '../data-access/reports.api';

type ReportType = 'monthly-hours' | 'overtime' | 'absenteeism' | 'coverage';

/**
 * ReportsComponent — smart container for report generation.
 *
 * - Filter form: year, month, centerId (optional), employeeId (optional)
 * - Report type selector: monthly-hours | overtime | absenteeism | coverage
 * - Results table showing rows when format=json
 * - Export buttons (PDF, XLSX) that trigger download
 * - ADMIN/MANAGER access only (enforced by roleGuard in routes)
 *
 * Satisfies FR-REP-1..7; acceptance: AC-REP-1..7.
 */
@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, TranslatePipe],
  styles: [`
    :host { display: block; }

    .page-header { margin-bottom: 1.75rem; }
    .page-title  { font-size: 1.375rem; font-weight: 700; color: var(--p-text-color); }

    .type-bar {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    .type-btn {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--p-surface-border);
      background: var(--p-surface-card);
      color: var(--p-text-color-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .type-btn:hover { background: var(--p-surface-hover); color: var(--p-text-color); }

    .type-btn.active {
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
      border-color: var(--p-primary-color);
      color: var(--p-primary-color);
      font-weight: 600;
    }

    .filter-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }

    .filter-row {
      display: flex;
      align-items: flex-end;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .filter-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .filter-field label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .filter-field input {
      height: 38px;
      padding: 0 0.75rem;
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 8px;
      color: var(--p-text-color);
      font-size: 0.875rem;
      width: 120px;
      outline: none;
    }

    .filter-field input:focus { border-color: var(--p-primary-color); }

    .action-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }

    .results-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: var(--p-surface-section);
      padding: 0.5rem 1rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--p-text-color-secondary);
      border-bottom: 1px solid var(--p-surface-border);
    }

    td {
      padding: 0.625rem 1rem;
      font-size: 0.875rem;
      color: var(--p-text-color);
      border-bottom: 1px solid var(--p-surface-border);
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: color-mix(in srgb, var(--p-primary-color) 4%, transparent); }
  `],
  template: `
    <section aria-label="Reports">
      <div class="page-header">
        <div class="page-title">{{ 'REPORTS.TITLE' | translate }}</div>
      </div>

      <!-- Report type selector -->
      <div class="type-bar" role="group" [attr.aria-label]="'REPORTS.TITLE' | translate">
        @for (type of reportTypes; track type.value) {
          <button
            type="button"
            class="type-btn"
            [class.active]="selectedType() === type.value"
            (click)="selectType(type.value)"
          >
            {{ type.labelKey | translate }}
          </button>
        }
      </div>

      <!-- Filter form -->
      <div class="filter-panel">
        <form [formGroup]="filterForm" (ngSubmit)="runReport('json')" aria-label="Report filters">
          <div class="filter-row">
            <div class="filter-field">
              <label for="year">{{ 'COMMON.YEAR' | translate }}</label>
              <input pInputText id="year" type="number" formControlName="year" min="2020" max="2099" />
            </div>

            @if (showMonth()) {
              <div class="filter-field">
                <label for="month">{{ 'COMMON.MONTH' | translate }}</label>
                <input pInputText id="month" type="number" formControlName="month" min="1" max="12" />
              </div>
            }

            <div class="filter-field">
              <label for="centerId">{{ 'REPORTS.DATE_RANGE' | translate }}</label>
              <input pInputText id="centerId" type="text" formControlName="centerId" />
            </div>

            @if (showEmployeeId()) {
              <div class="filter-field">
                <label for="employeeId">{{ 'REPORTS.SELECT_EMPLOYEE' | translate }}</label>
                <input pInputText id="employeeId" type="text" formControlName="employeeId" />
              </div>
            }
          </div>

          <div class="action-row">
            <p-button
              type="submit"
              [label]="'REPORTS.GENERATE' | translate"
              icon="pi pi-play"
              [loading]="loading()"
            />
            <p-button
              type="button"
              [label]="'REPORTS.EXPORT_EXCEL' | translate"
              icon="pi pi-file-excel"
              severity="secondary"
              [loading]="loading()"
              (onClick)="runReport('xlsx')"
            />
            <p-button
              type="button"
              [label]="'REPORTS.EXPORT_PDF' | translate"
              icon="pi pi-file-pdf"
              severity="secondary"
              [loading]="loading()"
              (onClick)="runReport('pdf')"
            />
          </div>
        </form>
      </div>

      <!-- Error message -->
      @if (error()) {
        <p-message severity="error" [text]="error()!" styleClass="w-full" [style]="{ marginBottom: '1rem' }" />
      }

      <!-- Results table -->
      @if (rows().length > 0) {
        <div class="results-panel">
          <table aria-label="Report results">
            <thead>
              <tr>
                @for (col of columns(); track col) {
                  <th>{{ col }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track $index) {
                <tr>
                  @for (col of columns(); track col) {
                    <td>{{ row[col] }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class ReportsComponent {
  private readonly api       = inject(ReportsApi);
  private readonly fb        = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly reportTypes: { value: ReportType; labelKey: string }[] = [
    { value: 'monthly-hours', labelKey: 'REPORTS.SECTION_TIMESHEET' },
    { value: 'overtime',      labelKey: 'REPORTS.SECTION_COMPLIANCE' },
    { value: 'absenteeism',   labelKey: 'REPORTS.SECTION_ABSENCES' },
    { value: 'coverage',      labelKey: 'REPORTS.SECTION_COMPLIANCE' },
  ];

  readonly selectedType = signal<ReportType>('monthly-hours');
  readonly rows = signal<ReportRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly filterForm: FormGroup = this.fb.group({
    year: [new Date().getFullYear()],
    month: [new Date().getMonth() + 1],
    centerId: [''],
    employeeId: [''],
  });

  readonly showMonth = computed(() =>
    this.selectedType() === 'monthly-hours' || this.selectedType() === 'coverage',
  );

  readonly showEmployeeId = computed(() => this.selectedType() === 'overtime');

  readonly columns = computed(() => {
    const r = this.rows();
    if (r.length === 0) return [];
    return Object.keys(r[0]);
  });

  selectType(type: ReportType): void {
    this.selectedType.set(type);
    this.rows.set([]);
    this.error.set(null);
  }

  async runReport(format: ReportFormat): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const v = this.filterForm.value as {
      year: number;
      month: number;
      centerId: string;
      employeeId: string;
    };

    const centerId = v.centerId || undefined;
    const employeeId = v.employeeId || undefined;
    const formatParam = format === 'json' ? undefined : format;

    try {
      const type = this.selectedType();
      let obs;

      if (type === 'monthly-hours') {
        obs = this.api.getMonthlyHours(v.year, v.month, centerId, formatParam);
      } else if (type === 'overtime') {
        obs = this.api.getOvertime(v.year, employeeId, formatParam);
      } else if (type === 'absenteeism') {
        const year = v.year;
        obs = this.api.getAbsenteeism(
          `${year}-01-01`,
          `${year}-12-31`,
          centerId,
          formatParam,
        );
      } else {
        obs = this.api.getCoverage(centerId ?? '', v.year, v.month, formatParam);
      }

      const result = await firstValueFrom(obs);

      if (result instanceof Blob) {
        const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
        this.api.downloadReport(result, `${type}-${v.year}.${ext}`);
      } else {
        this.rows.set(result);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : this.translate.instant('REPORTS.NO_DATA');
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
