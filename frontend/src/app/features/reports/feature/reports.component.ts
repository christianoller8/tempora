import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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
  imports: [ReactiveFormsModule],
  template: `
    <section aria-label="Reports">
      <h1>Reports</h1>

      <!-- Report type selector -->
      <div role="group" aria-label="Report type">
        @for (type of reportTypes; track type.value) {
          <button
            type="button"
            [class]="selectedType() === type.value ? 'active' : ''"
            (click)="selectType(type.value)"
          >
            {{ type.label }}
          </button>
        }
      </div>

      <!-- Filter form -->
      <form [formGroup]="filterForm" (ngSubmit)="runReport('json')" aria-label="Report filters">
        <label for="year">Year</label>
        <input id="year" type="number" formControlName="year" min="2020" max="2099" />

        @if (showMonth()) {
          <label for="month">Month</label>
          <input id="month" type="number" formControlName="month" min="1" max="12" />
        }

        <label for="centerId">Center ID (optional)</label>
        <input id="centerId" type="text" formControlName="centerId" />

        @if (showEmployeeId()) {
          <label for="employeeId">Employee ID (optional)</label>
          <input id="employeeId" type="text" formControlName="employeeId" />
        }

        <button type="submit" [disabled]="loading()">Run Report</button>
        <button type="button" (click)="runReport('xlsx')" [disabled]="loading()">Export XLSX</button>
        <button type="button" (click)="runReport('pdf')" [disabled]="loading()">Export PDF</button>
      </form>

      <!-- Error message -->
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }

      <!-- Results table -->
      @if (rows().length > 0) {
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
      }
    </section>
  `,
})
export class ReportsComponent {
  private readonly api = inject(ReportsApi);
  private readonly fb = inject(FormBuilder);

  readonly reportTypes: { value: ReportType; label: string }[] = [
    { value: 'monthly-hours', label: 'Monthly Hours' },
    { value: 'overtime', label: 'Overtime' },
    { value: 'absenteeism', label: 'Absenteeism' },
    { value: 'coverage', label: 'Coverage Gaps' },
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
      const message = err instanceof Error ? err.message : 'Failed to generate report';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
