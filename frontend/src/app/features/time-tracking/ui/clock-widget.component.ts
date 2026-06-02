import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import type { TimeEntryDto } from '../data-access/time.api';

/**
 * ClockWidgetComponent — presentational clock-in/out widget.
 *
 * Shows:
 * - Current status (OPEN = clocked in, CLOSED / null = clocked out)
 * - Elapsed time ticker (live, updated every second when OPEN)
 * - Clock-in / Clock-out action buttons
 *
 * All state comes from inputs; all actions emitted via outputs.
 * [TEST]
 */
@Component({
  selector: 'app-clock-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="clock-widget" role="region" aria-label="Time tracking clock">
      <div class="clock-status">
        <span
          class="status-badge"
          [class.status-open]="isClockedIn()"
          [class.status-closed]="!isClockedIn()"
          aria-live="polite"
        >
          {{ isClockedIn() ? 'CLOCKED IN' : 'CLOCKED OUT' }}
        </span>
      </div>

      @if (isClockedIn()) {
        <div class="elapsed-time" aria-label="Elapsed time">
          {{ elapsedDisplay() }}
        </div>
      }

      <div class="clock-actions">
        @if (!isClockedIn()) {
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="isClocking()"
            (click)="onClockIn()"
            aria-label="Clock in"
          >
            {{ isClocking() ? 'Processing...' : 'Clock In' }}
          </button>
        } @else {
          <button
            type="button"
            class="btn btn-secondary"
            [disabled]="isClocking()"
            (click)="onClockOut()"
            aria-label="Clock out"
          >
            {{ isClocking() ? 'Processing...' : 'Clock Out' }}
          </button>
        }
      </div>

      @if (error()) {
        <p class="error-message" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class ClockWidgetComponent implements OnInit, OnDestroy {
  readonly currentEntry = input<TimeEntryDto | null>(null);
  readonly isClocking = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly clockIn = output<void>();
  readonly clockOut = output<void>();

  readonly isClockedIn = computed(() => this.currentEntry()?.status === 'OPEN');

  // Live elapsed time ticker.
  private tickerInterval: ReturnType<typeof setInterval> | null = null;
  readonly elapsedSeconds = signal(0);

  readonly elapsedDisplay = computed(() => {
    const s = this.elapsedSeconds();
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });

  ngOnInit(): void {
    this.startTicker();
  }

  ngOnDestroy(): void {
    this.stopTicker();
  }

  private startTicker(): void {
    this.tickerInterval = setInterval(() => {
      const entry = this.currentEntry();
      if (entry?.status === 'OPEN' && entry.clockIn) {
        const elapsed = Math.floor((Date.now() - new Date(entry.clockIn).getTime()) / 1000);
        this.elapsedSeconds.set(elapsed);
      } else {
        this.elapsedSeconds.set(0);
      }
    }, 1000);
  }

  private stopTicker(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  onClockIn(): void {
    this.clockIn.emit();
  }

  onClockOut(): void {
    this.clockOut.emit();
  }
}
