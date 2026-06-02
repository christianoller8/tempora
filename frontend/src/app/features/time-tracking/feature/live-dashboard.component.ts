import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { TimeStore } from '../data-access/time.store';
import { SseService } from '../../../core/sse/sse.service';
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
  template: `
    <section aria-label="Live clock dashboard">
      <header class="dashboard-header">
        <h1>Live Dashboard</h1>
        <span
          class="connection-status"
          [class.connected]="sse.connected()"
          aria-live="polite"
        >
          {{ sse.connected() ? 'Live' : 'Reconnecting...' }}
        </span>
      </header>

      <table aria-label="Employee clock status">
        <thead>
          <tr>
            <th scope="col">Employee</th>
            <th scope="col">Status</th>
            <th scope="col">Clock In</th>
            <th scope="col">Clock Out</th>
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
              <td colspan="4">No time entries found.</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class LiveDashboardComponent implements OnInit {
  protected readonly store = inject(TimeStore);
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
