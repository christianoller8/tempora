import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AbsencesStore } from '../data-access/absences.store';

type AbsenceType = 'VACACIONES' | 'IT' | 'PERMISO_RETRIBUIDO' | 'AUSENCIA_INJUSTIFICADA' | 'LACTANCIA' | 'REDUCCION_JORNADA';

const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  VACACIONES: 'Vacaciones',
  IT: 'Incapacidad Temporal (IT)',
  PERMISO_RETRIBUIDO: 'Permiso Retribuido',
  AUSENCIA_INJUSTIFICADA: 'Ausencia Injustificada',
  LACTANCIA: 'Lactancia',
  REDUCCION_JORNADA: 'Reducción de Jornada',
};

const ABSENCE_TYPES = Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[];

/**
 * AbsenceRequestComponent — smart container for creating absence requests.
 *
 * - Reactive Form: type selector, date range, optional cause (IT only).
 * - Calls AbsencesStore.createAbsence() on submit.
 * - Shows validation errors (overlap, balance exhausted) from API response.
 */
@Component({
  selector: 'app-absence-request',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <section aria-labelledby="absence-request-title">
      <h2 id="absence-request-title">Request Absence</h2>

      @if (submitError()) {
        <div role="alert" class="error-banner">
          <p>{{ submitError() }}</p>
        </div>
      }

      @if (submitSuccess()) {
        <div role="status" class="success-banner">
          <p>Absence request submitted successfully.</p>
        </div>
      }

      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        novalidate
        aria-label="Absence request form"
      >
        <!-- Type selector -->
        <div class="field">
          <label for="type">Absence type <span aria-hidden="true">*</span></label>
          <select id="type" formControlName="type" aria-required="true">
            @for (type of absenceTypes; track type) {
              <option [value]="type">{{ typeLabels[type] }}</option>
            }
          </select>
          @if (f['type']?.invalid && f['type']?.touched) {
            <span class="error" role="alert">Please select an absence type.</span>
          }
        </div>

        <!-- Start date -->
        <div class="field">
          <label for="startDate">Start date <span aria-hidden="true">*</span></label>
          <input
            id="startDate"
            type="date"
            formControlName="startDate"
            aria-required="true"
          />
          @if (f['startDate']?.invalid && f['startDate']?.touched) {
            <span class="error" role="alert">Start date is required.</span>
          }
        </div>

        <!-- End date -->
        <div class="field">
          <label for="endDate">End date <span aria-hidden="true">*</span></label>
          <input
            id="endDate"
            type="date"
            formControlName="endDate"
            aria-required="true"
          />
          @if (f['endDate']?.invalid && f['endDate']?.touched) {
            <span class="error" role="alert">End date is required.</span>
          }
        </div>

        <!-- Cause field — shown only for IT type -->
        @if (isItType()) {
          <div class="field">
            <label for="cause">Medical cause</label>
            <textarea
              id="cause"
              formControlName="cause"
              rows="3"
              aria-label="Medical cause (confidential — GDPR protected)"
              placeholder="Optional: describe the medical cause"
            ></textarea>
            <p class="hint">This information is protected under GDPR Art. 9 and stored encrypted.</p>
          </div>
        }

        <button type="submit" [disabled]="form.invalid || store.loading()">
          {{ store.loading() ? 'Submitting…' : 'Submit Request' }}
        </button>
      </form>
    </section>
  `,
})
export class AbsenceRequestComponent {
  protected readonly store = inject(AbsencesStore) as unknown as AbsencesStore;
  private readonly fb = inject(FormBuilder);

  protected readonly absenceTypes = ABSENCE_TYPES;
  protected readonly typeLabels = ABSENCE_TYPE_LABELS;
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitSuccess = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    type: ['VACACIONES' as AbsenceType, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    cause: [''],
  });

  get f() {
    return this.form.controls;
  }

  protected isItType(): boolean {
    return this.form.getRawValue().type === 'IT';
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitSuccess.set(false);

    const { type, startDate, endDate, cause } = this.form.getRawValue();

    try {
      await this.store.createAbsence({
        type,
        startDate,
        endDate,
        ...(type === 'IT' && cause ? { cause } : {}),
      });
      this.submitSuccess.set(true);
      this.form.reset({ type: 'VACACIONES', startDate: '', endDate: '', cause: '' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit absence request';
      this.submitError.set(message);
    }
  }
}
