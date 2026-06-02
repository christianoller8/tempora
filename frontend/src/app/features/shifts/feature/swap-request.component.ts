import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ShiftsApi } from '../data-access/shifts.api';
import type { ShiftAssignment, SwapRequest } from '../data-access/shifts.api';

// ---------------------------------------------------------------------------
// SwapRequestComponent — employee form to request a shift swap.
// Selects their own assignment and a target assignment, submits the request.
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-swap-request',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section aria-labelledby="swap-request-heading">
      <h2 id="swap-request-heading">Request Shift Swap</h2>

      @if (successMessage()) {
        <div role="status" class="success-banner" aria-live="polite">
          {{ successMessage() }}
        </div>
      }

      @if (errorMessage()) {
        <div role="alert" class="error-banner" aria-live="assertive">
          {{ errorMessage() }}
        </div>
      }

      <form
        [formGroup]="swapForm"
        (ngSubmit)="submit()"
        aria-label="Swap request form"
        novalidate>

        <div class="field">
          <label for="requester-assignment">Your Assignment</label>
          <select
            id="requester-assignment"
            formControlName="requesterAssignmentId"
            aria-required="true"
            [attr.aria-invalid]="requesterControl.invalid && requesterControl.touched">
            <option value="">Select your assignment...</option>
            @for (a of myAssignments(); track a.id) {
              <option [value]="a.id">{{ a.date }} — {{ a.shiftTemplateId }}</option>
            }
          </select>
          @if (requesterControl.invalid && requesterControl.touched) {
            <span role="alert" class="field-error">Please select your assignment</span>
          }
        </div>

        <div class="field">
          <label for="target-assignment">Target Assignment</label>
          <select
            id="target-assignment"
            formControlName="targetAssignmentId">
            <option value="">Open swap (no specific target)...</option>
            @for (a of availableAssignments(); track a.id) {
              <option [value]="a.id">{{ a.date }} — {{ a.employeeId }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="reason">Reason (optional)</label>
          <textarea
            id="reason"
            formControlName="reason"
            rows="3"
            maxlength="500"
            placeholder="Provide a reason for the swap request...">
          </textarea>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            [disabled]="swapForm.invalid || submitting()"
            aria-label="Submit swap request">
            @if (submitting()) { Submitting... } @else { Request Swap }
          </button>
        </div>
      </form>

      <!-- Submitted swaps list -->
      @if (submittedSwaps().length > 0) {
        <div class="submitted-swaps" aria-label="Your submitted swap requests">
          <h3>Your Swap Requests</h3>
          <ul>
            @for (swap of submittedSwaps(); track swap.id) {
              <li>
                <span [attr.aria-label]="'Swap status: ' + swap.status">
                  {{ swap.requesterAssignmentId }} → {{ swap.targetAssignmentId ?? 'Open' }}
                  — <strong>{{ swap.status }}</strong>
                </span>
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styles: [`
    section { padding: 1rem; max-width: 32rem; }
    h2 { font-size: 1.25rem; margin-bottom: 1rem; }
    h3 { font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem; }
    .field label { font-weight: 600; font-size: 0.875rem; }
    .field select, .field textarea { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; }
    .field-error { color: #dc2626; font-size: 0.75rem; }
    .form-actions { margin-top: 1rem; }
    button[type="submit"] { padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .success-banner { background: #dcfce7; border: 1px solid #16a34a; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; }
    .error-banner { background: #fee2e2; border: 1px solid #ef4444; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; color: #991b1b; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb; }
  `],
})
export class SwapRequestComponent implements OnInit {
  private readonly api = inject(ShiftsApi);
  private readonly fb = inject(FormBuilder);

  protected readonly myAssignments = signal<ShiftAssignment[]>([]);
  protected readonly availableAssignments = signal<ShiftAssignment[]>([]);
  protected readonly submittedSwaps = signal<SwapRequest[]>([]);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly swapForm = this.fb.group({
    requesterAssignmentId: ['', Validators.required],
    targetAssignmentId: [''],
    reason: ['', Validators.maxLength(500)],
  });

  protected get requesterControl() {
    return this.swapForm.controls['requesterAssignmentId'];
  }

  ngOnInit(): void {
    // Load current user's pending swaps.
    this.api.listSwaps({ status: 'REQUESTED' }).subscribe({
      next: (swaps) => this.submittedSwaps.set(swaps),
    });
  }

  protected submit(): void {
    if (this.swapForm.invalid) return;

    const value = this.swapForm.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.api
      .requestSwap({
        requesterAssignmentId: value.requesterAssignmentId!,
        targetAssignmentId: value.targetAssignmentId ?? undefined,
        reason: value.reason ?? undefined,
      })
      .subscribe({
        next: (swap) => {
          this.submittedSwaps.update((list) => [swap, ...list]);
          this.swapForm.reset();
          this.successMessage.set('Swap request submitted successfully.');
          this.submitting.set(false);
        },
        error: (err: unknown) => {
          const msg =
            err !== null && typeof err === 'object' && 'error' in err
              ? String((err as Record<string, unknown>)['message'] ?? 'Request failed')
              : 'Request failed';
          this.errorMessage.set(msg);
          this.submitting.set(false);
        },
      });
  }
}
