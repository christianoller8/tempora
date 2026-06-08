import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { EmployeesStore } from '../data-access/employees.store';
import { CentersApi } from '../data-access/employees.api';
import type { CenterDto, CreateEmployeeDto, UpdateEmployeeDto, EmployeeDto } from '../data-access/employees.api';
import { EMPLOYEE_CATEGORY_VALUES } from '../data-access/employees.api';
import { EmployeeTableComponent } from '../ui/employee-table.component';
import { EmployeeFormComponent } from '../ui/employee-form.component';
import { EmployeeDetailComponent } from '../ui/employee-detail.component';
import type { EmployeeCategory } from '@tempora/shared';

const CATEGORY_FILTER_OPTIONS = [
  { label: 'All Categories', value: null as EmployeeCategory | null },
  ...EMPLOYEE_CATEGORY_VALUES.map(v => ({ label: v, value: v as EmployeeCategory | null })),
];

const STATUS_FILTER_OPTIONS = [
  { label: 'All', value: 'ALL' as const },
  { label: 'Active', value: 'ACTIVE' as const },
  { label: 'Inactive', value: 'INACTIVE' as const },
];

@Component({
  selector: 'app-employees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    FormsModule, ButtonModule, SelectModule, InputTextModule, ToastModule,
    EmployeeTableComponent, EmployeeFormComponent, EmployeeDetailComponent,
    TranslatePipe,
  ],
  styles: [`
    :host { display: block; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--p-text-color);
    }

    .page-sub {
      font-size: 0.8125rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 0.125rem;
    }

    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }

    .filter-bar input[type="text"] {
      height: 38px;
      padding: 0 0.75rem;
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 8px;
      color: var(--p-text-color);
      font-size: 0.875rem;
      outline: none;
      min-width: 220px;
      box-sizing: border-box;
    }

    .filter-bar input[type="text"]:focus { border-color: var(--p-primary-color); }

    .table-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      overflow: hidden;
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

    :host ::ng-deep .filter-bar .p-select {
      min-width: 180px;
    }
  `],
  template: `
    <p-toast position="top-right" />

    <!-- ── Page header ─────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <div class="page-title">{{ 'EMPLOYEES.TITLE' | translate }}</div>
        <div class="page-sub">{{ 'EMPLOYEES.TITLE' | translate }}</div>
      </div>
    </div>

    <!-- ── Search + filter bar ────────────────────────────────── -->
    <div class="filter-bar">
      <input
        type="text"
        [placeholder]="'EMPLOYEES.SEARCH_PLACEHOLDER' | translate"
        [value]="store.search()"
        (input)="store.setSearch($any($event.target).value)"
        aria-label="Search employees by name"
      />
      <p-select
        [options]="categoryFilterOptions"
        optionLabel="label"
        optionValue="value"
        [ngModel]="store.categoryFilter()"
        (ngModelChange)="store.setCategory($any($event))"
        [placeholder]="'COMMON.ALL' | translate"
        aria-label="Filter by category"
      />
      <p-select
        [options]="statusFilterOptions"
        optionLabel="label"
        optionValue="value"
        [ngModel]="store.statusFilter()"
        (ngModelChange)="store.setStatus($any($event))"
        aria-label="Filter by status"
      />
    </div>

    <!-- ── Employee table ─────────────────────────────────────── -->
    @if (!store.loading() && store.filteredEmployees().length === 0 && store.employees().length > 0) {
      <div class="empty-state">
        <i class="pi pi-search"></i>
        <span>{{ 'EMPLOYEES.EMPTY_STATE' | translate }}</span>
      </div>
    } @else {
      <div class="table-panel">
        <app-employee-table
          [employees]="store.filteredEmployees()"
          [loading]="store.loading()"
          (employeeSelect)="onSelectEmployee($event)"
          (edit)="onEditFromTable($event)"
          (addClick)="onAddClick()"
        />
      </div>
    }

    <!-- ── Form dialog ─────────────────────────────────────────── -->
    <app-employee-form
      [visible]="showForm()"
      [employee]="editMode() ? store.selected() : null"
      [centers]="centers()"
      [saving]="store.saving()"
      [serverError]="formError()"
      (save)="onSave($event)"
      (cancel)="onCancelForm()"
    />

    <!-- ── Detail dialog ──────────────────────────────────────── -->
    <app-employee-detail
      [employee]="store.selected()"
      [visible]="showDetail()"
      (close)="showDetail.set(false); store.select(null)"
      (edit)="onEditFromDetail($event)"
      (deactivate)="onDeactivate($event)"
      (reactivate)="onReactivate($event)"
    />
  `,
})
export class EmployeesComponent implements OnInit {
  protected readonly store = inject(EmployeesStore) as unknown as EmployeesStore;
  private  readonly centersApi = inject(CentersApi);
  private  readonly messageService = inject(MessageService);
  private  readonly translate = inject(TranslateService);

  readonly centers = signal<CenterDto[]>([]);
  readonly showForm = signal(false);
  readonly showDetail = signal(false);
  readonly editMode = signal(false);
  readonly formError = signal<string | null>(null);

  readonly categoryFilterOptions = CATEGORY_FILTER_OPTIONS;
  readonly statusFilterOptions = STATUS_FILTER_OPTIONS;

  ngOnInit(): void {
    void this.store.load();
    firstValueFrom(this.centersApi.list())
      .then(list => this.centers.set(list))
      .catch(() => this.centers.set([]));
  }

  onSelectEmployee(emp: EmployeeDto): void {
    console.log('[Container] onSelectEmployee — emp.id:', emp.id, 'isActive:', emp.isActive);
    this.store.select(emp);
    this.showDetail.set(true);
    console.log('[Container] showDetail after set:', this.showDetail());
  }

  onAddClick(): void {
    this.store.select(null);
    this.editMode.set(false);
    this.formError.set(null);
    this.showForm.set(true);
  }

  onEditFromTable(emp: EmployeeDto): void {
    this.store.select(emp);
    this.editMode.set(true);
    this.formError.set(null);
    this.showForm.set(true);
  }

  onEditFromDetail(emp: EmployeeDto): void {
    this.store.select(emp);
    this.editMode.set(true);
    this.formError.set(null);
    this.showDetail.set(false);
    this.showForm.set(true);
  }

  async onSave(dto: CreateEmployeeDto | UpdateEmployeeDto): Promise<void> {
    this.formError.set(null);
    try {
      if (this.editMode()) {
        const selected = this.store.selected();
        if (!selected) return;
        await this.store.update(selected.id, dto as UpdateEmployeeDto);
        this.messageService.add({ severity: 'success', summary: this.translate.instant('EMPLOYEES.TOAST_UPDATED_SUMMARY'), detail: this.translate.instant('EMPLOYEES.TOAST_UPDATED_DETAIL') });
      } else {
        await this.store.create(dto as CreateEmployeeDto);
        this.messageService.add({ severity: 'success', summary: this.translate.instant('EMPLOYEES.TOAST_CREATED_SUMMARY'), detail: this.translate.instant('EMPLOYEES.TOAST_CREATED_DETAIL') });
      }
      this.showForm.set(false);
      this.store.select(null);
    } catch (err: unknown) {
      this.formError.set(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    }
  }

  onCancelForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
    this.store.select(null);
  }

  async onReactivate(id: string): Promise<void> {
    try {
      await this.store.reactivate(id);
      this.showDetail.set(false);
      this.store.select(null);
      this.messageService.add({ severity: 'success', summary: this.translate.instant('EMPLOYEES.TOAST_REACTIVATED_SUMMARY'), detail: this.translate.instant('EMPLOYEES.TOAST_REACTIVATED_DETAIL') });
    } catch (err: unknown) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('EMPLOYEES.TOAST_ERROR_SUMMARY'),
        detail: err instanceof Error ? err.message : this.translate.instant('EMPLOYEES.TOAST_ERROR_DETAIL'),
      });
    }
  }

  async onDeactivate(id: string): Promise<void> {
    try {
      await this.store.deactivate(id);
      this.showDetail.set(false);
      this.store.select(null);
      this.messageService.add({ severity: 'success', summary: this.translate.instant('EMPLOYEES.TOAST_DEACTIVATED_SUMMARY'), detail: this.translate.instant('EMPLOYEES.TOAST_DEACTIVATED_DETAIL') });
    } catch (err: unknown) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('EMPLOYEES.TOAST_ERROR_SUMMARY'),
        detail: err instanceof Error ? err.message : this.translate.instant('EMPLOYEES.TOAST_ERROR_DETAIL'),
      });
    }
  }
}
