import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { TimeStore } from '../data-access/time.store';
import { TimeApi } from '../data-access/time.api';
import { ClockWidgetComponent } from '../ui/clock-widget.component';
import { firstValueFrom } from 'rxjs';

/**
 * ClockComponent — smart container for employee time tracking.
 *
 * Injects TimeStore, renders ClockWidgetComponent, and handles
 * correction request form (POST /time-corrections).
 * [TEST]
 */
@Component({
  selector: 'app-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClockWidgetComponent],
  template: `
    <section aria-label="Time tracking">
      <app-clock-widget
        [currentEntry]="store.currentEntry()"
        [isClocking]="store.isClocking()"
        [error]="store.error()"
        (clockIn)="onClockIn()"
        (clockOut)="onClockOut()"
      />

      <!-- Correction request form -->
      <div class="correction-section" aria-label="Request time correction">
        <button
          type="button"
          class="btn btn-link"
          (click)="showCorrectionForm.set(!showCorrectionForm())"
        >
          {{ showCorrectionForm() ? 'Cancel' : 'Request a correction' }}
        </button>

        @if (showCorrectionForm()) {
          <form (ngSubmit)="onSubmitCorrection()" aria-label="Time correction form">
            <div class="form-group">
              <label for="justification">Justification</label>
              <textarea
                id="justification"
                [value]="justification()"
                (input)="justification.set($any($event.target).value)"
                required
                rows="3"
                aria-required="true"
              ></textarea>
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="!justification().trim()">
              Submit Correction
            </button>
            @if (correctionError()) {
              <p role="alert" class="error-message">{{ correctionError() }}</p>
            }
            @if (correctionSuccess()) {
              <p role="status" class="success-message">Correction request submitted.</p>
            }
          </form>
        }
      </div>
    </section>
  `,
})
export class ClockComponent {
  protected readonly store = inject(TimeStore) as unknown as TimeStore;
  private readonly api = inject(TimeApi);

  readonly showCorrectionForm = signal(false);
  readonly justification = signal('');
  readonly correctionError = signal<string | null>(null);
  readonly correctionSuccess = signal(false);

  onClockIn(): void {
    void this.store.clockIn();
  }

  onClockOut(): void {
    void this.store.clockOut();
  }

  async onSubmitCorrection(): Promise<void> {
    const entry = this.store.currentEntry();
    if (!entry) return;

    this.correctionError.set(null);
    this.correctionSuccess.set(false);

    try {
      await firstValueFrom(
        this.api.createCorrection({
          timeEntryId: entry.id,
          justification: this.justification(),
        }),
      );
      this.correctionSuccess.set(true);
      this.justification.set('');
      this.showCorrectionForm.set(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit correction';
      this.correctionError.set(message);
    }
  }
}
