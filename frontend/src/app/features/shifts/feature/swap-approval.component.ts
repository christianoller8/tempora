import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ShiftsApi } from '../data-access/shifts.api';
import type { SwapRequest, RuleCheckResult } from '../data-access/shifts.api';

// ---------------------------------------------------------------------------
// SwapApprovalComponent — manager approval queue for pending swap requests.
// Displays pending swaps; allows approve/reject with rule violation feedback.
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-swap-approval',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <section aria-labelledby="swap-approval-heading">
      <h2 id="swap-approval-heading">{{ 'SHIFTS.SWAP_APPROVAL_TITLE' | translate }}</h2>

      @if (loading()) {
        <p role="status" aria-live="polite">{{ 'COMMON.LOADING' | translate }}</p>
      }

      @if (error()) {
        <div role="alert" class="error-banner" aria-live="assertive">{{ error() }}</div>
      }

      @if (violations().length > 0) {
        <div role="alert" class="violations-banner" aria-live="assertive">
          <strong>{{ 'SHIFTS.RULE_VIOLATION' | translate }}</strong>
          <ul>
            @for (v of violations(); track v.code) {
              <li>{{ v.message }}</li>
            }
          </ul>
          <button type="button" (click)="clearViolations()" [attr.aria-label]="'COMMON.CLOSE' | translate">
            {{ 'COMMON.CLOSE' | translate }}
          </button>
        </div>
      }

      @if (pendingSwaps().length === 0 && !loading()) {
        <p>{{ 'SHIFTS.SWAP_EMPTY' | translate }}</p>
      }

      @if (pendingSwaps().length > 0) {
        <table aria-label="Pending swap requests">
          <thead>
            <tr>
              <th scope="col">{{ 'SHIFTS.SWAP_FROM_LABEL' | translate }}</th>
              <th scope="col">{{ 'SHIFTS.SWAP_TO_LABEL' | translate }}</th>
              <th scope="col">{{ 'SHIFTS.SWAP_REASON_LABEL' | translate }}</th>
              <th scope="col">{{ 'COMMON.DATE_FROM' | translate }}</th>
              <th scope="col">{{ 'COMMON.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (swap of pendingSwaps(); track swap.id) {
              <tr>
                <td>{{ swap.requesterAssignmentId }}</td>
                <td>{{ swap.targetAssignmentId ?? ('SHIFTS.NO_SHIFT' | translate) }}</td>
                <td>{{ swap.reason ?? '—' }}</td>
                <td>{{ swap.createdAt | date:'shortDate' }}</td>
                <td class="actions">
                  <button
                    type="button"
                    class="btn-approve"
                    (click)="approve(swap.id)"
                    [disabled]="processing() === swap.id"
                    [attr.aria-label]="'COMMON.APPROVE' | translate">
                    {{ processing() === swap.id ? ('COMMON.LOADING' | translate) : ('COMMON.APPROVE' | translate) }}
                  </button>
                  <button
                    type="button"
                    class="btn-reject"
                    (click)="reject(swap.id)"
                    [disabled]="processing() === swap.id"
                    [attr.aria-label]="'COMMON.REJECT' | translate">
                    {{ 'COMMON.REJECT' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [`
    section { padding: 1rem; }
    h2 { font-size: 1.25rem; margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; font-size: 0.875rem; }
    th { background: #f8fafc; font-weight: 600; }
    .actions { display: flex; gap: 0.5rem; }
    .btn-approve { padding: 0.25rem 0.75rem; background: #22c55e; color: white; border: none; border-radius: 0.25rem; cursor: pointer; }
    .btn-reject { padding: 0.25rem 0.75rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error-banner { background: #fee2e2; border: 1px solid #ef4444; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; color: #991b1b; }
    .violations-banner { background: #fef9c3; border: 1px solid #eab308; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; }
    ul { margin: 0.5rem 0 0 1rem; }
  `],
})
export class SwapApprovalComponent implements OnInit {
  private readonly api = inject(ShiftsApi);

  protected readonly pendingSwaps = signal<SwapRequest[]>([]);
  protected readonly loading = signal(false);
  protected readonly processing = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly violations = signal<RuleCheckResult[]>([]);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listSwaps({ status: 'REQUESTED' }).subscribe({
      next: (swaps) => {
        this.pendingSwaps.set(swaps);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Failed to load swap requests');
        this.loading.set(false);
      },
    });
  }

  protected approve(swapId: string): void {
    this.processing.set(swapId);
    this.violations.set([]);
    this.error.set(null);

    this.api.approveSwap(swapId).subscribe({
      next: (result) => {
        this.pendingSwaps.update((list) => list.filter((s) => s.id !== swapId));
        this.processing.set(null);
        // Show warnings from rule engine if any.
        if (result.warnings.length > 0) {
          // Warn-only violations still allow the swap; show them as info.
          this.violations.set(result.warnings.filter((w) => w.type === 'warn'));
        }
      },
      error: (err: unknown) => {
        // Extract rule violations from 422 error body if present.
        const errObj = err as Record<string, unknown>;
        if (
          errObj['status'] === 422 &&
          Array.isArray(errObj['error'] as unknown)
        ) {
          this.violations.set(errObj['error'] as RuleCheckResult[]);
        } else {
          this.error.set(err instanceof Error ? err.message : 'Approval failed');
        }
        this.processing.set(null);
      },
    });
  }

  protected reject(swapId: string): void {
    this.processing.set(swapId);
    this.api.rejectSwap(swapId).subscribe({
      next: () => {
        this.pendingSwaps.update((list) => list.filter((s) => s.id !== swapId));
        this.processing.set(null);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Rejection failed');
        this.processing.set(null);
      },
    });
  }

  protected clearViolations(): void {
    this.violations.set([]);
  }
}
