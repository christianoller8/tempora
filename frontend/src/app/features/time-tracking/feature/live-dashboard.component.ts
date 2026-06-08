import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { TimeStore } from '../data-access/time.store';
import { SseService } from '../../../core/sse/sse.service';
import { TranslatePipe } from '@ngx-translate/core';
import type { TimeEntryDto } from '../data-access/time.api';

/**
 * LiveDashboardComponent — manager view of real-time employee clock status.
 *
 * Uses TimeStore for initial state and reacts to SSE CLOCK_IN / CLOCK_OUT
 * events for live updates.
 *
 * Satisfies FR-TIME-9, AC-TIME-8 [TEST]
 */
@Component({
  selector: 'app-live-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section aria-label="Live clock dashboard">
      <header class="dashboard-header">
        <h1>{{ 'TIME.LIVE_DASHBOARD' | translate }}</h1>
        <span
          class="connection-status"
          [class.connected]="sse.connected()"
          aria-live="polite"
        >
          {{ sse.connected() ? ('COMMON.ACTIVE' | translate) : ('COMMON.LOADING' | translate) }}
        </span>
      </header>

      <table aria-label="Employee clock status">
        <thead>
          <tr>
            <th scope="col">{{ 'TIME.ENTRY_TABLE_EMPLOYEE' | translate }}</th>
            <th scope="col">{{ 'TIME.ENTRY_TABLE_STATUS' | translate }}</th>
            <th scope="col">{{ 'TIME.ENTRY_TABLE_CLOCK_IN' | translate }}</th>
            <th scope="col">{{ 'TIME.ENTRY_TABLE_CLOCK_OUT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of entries(); track entry.id) {
            <tr>
              <td>{{ entry.employeeId }}</td>
              <td>
                <span [class.status-open]="entry.status === 'OPEN'">
                  {{ entry.status }}
                </span>
              </td>
              <td>{{ formatTime(entry.clockIn) }}</td>
              <td>{{ entry.clockOut ? formatTime(entry.clockOut) : '—' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4">{{ 'TIME.EMPTY_ENTRIES' | translate }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class LiveDashboardComponent implements OnInit {
  protected readonly store = inject(TimeStore) as unknown as TimeStore;
  protected readonly sse = inject(SseService);

  protected readonly entries = computed<TimeEntryDto[]>(() => this.store.entries());

  ngOnInit(): void {
    // Load all entries for the dashboard view.
    void this.store.loadEntries();
    // SseService.connect() is called in TimeStore.onInit via withHooks.
  }

  protected formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
