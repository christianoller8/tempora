import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import type { AbsenceBalanceDto } from '../data-access/absences.api';

/**
 * AbsenceBalanceComponent — presentational component displaying vacation balance.
 *
 * Pure input()/output() — no store injection.
 * The smart container (AbsenceRequestComponent or a feature shell) injects
 * AbsencesStore and passes the balance signal down as an input.
 *
 * Satisfies FR-ABS-7.
 */
@Component({
  selector: 'app-absence-balance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="absence-balance" aria-label="Vacation balance">
      @if (balance()) {
        <dl>
          <div class="balance-item">
            <dt>Entitled days</dt>
            <dd>{{ balance()!.entitled }}</dd>
          </div>
          <div class="balance-item">
            <dt>Days used</dt>
            <dd>{{ balance()!.used }}</dd>
          </div>
          <div class="balance-item" [class.balance-low]="isLow()">
            <dt>Remaining</dt>
            <dd>
              {{ balance()!.remaining }}
              @if (isLow()) {
                <span class="low-badge" aria-label="Low balance warning">Low</span>
              }
            </dd>
          </div>
        </dl>
      } @else {
        <p>Balance not available.</p>
      }
    </div>
  `,
})
export class AbsenceBalanceComponent {
  readonly balance = input<AbsenceBalanceDto | null>(null);

  // Computed: low balance warning when fewer than 5 days remain.
  protected readonly isLow = computed(() => {
    const b = this.balance();
    return b !== null && b.remaining < 5;
  });
}
