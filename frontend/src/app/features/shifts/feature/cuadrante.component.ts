import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchedulesStore } from '../data-access/schedules.store';
import { ShiftsApi } from '../data-access/shifts.api';
import type { ShiftAssignment, RuleCheckResult } from '../data-access/shifts.api';
import { CuadranteGridComponent } from '../ui/cuadrante-grid.component';
import type { EmployeeRow, AssignmentClickEvent } from '../ui/cuadrante-grid.component';

// ---------------------------------------------------------------------------
// CuadranteComponent — smart container for the shift schedule (cuadrante).
// Orchestrates: load schedules, create draft, assign shifts, publish.
// Shows rule violation warnings via toast-like notification.
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-cuadrante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CuadranteGridComponent],
  template: `
    <section aria-labelledby="cuadrante-heading">
      <h1 id="cuadrante-heading">Shift Schedule (Cuadrante)</h1>

      <!-- Warnings banner (rule violation warnings from publish/assign) -->
      @if (warnings().length > 0) {
        <div
          role="alert"
          class="warnings-banner"
          aria-live="polite">
          <strong>Rule warnings ({{ warnings().length }}):</strong>
          <ul>
            @for (w of warnings(); track w.code) {
              <li>{{ w.message }}</li>
            }
          </ul>
          <button
            type="button"
            (click)="dismissWarnings()"
            aria-label="Dismiss warnings">
            Dismiss
          </button>
        </div>
      }

      <!-- Error banner -->
      @if (schedulesStore.error()) {
        <div role="alert" class="error-banner" aria-live="assertive">
          {{ schedulesStore.error() }}
        </div>
      }

      <!-- Month/year selector -->
      <div class="controls" role="group" aria-label="Schedule controls">
        <label for="year-select">Year</label>
        <select id="year-select" [ngModel]="selectedYear()" (ngModelChange)="selectedYear.set($event)">
          @for (y of availableYears(); track y) {
            <option [value]="y">{{ y }}</option>
          }
        </select>

        <label for="month-select">Month</label>
        <select id="month-select" [ngModel]="selectedMonth()" (ngModelChange)="selectedMonth.set($event)">
          @for (m of availableMonths(); track m.value) {
            <option [value]="m.value">{{ m.label }}</option>
          }
        </select>

        <button
          type="button"
          (click)="loadCurrentSchedule()"
          [disabled]="schedulesStore.loading()"
          aria-label="Load schedule for selected period">
          Load
        </button>

        @if (activeSchedule()) {
          @if (activeSchedule()!.status === 'DRAFT') {
            <button
              type="button"
              (click)="publish()"
              [disabled]="schedulesStore.loading()"
              aria-label="Publish current schedule">
              Publish
            </button>
          }
        } @else {
          <button
            type="button"
            (click)="createDraft()"
            [disabled]="schedulesStore.loading()"
            aria-label="Create new draft schedule">
            New Draft
          </button>
        }
      </div>

      <!-- Loading indicator -->
      @if (schedulesStore.loading()) {
        <p role="status" aria-live="polite">Loading...</p>
      }

      <!-- Cuadrante grid -->
      @if (activeSchedule(); as schedule) {
        <app-cuadrante-grid
          [employees]="employees()"
          [assignments]="assignments()"
          [year]="selectedYear()"
          [month]="selectedMonth()"
          (assignmentClick)="onAssignmentClick($event)"
        />
        <p class="schedule-status">
          Status: <strong>{{ schedule.status }}</strong>
          @if (schedule.publishedAt) {
            — Published {{ schedule.publishedAt | date:'shortDate' }}
          }
        </p>
      }
    </section>
  `,
  styles: [`
    section { padding: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    .controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .controls label { font-weight: 600; }
    .warnings-banner {
      background: #fef9c3;
      border: 1px solid #eab308;
      border-radius: 0.375rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }
    .error-banner {
      background: #fee2e2;
      border: 1px solid #ef4444;
      border-radius: 0.375rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      color: #991b1b;
    }
    .schedule-status { margin-top: 0.5rem; font-size: 0.875rem; color: #64748b; }
  `],
})
export class CuadranteComponent implements OnInit {
  protected readonly schedulesStore = inject(SchedulesStore);
  private readonly api = inject(ShiftsApi);

  protected readonly selectedYear = signal<number>(new Date().getFullYear());
  protected readonly selectedMonth = signal<number>(new Date().getMonth() + 1);
  protected readonly warnings = signal<RuleCheckResult[]>([]);

  // In a real implementation these would come from an EmployeesStore.
  protected readonly employees = signal<EmployeeRow[]>([]);
  protected readonly assignments = signal<ShiftAssignment[]>([]);

  protected readonly activeSchedule = computed(() =>
    this.schedulesStore
      .entities()
      .find(
        (s) =>
          s.year === this.selectedYear() &&
          s.month === this.selectedMonth(),
      ) ?? null,
  );

  protected readonly availableYears = computed(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  });

  protected readonly availableMonths = computed(() =>
    Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' }),
    })),
  );

  ngOnInit(): void {
    this.loadCurrentSchedule();
  }

  protected loadCurrentSchedule(): void {
    void this.schedulesStore.loadSchedules({
      year: String(this.selectedYear()),
      month: String(this.selectedMonth()),
    }).then(() => {
      const schedule = this.activeSchedule();
      if (schedule) {
        this.loadAssignments(schedule.id);
      }
    });
  }

  protected createDraft(): void {
    void this.schedulesStore
      .createSchedule({
        centerId: '', // Manager's center ID — resolved from auth context in a full implementation
        year: this.selectedYear(),
        month: this.selectedMonth(),
      })
      .catch(() => {
        // Error handled by store
      });
  }

  protected publish(): void {
    const schedule = this.activeSchedule();
    if (!schedule) return;

    void this.schedulesStore
      .publishSchedule(schedule.id)
      .then((w) => {
        if (w.length > 0) {
          this.warnings.set(w);
        }
      })
      .catch(() => {
        // Error displayed via store.error()
      });
  }

  protected dismissWarnings(): void {
    this.warnings.set([]);
    this.schedulesStore.clearWarnings();
  }

  protected onAssignmentClick(event: AssignmentClickEvent): void {
    // In a full implementation: open assignment form dialog.
    console.info('Assignment clicked:', event);
  }

  private loadAssignments(scheduleId: string): void {
    this.api.listAssignments({ scheduleId }).subscribe({
      next: (list) => this.assignments.set(list),
    });
  }
}
