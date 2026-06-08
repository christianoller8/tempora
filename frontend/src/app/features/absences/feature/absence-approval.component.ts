import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { AbsencesStore } from '../data-access/absences.store';
import type { AbsenceDto } from '../data-access/absences.api';

/**
 * AbsenceApprovalComponent — manager approval queue.
 *
 * Shows PENDING absences in a table; MANAGER/ADMIN can approve or reject.
 * Route-level roleGuard enforces visibility — the component itself is
 * presentation-only for role enforcement to stay in one place.
 */
@Component({
  selector: 'app-absence-approval',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <section aria-labelledby="approval-queue-title">
      <h2 id="approval-queue-title">{{ 'ABSENCES.APPROVAL_TITLE' | translate }}</h2>

      @if (store.loading()) {
        <p role="status" aria-live="polite">Loading…</p>
      }

      @if (store.error()) {
        <div role="alert" class="error-banner">
          <p>{{ store.error() }}</p>
        </div>
      }

      @if (!store.loading() && pendingAbsences().length === 0) {
        <p>{{ 'ABSENCES.EMPTY_REQUESTS' | translate }}</p>
      }

      @if (pendingAbsences().length > 0) {
        <table aria-label="Pending absence requests">
          <caption>Pending absence requests requiring approval</caption>
          <thead>
            <tr>
              <th scope="col">{{ 'ABSENCES.TABLE_EMPLOYEE' | translate }}</th>
              <th scope="col">{{ 'ABSENCES.TABLE_TYPE' | translate }}</th>
              <th scope="col">{{ 'ABSENCES.TABLE_FROM' | translate }}</th>
              <th scope="col">{{ 'ABSENCES.TABLE_TO' | translate }}</th>
              <th scope="col">{{ 'ABSENCES.TABLE_STATUS' | translate }}</th>
              <th scope="col">{{ 'ABSENCES.TABLE_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (absence of pendingAbsences(); track absence.id) {
              <tr>
                <td>{{ absence.employeeId }}</td>
                <td>{{ absence.type }}</td>
                <td>{{ absence.startDate }}</td>
                <td>{{ absence.endDate }}</td>
                <td>{{ absence.status }}</td>
                <td>
                  <button
                    type="button"
                    (click)="onApprove(absence)"
                    [disabled]="store.loading()"
                    aria-label="Approve absence for employee {{ absence.employeeId }}"
                  >
                    {{ 'COMMON.APPROVE' | translate }}
                  </button>
                  <button
                    type="button"
                    (click)="onReject(absence)"
                    [disabled]="store.loading()"
                    [attr.aria-label]="'COMMON.REJECT' | translate"
                  >
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
})
export class AbsenceApprovalComponent implements OnInit {
  protected readonly store = inject(AbsencesStore) as unknown as AbsencesStore;

  ngOnInit(): void {
    this.store.loadAbsences({ status: 'PENDING' });
  }

  protected pendingAbsences(): AbsenceDto[] {
    return this.store.absences().filter((a) => a.status === 'PENDING');
  }

  protected async onApprove(absence: AbsenceDto): Promise<void> {
    await this.store.approveAbsence(absence.id);
  }

  protected async onReject(absence: AbsenceDto): Promise<void> {
    await this.store.rejectAbsence(absence.id);
  }
}
