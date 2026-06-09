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

    /* ── Page header ─────────────────────────────────────────────── */
    .page-header { margin-bottom: 1.375rem; }
    .page-title {
      font-size: 1.5625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .page-subtitle {
      font-size: 0.8125rem;
      color: var(--text-2);
      margin-top: 0.25rem;
    }

    /* ── Tab navigation ──────────────────────────────────────────── */
    .type-bar {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-soft);
      padding-bottom: 0;
    }

    .type-btn {
      display: flex;
      align-items: center;
      gap: 0.5625rem;
      font-size: 0.84375rem;
      font-weight: 600;
      padding: 0.75rem 1rem;
      color: var(--text-2);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      cursor: pointer;
      transition: var(--transition);
    }

    .type-btn:hover { color: var(--text); }

    .type-btn.active {
      color: var(--text);
      border-bottom-color: var(--primary-hover);
    }

    /* ── Filter panel ────────────────────────────────────────────── */
    .filter-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 1.25rem;
      margin-bottom: 1.25rem;
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
      gap: 0.5rem;
    }

    .filter-field label {
      font-size: 0.65625rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      color: var(--text-3);
      text-transform: uppercase;
    }

    .filter-field input {
      appearance: none;
      height: 2.75rem;
      padding: 0 0.875rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.8125rem;
      font-weight: 600;
      width: 8rem;
      outline: none;
      transition: var(--transition);
    }

    .filter-field input:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    .action-row {
      display: flex;
      gap: 0.625rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }

    /* ── Results panel ───────────────────────────────────────────── */
    .results-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 35rem;
    }

    th {
      background: var(--surface-2);
      padding: 0.75rem 1.125rem;
      text-align: left;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-3);
      border-bottom: 1px solid var(--border-soft);
    }

    td {
      padding: 0.75rem 1.125rem;
      font-size: 0.8125rem;
      color: var(--text);
      border-bottom: 1px solid var(--border-soft);
      vertical-align: middle;
    }

    tr:last-child td { border-bottom: none; }

    tbody tr:hover td { background: var(--primary-soft); }

    tfoot td {
      padding: 0.875rem 1.125rem;
      font-weight: 700;
      font-size: 0.8125rem;
      border-top: 2px solid var(--border);
    }

    /* overflow wrapper for wide tables */
    .tbl-wrap { overflow-x: auto; }

    /* ── Dark mode overrides ─────────────────────────────────────── */
    :host-context([data-theme="dark"]) .type-btn.active {
      color: var(--text);
      border-bottom-color: var(--primary-hover);
    }

    :host-context([data-theme="dark"]) .filter-panel {
      box-shadow: var(--shadow);
    }

    :host-context([data-theme="dark"]) .filter-field input {
      background: var(--bg);
      border-color: var(--border);
      color: var(--text);
    }

    :host-context([data-theme="dark"]) .filter-field input:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    :host-context([data-theme="dark"]) .results-panel {
      box-shadow: var(--shadow);
    }

    :host-context([data-theme="dark"]) th {
      background: var(--surface-2);
      border-bottom-color: var(--border-soft);
    }

    :host-context([data-theme="dark"]) td {
      border-bottom-color: var(--border-soft);
    }

    :host-context([data-theme="dark"]) tbody tr:hover td {
      background: var(--primary-soft);
    }
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
