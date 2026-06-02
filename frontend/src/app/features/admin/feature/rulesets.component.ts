import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <section aria-labelledby="rulesets-title">
      <h2 id="rulesets-title">Rule Set Configuration</h2>

      @if (submitError()) {
        <div role="alert" class="error-banner">
          <p>{{ submitError() }}</p>
        </div>
      }

      @if (submitSuccess()) {
        <div role="status" class="success-banner">
          <p>Rule set saved successfully.</p>
        </div>
      }

      @if (loading()) {
        <p role="status" aria-live="polite">Loading rule sets…</p>
      }

      <!-- Existing rule sets list -->
      @if (ruleSets().length > 0) {
        <div class="ruleset-list" aria-label="Existing rule sets">
          <h3>Existing Rule Sets</h3>
          <ul>
            @for (rs of ruleSets(); track rs.id) {
              <li>
                <button
                  type="button"
                  (click)="selectRuleSet(rs)"
                  [attr.aria-pressed]="selectedId() === rs.id"
                >
                  {{ rs.name }} {{ rs.isDefault ? '(default)' : '' }}
                </button>
              </li>
            }
          </ul>
        </div>
      }

      <!-- Create / Edit form -->
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        novalidate
        aria-label="Rule set configuration form"
      >
        <fieldset>
          <legend>{{ selectedId() ? 'Edit Rule Set' : 'Create Rule Set' }}</legend>

          <div class="field">
            <label for="name">Name <span aria-hidden="true">*</span></label>
            <input id="name" type="text" formControlName="name" aria-required="true" />
            @if (f['name']?.invalid && f['name']?.touched) {
              <span class="error" role="alert">Name is required.</span>
            }
          </div>

          <div class="field">
            <label>
              <input type="checkbox" formControlName="isDefault" />
              Default rule set
            </label>
          </div>

          <div class="field">
            <label for="minRestHours">Min rest between shifts (hours)</label>
            <input
              id="minRestHours"
              type="number"
              formControlName="minRestHours"
              min="0"
              step="0.5"
              aria-describedby="minRestHours-hint"
            />
            <p id="minRestHours-hint" class="hint">Statutory minimum: 12h (Art. 34.3 ET)</p>
          </div>

          <div class="field">
            <label for="maxDailyHours">Max daily hours</label>
            <input
              id="maxDailyHours"
              type="number"
              formControlName="maxDailyHours"
              min="0"
              step="0.5"
              aria-describedby="maxDailyHours-hint"
            />
            <p id="maxDailyHours-hint" class="hint">Statutory maximum: 9h (Art. 34.3 ET)</p>
          </div>

          <div class="field">
            <label for="maxAnnualOvertime">Max annual overtime (hours)</label>
            <input
              id="maxAnnualOvertime"
              type="number"
              formControlName="maxAnnualOvertime"
              min="0"
              aria-describedby="maxAnnualOvertime-hint"
            />
            <p id="maxAnnualOvertime-hint" class="hint">Statutory cap: 80h (Art. 35.2 ET)</p>
          </div>

          <div class="field">
            <label for="weeklyRestDays">Weekly rest days</label>
            <input
              id="weeklyRestDays"
              type="number"
              formControlName="weeklyRestDays"
              min="0"
              step="0.5"
              aria-describedby="weeklyRestDays-hint"
            />
            <p id="weeklyRestDays-hint" class="hint">Statutory minimum: 1.5 days (Art. 37.1 ET)</p>
          </div>

          <div class="field">
            <label for="params">Additional parameters (JSON)</label>
            <textarea
              id="params"
              formControlName="params"
              rows="4"
              placeholder='{"key": "value"}'
              aria-describedby="params-hint"
            ></textarea>
            <p id="params-hint" class="hint">Convenio-specific overrides in JSON format.</p>
            @if (f['params']?.errors?.['jsonInvalid']) {
              <span class="error" role="alert">Invalid JSON format.</span>
            }
          </div>

          <div class="form-actions">
            <button type="submit" [disabled]="form.invalid || loading()">
              {{ loading() ? 'Saving…' : (selectedId() ? 'Update Rule Set' : 'Create Rule Set') }}
            </button>
            @if (selectedId()) {
              <button type="button" (click)="clearSelection()">Cancel edit</button>
            }
          </div>
        </fieldset>
      </form>
    </section>
  `,
})
export class RulesetsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

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
      this.submitError.set('Failed to load rule sets.');
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
      const message = err instanceof Error ? err.message : 'Failed to save rule set';
      this.submitError.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
