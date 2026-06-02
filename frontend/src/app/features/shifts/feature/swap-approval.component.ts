import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShiftsApi } from '../data-access/shifts.api';
import type { SwapRequest, RuleCheckResult } from '../data-access/shifts.api';

// ---------------------------------------------------------------------------
// SwapApprovalComponent — manager approval queue for pending swap requests.
// Displays pending swaps; allows approve/reject with rule violation feedback.
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-swap-approval',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <section aria-labelledby="swap-approval-heading">
      <h2 id="swap-approval-heading">Swap Request Approvals</h2>

      @if (loading()) {
        <p role="status" aria-live="polite">Loading pending requests...</p>
      }

      @if (error()) {
        <div role="alert" class="error-banner" aria-live="assertive">{{ error() }}</div>
      }

      @if (violations().length > 0) {
        <div role="alert" class="violations-banner" aria-live="assertive">
          <strong>Swap blocked by rule violations:</strong>
          <ul>
            @for (v of violations(); track v.code) {
              <li>{{ v.message }}</li>
            }
          </ul>
          <button type="button" (click)="clearViolations()" aria-label="Dismiss violations">
            Dismiss
          </button>
        </div>
      }

      @if (pendingSwaps().length === 0 && !loading()) {
        <p>No pending swap requests.</p>
      }

      @if (pendingSwaps().length > 0) {
        <table aria-label="Pending swap requests">
          <thead>
            <tr>
              <th scope="col">Requester Assignment</th>
              <th scope="col">Target Assignment</th>
              <th scope="col">Reason</th>
              <th scope="col">Submitted</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (swap of pendingSwaps(); track swap.id) {
              <tr>
                <td>{{ swap.requesterAssignmentId }}</td>
                <td>{{ swap.targetAssignmentId ?? 'Open' }}</td>
                <td>{{ swap.reason ?? '—' }}</td>
                <td>{{ swap.createdAt | date:'shortDate' }}</td>
                <td class="actions">
                  <button
                    type="button"
                    class="btn-approve"
                    (click)="approve(swap.id)"
                    [disabled]="processing() === swap.id"
                    [attr.aria-label]="'Approve swap request ' + swap.id">
                    {{ processing() === swap.id ? 'Processing...' : 'Approve' }}
                  </button>
                  <button
                    type="button"
                    class="btn-reject"
                    (click)="reject(swap.id)"
                    [disabled]="processing() === swap.id"
                    [attr.aria-label]="'Reject swap request ' + swap.id">
                    Reject
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
