import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ReportsApi } from '../data-access/reports.api';
import { EmployeesApi } from '../../employees/data-access/employees.api';
import type { EmployeeDto } from '../../employees/data-access/employees.api';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-export-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogModule, ButtonModule, SelectModule, DatePickerModule, TranslatePipe],
  styles: [`
    .export-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .form-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .date-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .error-msg {
      font-size: 0.8125rem;
      color: var(--p-red-400, #f87171);
    }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 0.5rem;
    }
  `],
  template: `
    <p-dialog
      [visible]="visible()"
      (onHide)="closed.emit()"
      [modal]="true"
      [style]="{ width: '480px' }"
      [closable]="true"
      [header]="'REPORTS.EXPORT_TITLE' | translate"
    >
      <div class="export-form">
        <div class="date-row">
          <div class="form-field">
            <label class="form-label" for="exp-from">{{ 'COMMON.DATE_FROM' | translate }}</label>
            <p-datepicker
              inputId="exp-from"
              [ngModel]="fromDate()"
              (ngModelChange)="fromDate.set($event)"
              dateFormat="yy-mm-dd"
              [showIcon]="true"
              [fluid]="true"
            />
          </div>
          <div class="form-field">
            <label class="form-label" for="exp-to">{{ 'COMMON.DATE_TO' | translate }}</label>
            <p-datepicker
              inputId="exp-to"
              [ngModel]="toDate()"
              (ngModelChange)="toDate.set($event)"
              dateFormat="yy-mm-dd"
              [showIcon]="true"
              [fluid]="true"
            />
          </div>
        </div>

        @if (isAdminOrManager()) {
          <div class="form-field">
            <label class="form-label" for="exp-employee">{{ 'REPORTS.SELECT_EMPLOYEE' | translate }}</label>
            <p-select
              inputId="exp-employee"
              [options]="employeeOptions()"
              [ngModel]="selectedEmployeeId()"
              (ngModelChange)="selectedEmployeeId.set($event)"
              optionLabel="label"
              optionValue="value"
              [placeholder]="'REPORTS.ALL_EMPLOYEES' | translate"
              [fluid]="true"
            />
          </div>
        }

        <div class="form-field">
          <label class="form-label" for="exp-format">{{ 'REPORTS.EXPORT_FORMAT' | translate }}</label>
          <p-select
            inputId="exp-format"
            [options]="formatOptions"
            [ngModel]="format()"
            (ngModelChange)="format.set($event)"
            optionLabel="label"
            optionValue="value"
            [fluid]="true"
          />
        </div>

        @if (errorMsg()) {
          <span class="error-msg">{{ errorMsg() }}</span>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <p-button
            [label]="'COMMON.CANCEL' | translate"
            severity="secondary"
            [text]="true"
            (onClick)="closed.emit()"
          />
          <p-button
            [label]="'COMMON.DOWNLOAD' | translate"
            icon="pi pi-download"
            [loading]="downloading()"
            (onClick)="onDownload()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ExportDialogComponent {
  readonly visible = input<boolean>(false);
  readonly closed = output<void>();

  private readonly reportsApi   = inject(ReportsApi);
  private readonly employeesApi = inject(EmployeesApi);
  private readonly auth         = inject(AuthStore) as unknown as AuthStore;
  private readonly translate    = inject(TranslateService);

  readonly fromDate = signal<Date | null>(firstOfCurrentMonth());
  readonly toDate = signal<Date | null>(new Date());
  readonly selectedEmployeeId = signal<string | undefined>(undefined);
  readonly format = signal<'pdf' | 'excel'>('pdf');
  readonly downloading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly employees = signal<EmployeeDto[]>([]);

  private employeesLoaded = false;

  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  readonly employeeOptions = computed(() => [
    { label: this.translate.instant('REPORTS.ALL_EMPLOYEES'), value: undefined as string | undefined },
    ...this.employees().map(e => ({
      label: `${e.lastName}, ${e.firstName}`,
      value: e.id as string | undefined,
    })),
  ]);

  readonly formatOptions = [
    { label: 'PDF', value: 'pdf' as const },
    { label: 'Excel', value: 'excel' as const },
  ];

  constructor() {
    effect(() => {
      if (this.visible() && !this.employeesLoaded && this.isAdminOrManager()) {
        this.employeesLoaded = true;
        firstValueFrom(this.employeesApi.list({ activeOnly: true })).then(list => {
          this.employees.set(list);
        }).catch(() => {
          // non-critical: employee list fails silently
        });
      }
    });
  }

  async onDownload(): Promise<void> {
    const from = this.fromDate();
    const to = this.toDate();

    if (!from || !to) {
      this.errorMsg.set(this.translate.instant('COMMON.REQUIRED'));
      return;
    }

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    if (fromStr > toStr) {
      this.errorMsg.set(this.translate.instant('COMMON.REQUIRED'));
      return;
    }

    this.downloading.set(true);
    this.errorMsg.set(null);

    try {
      await firstValueFrom(
        this.reportsApi.downloadTimeEntries({
          from: fromStr,
          to: toStr,
          employeeId: this.selectedEmployeeId(),
          format: this.format(),
        }),
      );
      this.downloading.set(false);
      this.closed.emit();
    } catch (err: unknown) {
      this.downloading.set(false);
      this.errorMsg.set(err instanceof Error ? err.message : this.translate.instant('COMMON.ERROR'));
    }
  }
}

function firstOfCurrentMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
