import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import type { EmployeeDto } from '../data-access/employees.api';
import type { EmployeeCategory } from '@tempora/shared';

interface CategoryStyle { color: string; bg: string; label: string; }
interface ContractStyle { color: string; label: string; }
interface AvatarStyle   { background: string; color: string; }

const AVATAR_PALETTE: AvatarStyle[] = [
  { background: 'var(--cat-enf-bg)', color: 'var(--cat-enf)' },
  { background: 'var(--cat-tca-bg)', color: 'var(--cat-tca)' },
  { background: 'var(--cat-med-bg)', color: 'var(--cat-med)' },
  { background: 'var(--cat-fis-bg)', color: 'var(--cat-fis)' },
  { background: 'var(--cat-cel-bg)', color: 'var(--cat-cel)' },
  { background: 'var(--cat-adm-bg)', color: 'var(--cat-adm)' },
  { background: 'var(--ok-soft)',    color: 'var(--ok)'      },
  { background: 'var(--warn-soft)',  color: 'var(--warn)'    },
];

const CATEGORY_MAP: Partial<Record<EmployeeCategory, CategoryStyle>> = {
  MEDICO:         { color: 'var(--cat-med)', bg: 'var(--cat-med-bg)', label: 'MÉDICO'        },
  ENFERMERO:      { color: 'var(--cat-enf)', bg: 'var(--cat-enf-bg)', label: 'ENFERMERO/A'   },
  TCAE:           { color: 'var(--cat-tca)', bg: 'var(--cat-tca-bg)', label: 'TCAE'          },
  FISIOTERAPEUTA: { color: 'var(--cat-fis)', bg: 'var(--cat-fis-bg)', label: 'FISIOTERAPEUTA'},
  CELADOR:        { color: 'var(--cat-cel)', bg: 'var(--cat-cel-bg)', label: 'CELADOR'       },
  ADMINISTRATIVO: { color: 'var(--cat-adm)', bg: 'var(--cat-adm-bg)', label: 'ADMINISTRATIVO'},
};

const CONTRACT_MAP: Record<string, ContractStyle> = {
  INDEFINIDO:     { color: 'var(--ok)',      label: 'INDEFINIDO'    },
  TEMPORAL:       { color: 'var(--warn)',    label: 'TEMPORAL'      },
  TIEMPO_PARCIAL: { color: 'var(--primary)', label: 'TIEMPO PARCIAL'},
};

const SKELETON_ROWS: unknown[] = [1, 2, 3, 4, 5];

@Component({
  selector: 'app-employee-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TableModule, SkeletonModule, TranslatePipe],
  styles: [`
    :host { display: block; overflow-x: auto; }

    /* ── Table caption ───────────────────────────────────────── */
    .table-header {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 18px 20px 14px;
    }

    .table-title {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--text);
    }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      background: var(--primary-soft);
      color: var(--primary);
      border-radius: 11px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    /* ── Employee avatar ─────────────────────────────────────── */
    .emp-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }

    /* ── Name cell ───────────────────────────────────────────── */
    .emp-name-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .emp-name { font-size: 0.875rem; font-weight: 600; color: var(--text); }

    /* ── Category chip ───────────────────────────────────────── */
    .cat-chip {
      display: inline-flex;
      align-items: center;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      white-space: nowrap;
    }

    /* ── Contract type ───────────────────────────────────────── */
    .contract-text { font-size: 0.84375rem; font-weight: 700; letter-spacing: 0.01em; }

    /* ── Status badge ────────────────────────────────────────── */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-2);
    }

    .status-badge.active { color: var(--ok); }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-3);
      flex-shrink: 0;
    }

    .status-dot--active { background: var(--ok); box-shadow: 0 0 0 3px var(--ok-soft); }

    /* ── Action buttons ──────────────────────────────────────── */
    .action-btns { display: flex; gap: 4px; }

    .action-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--text-3);
      cursor: pointer;
      border-radius: 8px;
      font-size: 0.875rem;
      transition: color var(--transition), background var(--transition);
      font-family: inherit;
    }

    .action-btn:hover { color: var(--primary); background: var(--primary-soft); }

    /* ── Empty state ─────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--text-3);
      font-size: 0.875rem;
    }

    .empty-state .pi { font-size: 2rem; opacity: 0.35; }

    /* ── PrimeNG table overrides ─────────────────────────────── */
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-3);
      padding: 10px 16px;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      padding: 12px 16px;
      vertical-align: middle;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr {
      cursor: pointer;
      transition: background var(--transition);
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
      background: var(--primary-soft) !important;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr.row-inactive { opacity: 0.45; }
  `],
  template: `
    <p-table
      [value]="loading() ? skeletonRows : employees()"
      [tableStyle]="{ 'min-width': '860px' }"
      aria-label="Empleados"
      styleClass="p-datatable-sm"
    >
      <ng-template pTemplate="caption">
        <div class="table-header">
          <i class="pi pi-users" style="color: var(--primary); font-size: 0.9rem;" aria-hidden="true"></i>
          <div class="table-title">
            Plantilla
            <span class="count-badge">{{ employees().length }}</span>
          </div>
        </div>
      </ng-template>

      <ng-template pTemplate="header">
        <tr>
          <th>NOMBRE</th>
          <th>NIF</th>
          <th>CATEGORÍA</th>
          <th>TIPO CONTRATO</th>
          <th>HORAS/SEM.</th>
          <th>ALTA</th>
          <th>ESTADO</th>
          <th>ACCIONES</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-row>
        @if (loading()) {
          <tr>
            <td>
              <div class="emp-name-cell">
                <p-skeleton width="36px" height="36px" borderRadius="10px" />
                <p-skeleton height="1rem" width="120px" />
              </div>
            </td>
            <td><p-skeleton height="1rem" width="80px" /></td>
            <td><p-skeleton height="1.5rem" width="90px" borderRadius="20px" /></td>
            <td><p-skeleton height="1rem" width="90px" /></td>
            <td><p-skeleton height="1rem" width="40px" /></td>
            <td><p-skeleton height="1rem" width="80px" /></td>
            <td><p-skeleton height="1rem" width="60px" /></td>
            <td><p-skeleton height="1rem" width="50px" /></td>
          </tr>
        } @else {
          <tr (click)="employeeSelect.emit(row)" [class.row-inactive]="!row.isActive">

            <td>
              <div class="emp-name-cell">
                <div class="emp-avatar" [style]="avatarStyle(row.firstName, row.lastName)">
                  {{ initials(row.firstName, row.lastName) }}
                </div>
                <span class="emp-name">{{ row.firstName }} {{ row.lastName }}</span>
              </div>
            </td>

            <td style="color: var(--text-2); font-variant-numeric: tabular-nums;">
              {{ row.nif ?? '—' }}
            </td>

            <td>
              <span class="cat-chip" [style]="chipStyle(row.category)">
                {{ chipLabel(row.category) }}
              </span>
            </td>

            <td>
              <span class="contract-text" [style.color]="contractColor(row.contractType)">
                {{ contractLabel(row.contractType) }}
              </span>
            </td>

            <td style="color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums;">
              {{ row.contractedHoursPerWeek ? row.contractedHoursPerWeek + 'h' : '—' }}
            </td>

            <td style="color: var(--text-2);">
              {{ row.hireDate | date:'d MMM y':undefined:'es' }}
            </td>

            <td>
              <span class="status-badge" [class.active]="row.isActive">
                <span class="status-dot" [class.status-dot--active]="row.isActive"></span>
                {{ row.isActive ? 'Activo' : 'Inactivo' }}
              </span>
            </td>

            <td (click)="$event.stopPropagation()">
              <div class="action-btns">
                <button
                  type="button"
                  class="action-btn"
                  (click)="edit.emit(row)"
                  [attr.aria-label]="'Editar ' + row.firstName + ' ' + row.lastName"
                >
                  <i class="pi pi-pencil" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="action-btn"
                  (click)="employeeSelect.emit(row)"
                  [attr.aria-label]="'Ver detalle de ' + row.firstName + ' ' + row.lastName"
                >
                  <i class="pi pi-eye" aria-hidden="true"></i>
                </button>
              </div>
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
  readonly loading   = input<boolean>(false);

  readonly employeeSelect = output<EmployeeDto>();
  readonly edit           = output<EmployeeDto>();

  readonly skeletonRows = SKELETON_ROWS;

  initials(firstName: string, lastName: string): string {
    return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase();
  }

  avatarStyle(firstName: string, lastName: string): Record<string, string> {
    const hash = [...(firstName + lastName)].reduce((a, c) => a + c.charCodeAt(0), 0);
    const pick = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
    return { background: pick.background, color: pick.color };
  }

  chipStyle(category: EmployeeCategory): Record<string, string> {
    const c = CATEGORY_MAP[category];
    return c
      ? { background: c.bg, color: c.color }
      : { background: 'var(--surface-2)', color: 'var(--text-2)' };
  }

  chipLabel(category: EmployeeCategory): string {
    return CATEGORY_MAP[category]?.label ?? category;
  }

  contractColor(contractType: string): string {
    return CONTRACT_MAP[contractType]?.color ?? 'var(--text-2)';
  }

  contractLabel(contractType: string): string {
    return CONTRACT_MAP[contractType]?.label ?? contractType;
  }
}
