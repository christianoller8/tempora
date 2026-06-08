import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import type { EmployeeDto } from '../data-access/employees.api';
import type { EmployeeCategory } from '@tempora/shared';

type TagSeverity = 'success' | 'info' | 'warn' | 'secondary' | 'contrast' | 'danger';

const CATEGORY_SEVERITY: Partial<Record<EmployeeCategory, TagSeverity>> = {
  MEDICO:            'success',
  ENFERMERO:         'info',
  TCAE:              'warn',
  FISIOTERAPEUTA:    'secondary',
  CELADOR:           'contrast',
  ADMINISTRATIVO:    'contrast',
};

const SKELETON_ROWS: unknown[] = [1, 2, 3, 4, 5];

@Component({
  selector: 'app-employee-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TableModule, TagModule, SkeletonModule, ButtonModule, TranslatePipe],
  styles: [`
    :host { display: block; overflow-x: auto; }

    .table-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      gap: 0.75rem;
    }

    .table-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--p-text-color);
    }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
      color: var(--p-primary-color);
      border-radius: 11px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-size: 0.875rem;
    }

    .empty-state .pi { font-size: 2rem; opacity: 0.35; }

    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr {
      cursor: pointer;
      transition: background 0.15s;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
      background: color-mix(in srgb, var(--p-primary-color) 5%, transparent);
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr.row-inactive {
      opacity: 0.45;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr.row-inactive:hover {
      opacity: 0.65;
    }
  `],
  template: `
    <p-table
      [value]="loading() ? skeletonRows : employees()"
      [tableStyle]="{ 'min-width': '860px' }"
      aria-label="Employees"
      styleClass="p-datatable-sm"
    >
      <ng-template pTemplate="caption">
        <div class="table-header">
          <div class="table-title">
            <i class="pi pi-users" style="color: var(--p-primary-color); font-size:0.9rem;"></i>
            {{ 'EMPLOYEES.TITLE' | translate }}
            <span class="count-badge">{{ employees().length }}</span>
          </div>
          <p-button
            [label]="'EMPLOYEES.ADD_EMPLOYEE' | translate"
            icon="pi pi-plus"
            size="small"
            (onClick)="addClick.emit()"
            [attr.aria-label]="'EMPLOYEES.ADD_EMPLOYEE' | translate"
          />
        </div>
      </ng-template>

      <ng-template pTemplate="header">
        <tr>
          <th>{{ 'EMPLOYEES.TABLE_NAME' | translate }}</th>
          <th>{{ 'EMPLOYEES.TABLE_NIF' | translate }}</th>
          <th>{{ 'EMPLOYEES.TABLE_CATEGORY' | translate }}</th>
          <th>{{ 'EMPLOYEES.TABLE_CONTRACT' | translate }}</th>
          <th>{{ 'EMPLOYEES.TABLE_HOURS_WEEK' | translate }}</th>
          <th>{{ 'EMPLOYEES.TABLE_HIRE_DATE' | translate }}</th>
          <th>{{ 'EMPLOYEES.TABLE_STATUS' | translate }}</th>
          <th>{{ 'COMMON.ACTIONS' | translate }}</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-row>
        @if (loading()) {
          <tr>
            <td><p-skeleton height="1.25rem" /></td>
            <td><p-skeleton height="1.25rem" width="80px" /></td>
            <td><p-skeleton height="1.25rem" width="90px" /></td>
            <td><p-skeleton height="1.25rem" width="100px" /></td>
            <td><p-skeleton height="1.25rem" width="60px" /></td>
            <td><p-skeleton height="1.25rem" width="90px" /></td>
            <td><p-skeleton height="1.25rem" width="70px" /></td>
            <td><p-skeleton height="1.25rem" width="50px" /></td>
          </tr>
        } @else {
          <tr (click)="employeeSelect.emit(row)" [class.row-inactive]="!row.isActive">
            <td>{{ row.firstName }} {{ row.lastName }}</td>
            <td>{{ row.nif ?? '—' }}</td>
            <td>
              <p-tag
                [value]="row.category"
                [severity]="categorySeverity(row.category)"
                [rounded]="true"
                [style]="{ fontSize: '0.7rem' }"
              />
            </td>
            <td>{{ row.contractType }}</td>
            <td>
              @if (row.contractType === 'TIEMPO_PARCIAL') {
                {{ row.contractedHoursPerWeek }}h
              } @else {
                —
              }
            </td>
            <td>{{ row.hireDate | date:'d MMM y' }}</td>
            <td>
              <p-tag
                [value]="row.isActive ? ('STATUS.ACTIVE' | translate) : ('STATUS.INACTIVE' | translate)"
                [severity]="row.isActive ? 'success' : 'secondary'"
                [rounded]="true"
                [style]="{ fontSize: '0.7rem' }"
              />
            </td>
            <td (click)="$event.stopPropagation()">
              <p-button
                icon="pi pi-pencil"
                size="small"
                [text]="true"
                severity="secondary"
                [attr.aria-label]="'COMMON.EDIT' | translate"
                (onClick)="edit.emit(row)"
              />
            </td>
          </tr>
        }
      </ng-template>

      <ng-template pTemplate="emptymessage">
        @if (!loading()) {
          <tr>
            <td colspan="8">
              <div class="empty-state">
                <i class="pi pi-users"></i>
                <span>{{ 'EMPLOYEES.EMPTY_STATE' | translate }}</span>
              </div>
            </td>
          </tr>
        }
      </ng-template>
    </p-table>
  `,
})
export class EmployeeTableComponent {
  readonly employees = input<EmployeeDto[]>([]);
  readonly loading = input<boolean>(false);

  readonly employeeSelect = output<EmployeeDto>();
  readonly edit = output<EmployeeDto>();
  readonly addClick = output<void>();

  readonly skeletonRows = SKELETON_ROWS;

  categorySeverity(category: EmployeeCategory): TagSeverity {
    return CATEGORY_SEVERITY[category] ?? 'secondary';
  }
}
