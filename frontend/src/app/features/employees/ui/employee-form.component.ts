import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  untracked,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import type { EmployeeDto, CreateEmployeeDto, UpdateEmployeeDto, CenterDto } from '../data-access/employees.api';
import { EMPLOYEE_CATEGORY_VALUES, CONTRACT_TYPE_VALUES } from '../data-access/employees.api';

const CATEGORY_LABELS: Record<string, string> = {
  MEDICO:         'MÉDICO',
  ENFERMERO:      'ENFERMERO/A',
  TCAE:           'TCAE',
  FISIOTERAPEUTA: 'FISIOTERAPEUTA',
  CELADOR:        'CELADOR',
  ADMINISTRATIVO: 'ADMINISTRATIVO',
};

const CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO:     'Indefinido',
  TEMPORAL:       'Temporal',
  TIEMPO_PARCIAL: 'Tiempo parcial',
};

@Component({
  selector: 'app-employee-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectModule, InputTextModule, ButtonModule, TranslatePipe],
  styles: [`
    /* ── Overlay ─────────────────────────────────────────────── */
    .dr-overlay {
      position: fixed;
      inset: 0;
      background: rgba(8, 4, 20, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      z-index: 200;
    }

    .dr-overlay--show { opacity: 1; pointer-events: auto; }

    /* ── Drawer ──────────────────────────────────────────────── */
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: 420px;
      max-width: 92vw;
      background: var(--surface);
      border-left: 1px solid var(--border);
      box-shadow: -30px 0 80px -20px rgba(0, 0, 0, 0.6);
      transform: translateX(100%);
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 201;
      display: flex;
      flex-direction: column;
    }

    .drawer--open { transform: translateX(0); }

    /* ── Header ──────────────────────────────────────────────── */
    .dr-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 22px 24px;
      border-bottom: 1px solid var(--border-soft);
      flex-shrink: 0;
    }

    .dr-head h2 { font-size: 1.0625rem; font-weight: 700; color: var(--text); margin: 0; }
    .dr-head p  { font-size: 0.78125rem; color: var(--text-2); margin-top: 3px; }

    .dr-close {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-2);
      cursor: pointer;
      border: 1px solid var(--border-soft);
      background: transparent;
      font-size: 0.875rem;
      transition: all var(--transition);
      flex-shrink: 0;
      font-family: inherit;
    }

    .dr-close:hover { color: var(--text); background: var(--surface-2); }

    /* ── Form (wraps body + footer as flex column) ───────────── */
    .dr-form {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    /* ── Body ────────────────────────────────────────────────── */
    .dr-body {
      flex: 1;
      overflow-y: auto;
      padding: 22px 24px;
    }

    /* ── Fields ──────────────────────────────────────────────── */
    .dr-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .dr-field label {
      font-size: 0.71875rem;
      font-weight: 600;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .dr-field label .req { color: var(--danger); }

    .dr-input {
      width: 100%;
      height: 46px;
      padding: 0 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 11px;
      color: var(--text);
      font-size: 0.84375rem;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    .dr-input:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    .dr-input::placeholder { color: var(--text-3); }

    .dr-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .dr-error { font-size: 0.6875rem; color: var(--danger); }

    .server-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--danger-soft);
      border: 1px solid var(--danger);
      border-radius: var(--radius-sm);
      color: var(--danger);
      font-size: 0.8125rem;
      margin-bottom: 16px;
    }

    /* ── P-Select inside drawer ──────────────────────────────── */
    :host ::ng-deep .dr-field .p-select {
      width: 100%;
      height: 46px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 11px;
      font-size: 0.84375rem;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    :host ::ng-deep .dr-field .p-select:focus-within {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    :host ::ng-deep .dr-field .p-select .p-select-label {
      color: var(--text);
      padding: 0 14px;
      line-height: 44px;
    }

    /* ── Footer ──────────────────────────────────────────────── */
    .dr-foot {
      display: flex;
      gap: 10px;
      padding: 18px 24px;
      border-top: 1px solid var(--border-soft);
      flex-shrink: 0;
    }

    .dr-btn-cancel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 46px;
      border-radius: 11px;
      border: 1px solid var(--border-soft);
      background: transparent;
      color: var(--text-2);
      font-size: 0.84375rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition);
      font-family: inherit;
    }

    .dr-btn-cancel:hover { color: var(--text); border-color: var(--border); background: var(--surface-2); }

    .dr-btn-save {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 46px;
      border-radius: 11px;
      border: none;
      background: var(--primary);
      color: #fff;
      font-size: 0.84375rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: var(--glow);
      transition: background var(--transition);
      font-family: inherit;
    }

    .dr-btn-save:hover:not(:disabled) { background: var(--primary-hover); }
    .dr-btn-save:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
  `],
  template: `
    <!-- ── Backdrop ──────────────────────────────────────────── -->
    <div
      class="dr-overlay"
      [class.dr-overlay--show]="visible()"
      (click)="onCancel()"
      aria-hidden="true"
    ></div>

    <!-- ── Drawer ────────────────────────────────────────────── -->
    <aside
      class="drawer"
      [class.drawer--open]="visible()"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="employee() ? ('EMPLOYEES.EDIT_EMPLOYEE' | translate) : ('EMPLOYEES.ADD_EMPLOYEE' | translate)"
    >
      <!-- Header -->
      <div class="dr-head">
        <div>
          <h2>{{ employee() ? ('EMPLOYEES.EDIT_EMPLOYEE' | translate) : ('EMPLOYEES.ADD_EMPLOYEE' | translate) }}</h2>
          <p>{{ employee() ? 'Modifica los datos del empleado' : 'Da de alta un nuevo miembro de la plantilla' }}</p>
        </div>
        <button type="button" class="dr-close" (click)="onCancel()" aria-label="Cerrar">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Form wraps body + footer for keyboard submit -->
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="dr-form">

        <!-- Body -->
        <div class="dr-body">

          @if (serverError()) {
            <div class="server-error" role="alert">
              <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
              {{ serverError() }}
            </div>
          }

          <!-- Nombre completo -->
          <div class="dr-field">
            <label for="emp-fullName">Nombre completo <span class="req" aria-hidden="true">*</span></label>
            <input
              class="dr-input"
              id="emp-fullName"
              type="text"
              formControlName="fullName"
              placeholder="Nombre y apellidos"
              aria-required="true"
            />
            @if (f['fullName'].invalid && f['fullName'].touched) {
              <span class="dr-error" role="alert">El nombre es obligatorio.</span>
            }
          </div>

          <!-- NIF + Teléfono -->
          <div class="dr-two">
            <div class="dr-field">
              <label for="emp-nif">NIF / DNI <span class="req" aria-hidden="true">*</span></label>
              <input
                class="dr-input"
                id="emp-nif"
                type="text"
                formControlName="nif"
                placeholder="00000000A"
              />
            </div>
            <div class="dr-field">
              <label for="emp-phone">Teléfono</label>
              <input
                class="dr-input"
                id="emp-phone"
                type="text"
                formControlName="phone"
                placeholder="+34 600 000 000"
              />
            </div>
          </div>

          <!-- Correo electrónico -->
          <div class="dr-field">
            <label for="emp-email">Correo electrónico <span class="req" aria-hidden="true">*</span></label>
            <input
              class="dr-input"
              id="emp-email"
              type="email"
              formControlName="email"
              placeholder="nombre@tempora.com"
            />
          </div>

          <!-- Categoría profesional -->
          <div class="dr-field">
            <label for="emp-category">Categoría profesional <span class="req" aria-hidden="true">*</span></label>
            <p-select
              inputId="emp-category"
              formControlName="category"
              [options]="categoryOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar categoría"
              aria-required="true"
            />
            @if (f['category'].invalid && f['category'].touched) {
              <span class="dr-error" role="alert">La categoría es obligatoria.</span>
            }
          </div>

          <!-- Tipo de contrato + Horas/semana -->
          <div class="dr-two">
            <div class="dr-field">
              <label for="emp-contractType">Tipo de contrato <span class="req" aria-hidden="true">*</span></label>
              <p-select
                inputId="emp-contractType"
                formControlName="contractType"
                [options]="contractTypeOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar tipo"
                aria-required="true"
              />
              @if (f['contractType'].invalid && f['contractType'].touched) {
                <span class="dr-error" role="alert">El tipo de contrato es obligatorio.</span>
              }
            </div>
            <div class="dr-field">
              <label for="emp-hours">Horas / semana</label>
              <input
                class="dr-input"
                id="emp-hours"
                type="number"
                formControlName="contractedHoursPerWeek"
                min="1"
                max="40"
                placeholder="40"
              />
            </div>
          </div>

          <!-- Fecha de alta -->
          <div class="dr-field">
            <label for="emp-hireDate">Fecha de alta <span class="req" aria-hidden="true">*</span></label>
            <input
              class="dr-input"
              id="emp-hireDate"
              type="date"
              formControlName="hireDate"
              aria-required="true"
            />
            @if (f['hireDate'].invalid && f['hireDate'].touched) {
              <span class="dr-error" role="alert">La fecha de alta es obligatoria.</span>
            }
          </div>

        </div>

        <!-- Footer -->
        <div class="dr-foot">
          <button type="button" class="dr-btn-cancel" (click)="onCancel()">
            {{ 'COMMON.CANCEL' | translate }}
          </button>
          <button type="submit" class="dr-btn-save" [disabled]="form.invalid || saving()">
            @if (saving()) {
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            } @else {
              <i class="pi pi-check" aria-hidden="true"></i>
            }
            Guardar empleado
          </button>
        </div>

      </form>
    </aside>
  `,
})
export class EmployeeFormComponent implements OnInit {
  readonly employee    = input<EmployeeDto | null>(null);
  readonly centers     = input<CenterDto[]>([]);
  readonly visible     = input<boolean>(false);
  readonly saving      = input<boolean>(false);
  readonly serverError = input<string | null>(null);

  readonly save   = output<CreateEmployeeDto | UpdateEmployeeDto>();
  readonly cancel = output<void>();

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    fullName:               ['', [Validators.required, Validators.maxLength(200)]],
    nif:                    ['', [Validators.maxLength(20)]],
    phone:                  [''],
    email:                  [''],
    category:               ['' as string, Validators.required],
    contractType:           ['' as string, Validators.required],
    contractedHoursPerWeek: [null as number | null],
    primaryCenterId:        ['', Validators.required],
    hireDate:               ['', Validators.required],
  });

  readonly categoryOptions     = EMPLOYEE_CATEGORY_VALUES.map(v => ({ label: CATEGORY_LABELS[v] ?? v, value: v }));
  readonly contractTypeOptions = CONTRACT_TYPE_VALUES.map(v => ({ label: CONTRACT_LABELS[v] ?? v, value: v }));

  readonly centerOptions = computed(() =>
    this.centers().map(c => ({ label: c.name, value: c.id })),
  );

  get f() { return this.form.controls; }

  constructor() {
    effect(() => {
      const isOpen = this.visible();
      if (isOpen) {
        untracked(() => this.onOpen());
      }
    });
  }

  ngOnInit(): void {
    this.form.get('contractType')?.valueChanges.subscribe(v => {
      const hoursCtrl = this.form.get('contractedHoursPerWeek')!;
      if (v === 'TIEMPO_PARCIAL') {
        hoursCtrl.setValidators([Validators.required, Validators.min(1), Validators.max(40)]);
      } else {
        hoursCtrl.clearValidators();
        hoursCtrl.setValue(null);
      }
      hoursCtrl.updateValueAndValidity({ emitEvent: false });
    });
  }

  private onOpen(): void {
    const emp = this.employee();
    if (emp) {
      this.form.patchValue({
        fullName:               `${emp.firstName} ${emp.lastName}`.trim(),
        nif:                    emp.nif ?? '',
        category:               emp.category,
        contractType:           emp.contractType,
        contractedHoursPerWeek: emp.contractedHoursPerWeek,
        primaryCenterId:        emp.primaryCenterId,
        hireDate:               emp.hireDate ? emp.hireDate.split('T')[0] : '',
      });
    } else {
      this.form.reset({
        fullName: '', nif: '', phone: '', email: '',
        category: '', contractType: '',
        contractedHoursPerWeek: null,
        primaryCenterId: this.centers()[0]?.id ?? '',
        hireDate: '',
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const nameParts = raw.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName  = nameParts.slice(1).join(' ') || firstName;

    const dto: CreateEmployeeDto = {
      firstName,
      lastName,
      category:     raw.category as CreateEmployeeDto['category'],
      contractType: raw.contractType as CreateEmployeeDto['contractType'],
      primaryCenterId: raw.primaryCenterId,
      hireDate:     raw.hireDate,
      ...(raw.nif ? { nif: raw.nif } : {}),
      ...(() => {
        const h = raw.contractedHoursPerWeek != null ? Number(raw.contractedHoursPerWeek) : null;
        return h !== null && !isNaN(h) && h > 0 ? { contractedHoursPerWeek: h } : {};
      })(),
    };
    this.save.emit(dto);
  }

  onCancel(): void {
    this.form.reset();
    this.cancel.emit();
  }
}
