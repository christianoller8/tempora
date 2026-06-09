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
    /* ── Host ─────────────────────────────────────────────────────── */
    :host { display: block; }

    /* ── Page header ─────────────────────────────────────────────── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.375rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-title {
      font-size: 1.5625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .page-sub {
      font-size: 0.8125rem;
      color: var(--text-2);
      margin-top: 0.25rem;
    }

    /* ── Filter / toolbar ───────────────────────────────────────── */
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1.125rem;
    }

    .search-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 220px;
      max-width: 360px;
    }

    .search-wrap .search-ico {
      position: absolute;
      left: 0.875rem;
      color: var(--text-3);
      pointer-events: none;
      width: 16px;
      height: 16px;
    }

    .search-wrap input[type="text"] {
      width: 100%;
      height: 44px;
      padding: 0 0.875rem 0 2.625rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.84375rem;
      outline: none;
      transition: border-color var(--transition), box-shadow var(--transition);
      box-sizing: border-box;
    }

    .search-wrap input[type="text"]::placeholder { color: var(--text-3); }

    .search-wrap input[type="text"]:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    /* PrimeNG select override */
    :host ::ng-deep .filter-bar .p-select {
      min-width: 175px;
      height: 44px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.8125rem;
      font-weight: 600;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    :host ::ng-deep .filter-bar .p-select:focus-within {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    :host ::ng-deep .filter-bar .p-select .p-select-label {
      color: var(--text);
      padding: 0 0.875rem;
    }

    :host ::ng-deep .filter-bar .p-select .p-select-dropdown {
      color: var(--text-3);
    }

    /* ── Table card ─────────────────────────────────────────────── */
    .table-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    /* ── Empty state ────────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2.875rem 1rem;
      color: var(--text-3);
      font-size: 0.8125rem;
    }

    .empty-state .pi { font-size: 2rem; opacity: 0.35; }

    /* ── Dark mode overrides ────────────────────────────────────── */
    :host-context([data-theme="dark"]) .page-title {
      color: var(--text);
    }

    :host-context([data-theme="dark"]) .page-sub {
      color: var(--text-2);
    }

    :host-context([data-theme="dark"]) .search-wrap input[type="text"] {
      background: var(--surface);
      border-color: var(--border);
      color: var(--text);
    }

    :host-context([data-theme="dark"]) .search-wrap input[type="text"]:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    :host-context([data-theme="dark"]) .table-panel {
      background: var(--surface);
      border-color: var(--border-soft);
      box-shadow: var(--shadow);
    }

    :host-context([data-theme="dark"]) ::ng-deep .filter-bar .p-select {
      background: var(--surface);
      border-color: var(--border);
      color: var(--text);
    }

    :host-context([data-theme="dark"]) ::ng-deep .filter-bar .p-select .p-select-label {
      color: var(--text);
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
