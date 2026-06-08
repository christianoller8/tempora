import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/http/api.service';
import { firstValueFrom } from 'rxjs';

export interface RuleSetDto {
  id: string;
  name: string;
  isDefault: boolean;
  minRestHours: number;
  maxDailyHours: number;
  maxAnnualOvertime: number;
  weeklyRestDays: number;
  params: Record<string, unknown>;
}

/**
 * RulesetsComponent — admin form to create/update per-org RuleSet configuration.
 *
 * ADMIN role only (enforced by roleGuard at route level).
 * Satisfies FR-RULES-2, FR-RULES-4.
 */
@Component({
  selector: 'app-rulesets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, ButtonModule, InputTextModule, InputNumberModule, TextareaModule, MessageModule, TranslatePipe],
  styles: [`
    :host { display: block; max-width: 680px; }

    .page-header { margin-bottom: 1.75rem; }
    .page-title  { font-size: 1.375rem; font-weight: 700; color: var(--p-text-color); }

    .banner {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .banner--success {
      background: color-mix(in srgb, #22c55e 12%, transparent);
      border: 1px solid color-mix(in srgb, #22c55e 35%, transparent);
      color: #15803d;
    }

    .banner--error {
      background: color-mix(in srgb, var(--p-red-400, #f87171) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-400, #f87171) 30%, transparent);
      color: var(--p-red-400, #f87171);
    }

    .ruleset-list {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
    }

    .ruleset-list h3 {
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--p-text-color-secondary);
      margin-bottom: 0.75rem;
    }

    .ruleset-list ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .ruleset-list button {
      display: block;
      width: 100%;
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--p-text-color);
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }

    .ruleset-list button:hover {
      background: var(--p-surface-hover);
    }

    .ruleset-list button[aria-pressed="true"] {
      background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
      border-color: var(--p-primary-color);
      color: var(--p-primary-color);
      font-weight: 600;
    }

    .form-card {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .form-legend {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--p-text-color);
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    fieldset { border: none; padding: 0; margin: 0; }

    .field { margin-bottom: 1.125rem; }

    .field label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.375rem;
    }

    .field input[type="text"],
    .field input[type="number"],
    .field textarea {
      width: 100%;
      height: 38px;
      padding: 0 0.75rem;
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 8px;
      color: var(--p-text-color);
      font-size: 0.875rem;
      outline: none;
      font-family: inherit;
      box-sizing: border-box;
    }

    .field input:focus, .field textarea:focus { border-color: var(--p-primary-color); }

    .field textarea { height: auto; padding: 0.625rem 0.75rem; resize: vertical; }

    .field .hint {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 0.25rem;
    }

    .field .error {
      font-size: 0.75rem;
      color: var(--p-red-400, #f87171);
      margin-top: 0.25rem;
      display: block;
    }

    .field-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--p-text-color);
      cursor: pointer;
    }

    .form-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--p-surface-border);
    }
  `],
  template: `
    <section aria-labelledby="rulesets-title">
      <div class="page-header">
        <div class="page-title" id="rulesets-title">{{ 'ADMIN.RULESETS_TITLE' | translate }}</div>
      </div>

      @if (submitError()) {
        <div role="alert" class="banner banner--error">
          <i class="pi pi-exclamation-triangle"></i>
          {{ submitError() }}
        </div>
      }

      @if (submitSuccess()) {
        <div role="status" class="banner banner--success">
          <i class="pi pi-check-circle"></i>
          {{ 'ADMIN.TOAST_SAVED_SUMMARY' | translate }}
        </div>
      }

      <!-- Existing rule sets list -->
      @if (loading() && ruleSets().length === 0) {
        <p role="status" aria-live="polite" style="color:var(--p-text-color-secondary); font-size:0.875rem;">
          {{ 'COMMON.LOADING' | translate }}
        </p>
      }

      @if (ruleSets().length > 0) {
        <div class="ruleset-list" aria-label="Existing rule sets">
          <h3>{{ 'ADMIN.RULESETS_TITLE' | translate }}</h3>
          <ul>
            @for (rs of ruleSets(); track rs.id) {
              <li>
                <button
                  type="button"
                  (click)="selectRuleSet(rs)"
                  [attr.aria-pressed]="selectedId() === rs.id"
                >
                  {{ rs.name }}
                  @if (rs.isDefault) {
                    <span style="font-size:0.7rem; margin-left:0.5rem; opacity:0.6;">(default)</span>
                  }
                </button>
              </li>
            }
          </ul>
        </div>
      }

      <!-- Create / Edit form -->
      <div class="form-card">
        <div class="form-legend">
          {{ selectedId() ? ('ADMIN.EDIT_RULESET' | translate) : ('ADMIN.ADD_RULESET' | translate) }}
        </div>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <fieldset>
            <div class="field">
              <label for="name">{{ 'ADMIN.RULESET_NAME' | translate }} <span aria-hidden="true">*</span></label>
              <input pInputText id="name" type="text" formControlName="name" aria-required="true" />
              @if (f['name']?.invalid && f['name']?.touched) {
                <span class="error" role="alert">{{ 'COMMON.REQUIRED' | translate }}</span>
              }
            </div>

            <div class="field">
              <label class="field-checkbox">
                <input type="checkbox" formControlName="isDefault" />
                {{ 'ADMIN.RULESET_NAME' | translate }}
              </label>
            </div>

            <div class="field">
              <label for="minRestHours">{{ 'ADMIN.RULESET_MIN_REST' | translate }}</label>
              <input id="minRestHours" type="number" formControlName="minRestHours" min="0" step="0.5" aria-describedby="minRestHours-hint" />
              <p id="minRestHours-hint" class="hint">Mínimo legal: 12h (Art. 34.3 ET)</p>
            </div>

            <div class="field">
              <label for="maxDailyHours">{{ 'ADMIN.RULESET_MAX_HOURS' | translate }}</label>
              <input id="maxDailyHours" type="number" formControlName="maxDailyHours" min="0" step="0.5" aria-describedby="maxDailyHours-hint" />
              <p id="maxDailyHours-hint" class="hint">Máximo legal: 9h (Art. 34.3 ET)</p>
            </div>

            <div class="field">
              <label for="maxAnnualOvertime">{{ 'ADMIN.RULESET_MAX_WEEK' | translate }}</label>
              <input id="maxAnnualOvertime" type="number" formControlName="maxAnnualOvertime" min="0" aria-describedby="maxAnnualOvertime-hint" />
              <p id="maxAnnualOvertime-hint" class="hint">Máximo legal: 80h (Art. 35.2 ET)</p>
            </div>

            <div class="field">
              <label for="weeklyRestDays">{{ 'ADMIN.RULESET_MIN_REST' | translate }}</label>
              <input id="weeklyRestDays" type="number" formControlName="weeklyRestDays" min="0" step="0.5" aria-describedby="weeklyRestDays-hint" />
              <p id="weeklyRestDays-hint" class="hint">Mínimo legal: 1,5 días (Art. 37.1 ET)</p>
            </div>

            <div class="field">
              <label for="params">{{ 'ADMIN.TITLE' | translate }}</label>
              <textarea pTextarea id="params" formControlName="params" rows="4" placeholder='{"key": "value"}' aria-describedby="params-hint"></textarea>
              <p id="params-hint" class="hint">Parámetros específicos del convenio en formato JSON.</p>
              @if (f['params']?.errors?.['jsonInvalid']) {
                <span class="error" role="alert">{{ 'COMMON.ERROR' | translate }}</span>
              }
            </div>

            <div class="form-actions">
              <p-button
                type="submit"
                [label]="selectedId() ? ('ADMIN.EDIT_RULESET' | translate) : ('ADMIN.ADD_RULESET' | translate)"
                icon="pi pi-check"
                [loading]="loading()"
                [disabled]="form.invalid"
              />
              @if (selectedId()) {
                <p-button
                  type="button"
                  [label]="'COMMON.CANCEL' | translate"
                  severity="secondary"
                  [text]="true"
                  (onClick)="clearSelection()"
                />
              }
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  `,
})
export class RulesetsComponent implements OnInit {
  private readonly api       = inject(ApiService);
  private readonly fb        = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  protected readonly ruleSets = signal<RuleSetDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitSuccess = signal(false);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    isDefault: [false],
    minRestHours: [12, [Validators.required, Validators.min(0)]],
    maxDailyHours: [9, [Validators.required, Validators.min(0)]],
    maxAnnualOvertime: [80, [Validators.required, Validators.min(0)]],
    weeklyRestDays: [1.5, [Validators.required, Validators.min(0)]],
    params: ['{}'],
  });

  get f() {
    return this.form.controls;
  }

  async ngOnInit(): Promise<void> {
    await this.loadRuleSets();
  }

  private async loadRuleSets(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<{ data: RuleSetDto[] }>('/rule-sets'),
      );
      this.ruleSets.set(res.data);
    } catch {
      this.submitError.set(this.translate.instant('ADMIN.TOAST_ERROR_DETAIL'));
    } finally {
      this.loading.set(false);
    }
  }

  protected selectRuleSet(rs: RuleSetDto): void {
    this.selectedId.set(rs.id);
    this.submitSuccess.set(false);
    this.submitError.set(null);
    this.form.setValue({
      name: rs.name,
      isDefault: rs.isDefault,
      minRestHours: rs.minRestHours,
      maxDailyHours: rs.maxDailyHours,
      maxAnnualOvertime: rs.maxAnnualOvertime,
      weeklyRestDays: rs.weeklyRestDays,
      params: JSON.stringify(rs.params, null, 2),
    });
  }

  protected clearSelection(): void {
    this.selectedId.set(null);
    this.form.reset({
      name: '',
      isDefault: false,
      minRestHours: 12,
      maxDailyHours: 9,
      maxAnnualOvertime: 80,
      weeklyRestDays: 1.5,
      params: '{}',
    });
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Validate JSON params field.
    const rawParams = this.form.getRawValue().params;
    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = JSON.parse(rawParams) as Record<string, unknown>;
    } catch {
      this.f['params']?.setErrors({ jsonInvalid: true });
      return;
    }

    this.loading.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(false);

    const { name, isDefault, minRestHours, maxDailyHours, maxAnnualOvertime, weeklyRestDays } =
      this.form.getRawValue();
    const payload = { name, isDefault, minRestHours, maxDailyHours, maxAnnualOvertime, weeklyRestDays, params: parsedParams };

    try {
      const id = this.selectedId();
      if (id) {
        await firstValueFrom(this.api.patch<{ data: RuleSetDto }>(`/rule-sets/${id}`, payload));
      } else {
        await firstValueFrom(this.api.post<{ data: RuleSetDto }>('/rule-sets', payload));
      }
      this.submitSuccess.set(true);
      await this.loadRuleSets();
      this.clearSelection();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : this.translate.instant('ADMIN.TOAST_ERROR_DETAIL');
      this.submitError.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
