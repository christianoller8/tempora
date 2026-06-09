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
    /* ── Host ───────────────────────────────────────────────────── */
    :host { display: block; max-width: 720px; }

    /* ── Page header ─────────────────────────────────────────────── */
    .page-header { margin-bottom: 1.5rem; }
    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    /* ── Banners ─────────────────────────────────────────────────── */
    .banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      margin-bottom: 1rem;
      border: 1px solid transparent;
    }
    .banner--success {
      background: var(--ok-soft);
      border-color: var(--ok);
      color: var(--ok);
    }
    .banner--error {
      background: var(--danger-soft);
      border-color: var(--danger);
      color: var(--danger);
    }

    /* ── Ruleset list card ───────────────────────────────────────── */
    .ruleset-list {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 1.25rem 1.375rem;
      margin-bottom: 1.5rem;
      transition: var(--transition);
    }
    .ruleset-list h3 {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-3);
      margin-bottom: 0.625rem;
    }
    .ruleset-list ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    .ruleset-list button {
      display: block;
      width: 100%;
      text-align: left;
      padding: 0.625rem 0.875rem;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-2);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      font-family: inherit;
    }
    .ruleset-list button:hover {
      background: var(--primary-soft);
      color: var(--text);
    }
    .ruleset-list button[aria-pressed="true"] {
      background: var(--primary-soft);
      border-color: var(--border-soft);
      color: var(--primary);
      font-weight: 600;
    }

    /* ── Form card ───────────────────────────────────────────────── */
    .form-card {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 1.375rem 1.5rem;
      transition: var(--transition);
    }
    .form-legend {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-soft);
    }
    fieldset { border: none; padding: 0; margin: 0; }

    /* ── Fields ──────────────────────────────────────────────────── */
    .field { margin-bottom: 1.125rem; }
    .field label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.375rem;
    }
    .field input[type="text"],
    .field input[type="number"],
    .field textarea {
      width: 100%;
      height: 44px;
      padding: 0 0.875rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.875rem;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
      transition: var(--transition);
    }
    .field input[type="number"] {
      width: 96px;
      text-align: center;
      font-weight: 700;
    }
    .field input:focus,
    .field textarea:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }
    .field textarea {
      height: auto;
      min-height: 80px;
      padding: 0.75rem 0.875rem;
      resize: vertical;
      line-height: 1.5;
    }
    .field .hint {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--accent-ico);
      margin-top: 0.25rem;
    }
    .field .error {
      font-size: 0.75rem;
      color: var(--danger);
      margin-top: 0.25rem;
      display: block;
    }
    .field-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--text);
      cursor: pointer;
    }

    /* ── Form actions ────────────────────────────────────────────── */
    .form-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-soft);
    }

    /* ── Dark mode overrides ─────────────────────────────────────── */
    :host-context([data-theme="dark"]) .ruleset-list,
    :host-context([data-theme="dark"]) .form-card {
      box-shadow: var(--shadow);
    }
    :host-context([data-theme="dark"]) .field input[type="text"],
    :host-context([data-theme="dark"]) .field input[type="number"],
    :host-context([data-theme="dark"]) .field textarea {
      background: var(--bg);
      border-color: var(--border);
      color: var(--text);
    }
    :host-context([data-theme="dark"]) .field input:focus,
    :host-context([data-theme="dark"]) .field textarea:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }
    :host-context([data-theme="dark"]) .ruleset-list button[aria-pressed="true"] {
      background: var(--primary-soft);
      border-color: var(--border-soft);
      color: var(--primary);
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
