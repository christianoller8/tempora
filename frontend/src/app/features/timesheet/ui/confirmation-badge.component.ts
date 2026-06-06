import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * ConfirmationBadgeComponent — presentational status pill.
 *
 * Shows a colored badge indicating whether a timesheet month is confirmed
 * or still pending. Purely presentational: accepts a single `confirmed` input.
 * WCAG-AA: sufficient color contrast and an aria-label fallback.
 */
@Component({
  selector: 'app-confirmation-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
    }

    .badge--confirmed {
      background: color-mix(in srgb, #22c55e 18%, transparent);
      color: #15803d;
      border: 1px solid color-mix(in srgb, #22c55e 40%, transparent);
    }

    .badge--pending {
      background: color-mix(in srgb, #f59e0b 18%, transparent);
      color: #b45309;
      border: 1px solid color-mix(in srgb, #f59e0b 40%, transparent);
    }
  `],
  template: `
    @if (confirmed()) {
      <span
        class="badge badge--confirmed"
        role="status"
        [attr.aria-label]="'Timesheet confirmed'"
      >
        <i class="pi pi-check" aria-hidden="true"></i>
        Confirmed
      </span>
    } @else {
      <span
        class="badge badge--pending"
        role="status"
        [attr.aria-label]="'Timesheet pending confirmation'"
      >
        <i class="pi pi-clock" aria-hidden="true"></i>
        Pending
      </span>
    }
  `,
})
export class ConfirmationBadgeComponent {
  /** Whether the timesheet month has been confirmed by the employee. */
  readonly confirmed = input<boolean>(false);
}
