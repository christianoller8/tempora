import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ShiftAssignment, ShiftTemplate } from '../data-access/shifts.api';

export interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
}

export interface AssignmentClickEvent {
  employeeId: string;
  date: string;
  assignment: ShiftAssignment | null;
}

// ---------------------------------------------------------------------------
// CuadranteGridComponent — presentational PrimeTable-style grid.
// Displays a monthly schedule: frozen employee column, one column per day.
// Inputs: employees list + assignments collection.
// Output: assignmentClick event when a cell is clicked.
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-cuadrante-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="cuadrante-container" role="region" aria-label="Monthly shift schedule">
      <div class="cuadrante-scroll-wrapper">
        <table class="cuadrante-table" aria-label="Shift schedule">
          <thead>
            <tr>
              <!-- Frozen employee column header -->
              <th
                class="col-employee col-frozen"
                scope="col"
                aria-label="Employee">
                Employee
              </th>
              <!-- One column per day in the month -->
              @for (day of days(); track day) {
                <th
                  class="col-day"
                  scope="col"
                  [attr.aria-label]="'Day ' + day">
                  {{ day }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (employee of employees(); track employee.id) {
              <tr>
                <!-- Frozen employee cell -->
                <td class="col-employee col-frozen" [attr.aria-label]="employee.firstName + ' ' + employee.lastName">
                  {{ employee.firstName }} {{ employee.lastName }}
                </td>
                <!-- One cell per day -->
                @for (day of days(); track day) {
                  <td
                    class="col-day"
                    [class.has-assignment]="getAssignment(employee.id, day) !== null"
                    [attr.aria-label]="getCellLabel(employee, day)"
                    role="gridcell"
                    tabindex="0"
                    (click)="onCellClick(employee.id, day)"
                    (keydown.enter)="onCellClick(employee.id, day)"
                    (keydown.space)="onCellClick(employee.id, day)">
                    {{ getAssignmentLabel(employee.id, day) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .cuadrante-container {
      overflow: hidden;
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 0.375rem;
    }

    .cuadrante-scroll-wrapper {
      overflow-x: auto;
    }

    .cuadrante-table {
      border-collapse: collapse;
      min-width: 100%;
      font-size: 0.875rem;
    }

    .cuadrante-table th,
    .cuadrante-table td {
      border: 1px solid var(--surface-border, #e2e8f0);
      padding: 0.375rem 0.5rem;
      text-align: center;
      white-space: nowrap;
    }

    .cuadrante-table th {
      background: var(--surface-100, #f8fafc);
      font-weight: 600;
    }

    .col-employee {
      text-align: left;
      min-width: 10rem;
    }

    .col-frozen {
      position: sticky;
      left: 0;
      z-index: 1;
      background: var(--surface-0, #ffffff);
      box-shadow: 2px 0 4px rgba(0, 0, 0, 0.08);
    }

    .col-day {
      min-width: 2.5rem;
      cursor: pointer;
    }

    .col-day.has-assignment {
      background: var(--primary-100, #dbeafe);
      font-weight: 600;
    }

    .col-day:hover,
    .col-day:focus {
      outline: 2px solid var(--primary-500, #3b82f6);
      outline-offset: -2px;
    }
  `],
})
export class CuadranteGridComponent {
  readonly employees = input.required<EmployeeRow[]>();
  readonly assignments = input.required<ShiftAssignment[]>();
  readonly templates = input<ShiftTemplate[]>([]);
  readonly year = input.required<number>();
  readonly month = input.required<number>();

  readonly assignmentClick = output<AssignmentClickEvent>();

  /** Generate all days in the current month. */
  readonly days = computed<number[]>(() => {
    const daysInMonth = new Date(this.year(), this.month(), 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  });

  getAssignment(employeeId: string, day: number): ShiftAssignment | null {
    const dateStr = this.buildDateString(day);
    return (
      this.assignments().find(
        (a) => a.employeeId === employeeId && a.date === dateStr,
      ) ?? null
    );
  }

  getAssignmentLabel(employeeId: string, day: number): string {
    const assignment = this.getAssignment(employeeId, day);
    if (!assignment) return '';

    const template = this.templates().find((t) => t.id === assignment.shiftTemplateId);
    if (template) {
      // Short label: first char of shift type or start time abbreviation.
      return `${template.startTime}`;
    }
    return 'S';
  }

  getCellLabel(employee: EmployeeRow, day: number): string {
    const assignment = this.getAssignment(employee.id, day);
    const dateStr = this.buildDateString(day);
    if (!assignment) {
      return `${employee.firstName} ${employee.lastName} — ${dateStr}: no shift`;
    }
    return `${employee.firstName} ${employee.lastName} — ${dateStr}: assigned`;
  }

  onCellClick(employeeId: string, day: number): void {
    this.assignmentClick.emit({
      employeeId,
      date: this.buildDateString(day),
      assignment: this.getAssignment(employeeId, day),
    });
  }

  private buildDateString(day: number): string {
    const mm = String(this.month()).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${this.year()}-${mm}-${dd}`;
  }
}
