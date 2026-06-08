import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import type { EmployeeDto } from '../data-access/employees.api';
import { TimeApi } from '../../time-tracking/data-access/time.api';
import type { TimeEntryDto } from '../../time-tracking/data-access/time.api';
import { firstValueFrom } from 'rxjs';

function entryDuration(entry: TimeEntryDto): string {
  const start = new Date(entry.clockIn);
  const end   = entry.clockOut ? new Date(entry.clockOut) : new Date();
  const ms    = end.getTime() - start.getTime();
  if (ms < 0) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

@Component({
  selector: 'app-employee-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DialogModule, ButtonModule, TagModule, SkeletonModule, TranslatePipe],
  styles: [`
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem 1.25rem;
      margin-bottom: 1.25rem;
    }

    .detail-field { display: flex; flex-direction: column; gap: 0.2rem; }

    .detail-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .detail-value {
      font-size: 0.875rem;
      color: var(--p-text-color);
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--p-text-color);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      margin-top: 1.25rem;
    }

    .section-title .pi { color: var(--p-primary-color); font-size: 0.875rem; }

    .actions-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }

    .confirm-inline {
      background: color-mix(in srgb, var(--p-red-400, #f87171) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-400, #f87171) 30%, transparent);
      border-radius: 8px;
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
      color: var(--p-text-color);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-top: 0.5rem;
    }

    .entries-panel {
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 10px;
      overflow: hidden;
    }

    .entry-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      border-bottom: 1px solid var(--p-surface-border);
      font-size: 0.8125rem;
    }

    .entry-row:last-child { border-bottom: none; }

    .entry-time { color: var(--p-text-color); font-variant-numeric: tabular-nums; }
    .entry-dur  { color: var(--p-text-color-muted, var(--p-text-color-secondary)); }

    .empty-entries {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.5rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-size: 0.8125rem;
    }

    .skeleton-block {
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  `],
  template: `
    <p-dialog
      [header]="'EMPLOYEES.EMPLOYEE_DETAIL' | translate"
      [visible]="visible()"
      [modal]="true"
      [closable]="true"
      (onHide)="close.emit()"
      [style]="{ width: '600px' }"
      [draggable]="false"
      [resizable]="false"
    >
      @if (employee()) {

        <!-- ── Employee fields ─────────────────────────────── -->
        <div class="detail-grid">
          <div class="detail-field">
            <span class="detail-label">{{ 'EMPLOYEES.FIELD_FULL_NAME' | translate }}</span>
            <span class="detail-value">{{ employee()!.firstName }} {{ employee()!.lastName }}</span>
          </div>

          <div class="detail-field">
            <span class="detail-label">{{ 'EMPLOYEES.FIELD_CATEGORY' | translate }}</span>
            <span class="detail-value">{{ employee()!.category }}</span>
          </div>

          <div class="detail-field">
            <span class="detail-label">{{ 'EMPLOYEES.TABLE_CONTRACT' | translate }}</span>
            <span class="detail-value">{{ employee()!.contractType }}</span>
          </div>

          @if (employee()!.contractType === 'TIEMPO_PARCIAL') {
            <div class="detail-field">
              <span class="detail-label">{{ 'EMPLOYEES.TABLE_HOURS_WEEK' | translate }}</span>
              <span class="detail-value">{{ employee()!.contractedHoursPerWeek }}h</span>
            </div>
          }

          <div class="detail-field">
            <span class="detail-label">{{ 'EMPLOYEES.TABLE_HIRE_DATE' | translate }}</span>
            <span class="detail-value">{{ employee()!.hireDate | date:'d MMM y' }}</span>
          </div>

          <div class="detail-field">
            <span class="detail-label">{{ 'EMPLOYEES.TABLE_STATUS' | translate }}</span>
            <p-tag
              [value]="employee()!.isActive ? ('STATUS.ACTIVE' | translate) : ('STATUS.INACTIVE' | translate)"
              [severity]="employee()!.isActive ? 'success' : 'secondary'"
              [rounded]="true"
              [style]="{ fontSize: '0.7rem' }"
            />
          </div>

          @if (employee()!.nif) {
            <div class="detail-field">
              <span class="detail-label">{{ 'EMPLOYEES.TABLE_NIF' | translate }}</span>
              <span class="detail-value">{{ employee()!.nif }}</span>
            </div>
          }
        </div>

        <!-- ── Actions ────────────────────────────────────── -->
        <div class="section-title"><i class="pi pi-cog"></i>{{ 'COMMON.ACTIONS' | translate }}</div>
        <div class="actions-row">
          <p-button
            [label]="'COMMON.EDIT' | translate"
            icon="pi pi-pencil"
            severity="secondary"
            size="small"
            (onClick)="edit.emit(employee()!)"
            [attr.aria-label]="'COMMON.EDIT' | translate"
          />
          @if (employee()!.isActive) {
            <p-button
              [label]="'COMMON.DEACTIVATE' | translate"
              icon="pi pi-times-circle"
              severity="danger"
              size="small"
              [text]="true"
              (onClick)="showConfirm.set(true)"
              [attr.aria-label]="'COMMON.DEACTIVATE' | translate"
            />
          } @else {
            <p-button
              [label]="'COMMON.REACTIVATE' | translate"
              icon="pi pi-check-circle"
              severity="success"
              size="small"
              [text]="true"
              (onClick)="reactivate.emit(employee()!.id)"
              [attr.aria-label]="'COMMON.REACTIVATE' | translate"
            />
          }
        </div>

        @if (showConfirm()) {
          <div class="confirm-inline" role="alertdialog" aria-live="assertive">
            <span>{{ 'EMPLOYEES.DEACTIVATE_CONFIRM' | translate:{ name: employee()!.firstName } }}</span>
            <div style="display:flex; gap:0.5rem;">
              <p-button
                [label]="'COMMON.CONFIRM' | translate"
                severity="danger"
                size="small"
                (onClick)="onConfirmDeactivate()"
              />
              <p-button
                [label]="'COMMON.CANCEL' | translate"
                severity="secondary"
                size="small"
                [text]="true"
                (onClick)="showConfirm.set(false)"
              />
            </div>
          </div>
        }

        <!-- ── Recent Time Entries ─────────────────────────── -->
        <div class="section-title"><i class="pi pi-clock"></i>{{ 'TIME.ENTRIES_TODAY' | translate }}</div>

        <div class="entries-panel">
          @if (entriesLoading()) {
            <div class="skeleton-block">
              @for (_ of [1,2,3]; track $index) {
                <p-skeleton height="2rem" borderRadius="6px" />
              }
            </div>
          } @else if (entries().length === 0) {
            <div class="empty-entries">
              <i class="pi pi-clock"></i>
              <span>{{ 'TIME.EMPTY_ENTRIES' | translate }}</span>
            </div>
          } @else {
            @for (entry of entries(); track entry.id) {
              <div class="entry-row">
                <span class="entry-time">{{ entry.clockIn | date:'d MMM y, HH:mm' }}</span>
                <span class="entry-time">
                  @if (entry.clockOut) {
                    → {{ entry.clockOut | date:'HH:mm' }}
                  } @else {
                    {{ 'DASHBOARD.RUNNING' | translate }}
                  }
                </span>
                <span class="entry-dur">{{ duration(entry) }}</span>
                <p-tag
                  [value]="entry.status === 'OPEN' ? ('STATUS.OPEN' | translate) : ('STATUS.CLOSED' | translate)"
                  [severity]="entry.status === 'OPEN' ? 'success' : 'secondary'"
                  [rounded]="true"
                  [style]="{ fontSize: '0.65rem' }"
                />
              </div>
            }
          }
        </div>

      }
    </p-dialog>
  `,
})
export class EmployeeDetailComponent {
  readonly employee = input<EmployeeDto | null>(null);
  readonly visible = input<boolean>(false);

  readonly close = output<void>();
  readonly edit = output<EmployeeDto>();
  readonly deactivate = output<string>();
  readonly reactivate = output<string>();

  private readonly timeApi = inject(TimeApi);

  readonly entries = signal<TimeEntryDto[]>([]);
  readonly entriesLoading = signal(false);
  readonly showConfirm = signal(false);

  constructor() {
    effect(() => {
      const emp = this.employee();
      const vis = this.visible();
      console.log('[Detail] employee isActive:', emp?.isActive, '| id:', emp?.id, '| visible:', vis);
      if (vis && emp) {
        void this.loadEntries(emp.id);
      }
      if (!vis) {
        this.showConfirm.set(false);
      }
    });
  }

  private async loadEntries(employeeId: string): Promise<void> {
    this.entriesLoading.set(true);
    try {
      const list = await firstValueFrom(
        this.timeApi.listEntries({ employeeId, status: 'CLOSED' }),
      );
      this.entries.set(list.slice(0, 10));
    } catch {
      this.entries.set([]);
    } finally {
      this.entriesLoading.set(false);
    }
  }

  onConfirmDeactivate(): void {
    const emp = this.employee();
    if (emp) {
      this.showConfirm.set(false);
      this.deactivate.emit(emp.id);
    }
  }

  duration(entry: TimeEntryDto): string {
    return entryDuration(entry);
  }
}
