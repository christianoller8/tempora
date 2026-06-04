import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import type { EmployeeDto, CreateEmployeeDto, UpdateEmployeeDto, CenterDto } from '../data-access/employees.api';
import { EMPLOYEE_CATEGORY_VALUES, CONTRACT_TYPE_VALUES } from '../data-access/employees.api';

@Component({
  selector: 'app-employee-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, SelectModule, InputTextModule, ReactiveFormsModule],
  styles: [`
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .field.full-width { grid-column: 1 / -1; }

    .field label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .field input[type="date"],
    .field input[type="number"],
    .field input[type="text"] {
      width: 100%;
      height: 38px;
      padding: 0 0.75rem;
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 8px;
      color: var(--p-text-color);
      font-size: 0.875rem;
      outline: none;
      box-sizing: border-box;
    }

    .field input:focus {
      border-color: var(--p-primary-color);
    }

    .field .error {
      font-size: 0.75rem;
      color: var(--p-red-400, #f87171);
    }

    .server-error {
      padding: 0.75rem;
      background: color-mix(in srgb, var(--p-red-400, #f87171) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-400, #f87171) 30%, transparent);
      border-radius: 8px;
      color: var(--p-red-400, #f87171);
      font-size: 0.8125rem;
      margin-bottom: 1rem;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 0.5rem;
    }

    :host ::ng-deep .p-select {
      width: 100%;
    }
  `],
  template: `
    <p-dialog
      [header]="employee() ? 'Edit Employee' : 'Add Employee'"
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [style]="{ width: '600px' }"
      [draggable]="false"
      [resizable]="false"
      (onShow)="onDialogShow()"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>

        @if (serverError()) {
          <div class="server-error" role="alert">
            <i class="pi pi-exclamation-circle"></i> {{ serverError() }}
          </div>
        }

        <div class="form-grid">

          <div class="field">
            <label for="emp-firstName">First Name <span aria-hidden="true">*</span></label>
            <input
              pInputText
              id="emp-firstName"
              type="text"
              formControlName="firstName"
              aria-required="true"
              [attr.aria-invalid]="f['firstName'].invalid && f['firstName'].touched"
            />
            @if (f['firstName'].invalid && f['firstName'].touched) {
              <span class="error" role="alert">First name is required (max 100 chars).</span>
            }
          </div>

          <div class="field">
            <label for="emp-lastName">Last Name <span aria-hidden="true">*</span></label>
            <input
              pInputText
              id="emp-lastName"
              type="text"
              formControlName="lastName"
              aria-required="true"
              [attr.aria-invalid]="f['lastName'].invalid && f['lastName'].touched"
            />
            @if (f['lastName'].invalid && f['lastName'].touched) {
              <span class="error" role="alert">Last name is required (max 100 chars).</span>
            }
          </div>

          <div class="field">
            <label for="emp-nif">NIF</label>
            <input
              pInputText
              id="emp-nif"
              type="text"
              formControlName="nif"
              placeholder="Optional"
            />
            @if (f['nif'].invalid && f['nif'].touched) {
              <span class="error" role="alert">NIF must be max 20 chars.</span>
            }
          </div>

          <div class="field">
            <label for="emp-category">Category <span aria-hidden="true">*</span></label>
            <p-select
              inputId="emp-category"
              formControlName="category"
              [options]="categoryOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select category"
              aria-required="true"
            />
            @if (f['category'].invalid && f['category'].touched) {
              <span class="error" role="alert">Category is required.</span>
            }
          </div>

          <div class="field">
            <label for="emp-contractType">Contract Type <span aria-hidden="true">*</span></label>
            <p-select
              inputId="emp-contractType"
              formControlName="contractType"
              [options]="contractTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select contract type"
              aria-required="true"
            />
            @if (f['contractType'].invalid && f['contractType'].touched) {
              <span class="error" role="alert">Contract type is required.</span>
            }
          </div>

          @if (form.get('contractType')?.value === 'TIEMPO_PARCIAL') {
            <div class="field">
              <label for="emp-hours">Hours/Week <span aria-hidden="true">*</span></label>
              <input
                id="emp-hours"
                type="number"
                formControlName="contractedHoursPerWeek"
                min="1"
                max="40"
                aria-required="true"
                [attr.aria-invalid]="f['contractedHoursPerWeek'].invalid && f['contractedHoursPerWeek'].touched"
              />
              @if (f['contractedHoursPerWeek'].invalid && f['contractedHoursPerWeek'].touched) {
                <span class="error" role="alert">Hours per week must be between 1 and 40.</span>
              }
            </div>
          }

          <div class="field">
            <label for="emp-primaryCenter">Primary Center <span aria-hidden="true">*</span></label>
            <p-select
              inputId="emp-primaryCenter"
              formControlName="primaryCenterId"
              [options]="centerOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Select center"
              aria-required="true"
            />
            @if (f['primaryCenterId'].invalid && f['primaryCenterId'].touched) {
              <span class="error" role="alert">Primary center is required.</span>
            }
          </div>

          <div class="field">
            <label for="emp-workingCalendar">Working Calendar</label>
            <input
              pInputText
              id="emp-workingCalendar"
              type="text"
              formControlName="workingCalendarId"
              placeholder="Optional UUID"
            />
          </div>

          <div class="field">
            <label for="emp-hireDate">Hire Date <span aria-hidden="true">*</span></label>
            <input
              id="emp-hireDate"
              type="date"
              formControlName="hireDate"
              aria-required="true"
              [attr.aria-invalid]="f['hireDate'].invalid && f['hireDate'].touched"
            />
            @if (f['hireDate'].invalid && f['hireDate'].touched) {
              <span class="error" role="alert">Hire date is required.</span>
            }
          </div>

        </div>

        <div class="dialog-footer">
          <p-button
            type="button"
            label="Cancel"
            severity="secondary"
            [text]="true"
            (onClick)="onCancel()"
          />
          <p-button
            type="submit"
            label="Save"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="form.invalid"
          />
        </div>

      </form>
    </p-dialog>
  `,
})
export class EmployeeFormComponent implements OnInit {
  readonly employee = input<EmployeeDto | null>(null);
  readonly centers = input<CenterDto[]>([]);
  readonly visible = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly serverError = input<string | null>(null);

  readonly save = output<CreateEmployeeDto | UpdateEmployeeDto>();
  readonly cancel = output<void>();

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    firstName:               ['', [Validators.required, Validators.maxLength(100)]],
    lastName:                ['', [Validators.required, Validators.maxLength(100)]],
    nif:                     ['', [Validators.maxLength(20)]],
    category:                ['' as string, Validators.required],
    contractType:            ['' as string, Validators.required],
    contractedHoursPerWeek:  [null as number | null],
    primaryCenterId:         ['', Validators.required],
    workingCalendarId:       [''],
    hireDate:                ['', Validators.required],
  });

  readonly categoryOptions    = EMPLOYEE_CATEGORY_VALUES.map(v => ({ label: v, value: v }));
  readonly contractTypeOptions = CONTRACT_TYPE_VALUES.map(v => ({ label: v, value: v }));
  readonly centerOptions = computed(() => {
    const list = this.centers().map(c => ({ label: c.name, value: c.id }));
    console.log('[EmployeeForm] centerOptions:', list.length, 'centers');
    return list;
  });

  get f() { return this.form.controls; }

  onDialogShow(): void {
    const emp = this.employee();
    console.log('[EmployeeForm] onShow —', emp ? 'edit: ' + emp.id : 'add mode',
      '| categories:', this.categoryOptions.length,
      '| contractTypes:', this.contractTypeOptions.length,
      '| centers:', this.centers().length);
    if (emp) {
      console.log('[Form] hireDate raw value:', emp.hireDate);
      const hireDateFormatted = emp.hireDate ? emp.hireDate.split('T')[0] : '';
      console.log('[Form] hireDate patched value:', hireDateFormatted);
      this.form.patchValue({
        firstName:              emp.firstName,
        lastName:               emp.lastName,
        nif:                    emp.nif ?? '',
        category:               emp.category,
        contractType:           emp.contractType,
        contractedHoursPerWeek: emp.contractedHoursPerWeek,
        primaryCenterId:        emp.primaryCenterId,
        workingCalendarId:      emp.workingCalendarId ?? '',
        hireDate:               hireDateFormatted,
      });
    } else {
      this.form.reset();
    }
  }

  ngOnInit(): void {
    this.form.get('contractType')?.valueChanges.subscribe(() => {
      const hoursCtrl = this.form.get('contractedHoursPerWeek')!;
      if (this.form.get('contractType')?.value === 'TIEMPO_PARCIAL') {
        hoursCtrl.setValidators([Validators.required, Validators.min(1), Validators.max(40)]);
      } else {
        hoursCtrl.clearValidators();
        hoursCtrl.setValue(null);
      }
      hoursCtrl.updateValueAndValidity({ emitEvent: false });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const dto: CreateEmployeeDto = {
      firstName:   raw.firstName,
      lastName:    raw.lastName,
      category:    raw.category as CreateEmployeeDto['category'],
      contractType: raw.contractType as CreateEmployeeDto['contractType'],
      primaryCenterId: raw.primaryCenterId,
      hireDate:    raw.hireDate,
      ...(raw.nif ? { nif: raw.nif } : {}),
      ...(() => {
        const h = raw.contractedHoursPerWeek != null ? Number(raw.contractedHoursPerWeek) : null;
        return h !== null && !isNaN(h) && h > 0 ? { contractedHoursPerWeek: h } : {};
      })(),
      ...(raw.workingCalendarId ? { workingCalendarId: raw.workingCalendarId } : {}),
    };
    this.save.emit(dto);
  }

  onCancel(): void {
    this.form.reset();
    this.cancel.emit();
  }
}
