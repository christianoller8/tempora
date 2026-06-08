import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { ShiftAssignment, ShiftTemplate } from '../data-access/shifts.api';
import type { AbsenceDto } from '../../absences/data-access/absences.api';
import { TranslatePipe } from '@ngx-translate/core';

export interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  category: string;
}

export interface AssignmentClickEvent {
  employeeId: string;
  date: string;         // YYYY-MM-DD
  assignment: ShiftAssignment | null;
}

const SHIFT_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  MANANA:   { label: 'M',  bg: 'rgba(59,130,246,0.22)',  text: '#93c5fd', border: 'rgba(59,130,246,0.5)'  },
  TARDE:    { label: 'T',  bg: 'rgba(249,115,22,0.22)',  text: '#fdba74', border: 'rgba(249,115,22,0.5)'  },
  NOCHE:    { label: 'N',  bg: 'rgba(139,92,246,0.22)',  text: '#c4b5fd', border: 'rgba(139,92,246,0.5)'  },
  GUARDIA:  { label: 'G',  bg: 'rgba(239,68,68,0.22)',   text: '#fca5a5', border: 'rgba(239,68,68,0.5)'   },
  RETEN:    { label: 'R',  bg: 'rgba(234,179,8,0.22)',   text: '#fde047', border: 'rgba(234,179,8,0.5)'   },
  REFUERZO: { label: 'RF', bg: 'rgba(20,184,166,0.22)',  text: '#5eead4', border: 'rgba(20,184,166,0.5)'  },
  LIBRANZA: { label: 'L',  bg: 'rgba(34,197,94,0.14)',   text: '#86efac', border: 'rgba(34,197,94,0.4)'   },
};

interface AbsenceCfg { label: string; bg: string; text: string; border: string; typeLabel: string; }

const AMBER_BG     = 'rgba(245,158,11,0.20)';
const AMBER_TEXT   = '#fcd34d';
const AMBER_BORDER = 'rgba(245,158,11,0.5)';

const ABSENCE_CONFIG: Record<string, AbsenceCfg> = {
  VACACIONES:             { label: 'VAC',  bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Vacaciones' },
  IT:                     { label: 'BAJA', bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Incapacidad Temporal' },
  PERMISO_RETRIBUIDO:     { label: 'PR',   bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Permiso Retribuido' },
  AUSENCIA_INJUSTIFICADA: { label: 'AI',   bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Ausencia Injustificada' },
  LACTANCIA:              { label: 'LAC',  bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Lactancia' },
  REDUCCION_JORNADA:      { label: 'RJ',   bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Reducción de Jornada' },
  ASUNTOS_PROPIOS:        { label: 'AP',   bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Asuntos Propios' },
  PERMISO_NO_RETRIBUIDO:  { label: 'PNR',  bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Permiso No Retribuido' },
  MATERNIDAD_PATERNIDAD:  { label: 'MP',   bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Maternidad / Paternidad' },
};

const ABSENCE_FALLBACK: AbsenceCfg = { label: 'AUS', bg: AMBER_BG, text: AMBER_TEXT, border: AMBER_BORDER, typeLabel: 'Ausencia' };

@Component({
  selector: 'app-cuadrante-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  styles: [`
    :host { display: block; }

    .grid-scroll {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid var(--p-surface-border);
    }

    table {
      border-collapse: collapse;
      /* Use auto layout so column widths come from cell content/CSS, not the
         first-row heuristic. min-content keeps each day column at exactly its
         CSS width and lets the scroll container handle overflow. */
      width: max-content;
      min-width: 100%;
    }

    /* ── Header row ─────────────────────────────────────────────── */
    thead tr { background: var(--p-surface-section); }

    th {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      border-bottom: 1px solid var(--p-surface-border);
      white-space: nowrap;
      padding: 0;
    }

    .th-employee {
      width: 140px;
      min-width: 140px;
      padding: 0.5rem 0.75rem;
      text-align: left;
      position: sticky;
      left: 0;
      z-index: 3;
      background: var(--p-surface-section);
      border-right: 1px solid var(--p-surface-border);
    }

    .th-day {
      width: 38px;
      min-width: 38px;
      text-align: center;
      padding: 0.375rem 0;
      border-right: 1px solid color-mix(in srgb, var(--p-surface-border) 60%, transparent);
    }

    .th-day.is-weekend {
      background: color-mix(in srgb, var(--p-surface-border) 30%, transparent);
    }

    .th-day.is-today {
      color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
    }

    .day-num { display: block; font-size: 0.875rem; font-weight: 700; line-height: 1.1; }
    .day-label { display: block; font-size: 0.6rem; opacity: 0.7; margin-top: 1px; }

    /* ── Body rows ──────────────────────────────────────────────── */
    tbody tr:nth-child(even) { background: color-mix(in srgb, var(--p-surface-ground) 50%, var(--p-surface-card)); }
    tbody tr:nth-child(odd)  { background: var(--p-surface-card); }
    tbody tr:hover td        { background: color-mix(in srgb, var(--p-primary-color) 5%, transparent); }

    td {
      border-bottom: 1px solid color-mix(in srgb, var(--p-surface-border) 50%, transparent);
      padding: 0;
      height: 38px;
    }

    .td-employee {
      position: sticky;
      left: 0;
      z-index: 2;
      /* Explicit backgrounds so the sticky column hides scrolled content.
         Odd rows default to surface-card; even rows get a slightly different shade.
         These must match the tr backgrounds exactly. */
      background: var(--p-surface-card);
      padding: 0 0.75rem;
      border-right: 1px solid var(--p-surface-border);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .emp-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color);
      display: block;
    }

    .emp-cat {
      font-size: 0.65rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: capitalize;
    }

    .td-day {
      width: 38px;
      min-width: 38px;
      text-align: center;
      vertical-align: middle;
      border-right: 1px solid color-mix(in srgb, var(--p-surface-border) 40%, transparent);
      cursor: default;
      padding: 3px;
    }

    .td-day.editable { cursor: pointer; }
    .td-day.editable:hover .cell-empty { background: color-mix(in srgb, var(--p-primary-color) 12%, transparent); border-color: var(--p-primary-color); border-radius: 4px; }

    .td-day.is-weekend { background: color-mix(in srgb, var(--p-surface-border) 20%, transparent); }
    .td-day.is-today   { background: color-mix(in srgb, var(--p-primary-color) 6%, transparent); }

    /* ── Shift cell ─────────────────────────────────────────────── */
    .shift-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 30px;
      border-radius: 5px;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      border: 1px solid transparent;
      transition: filter 0.15s, transform 0.1s;
      cursor: inherit;
    }

    .td-day.editable .shift-chip:hover {
      filter: brightness(1.15);
      transform: scale(1.05);
    }

    .cell-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 30px;
      border: 1px dashed transparent;
      border-radius: 5px;
      color: transparent;
      transition: all 0.15s;
    }

    .absence-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 30px;
      border-radius: 5px;
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      border: 1px solid transparent;
      cursor: default;
    }
  `],
  template: `
    <div class="grid-scroll" role="region" aria-label="Cuadrante de turnos">
      <table>
        <thead>
          <tr>
            <th class="th-employee">{{ 'TIME.ENTRY_TABLE_EMPLOYEE' | translate }}</th>
            @for (d of days(); track d.num) {
              <th
                class="th-day"
                [class.is-weekend]="d.isWeekend"
                [class.is-today]="d.isToday"
                scope="col"
                [attr.aria-label]="d.label + ' ' + d.num"
              >
                <span class="day-num">{{ d.num }}</span>
                <span class="day-label">{{ d.label }}</span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (emp of employees(); track emp.id) {
            <tr>
              <td class="td-employee" [title]="emp.firstName + ' ' + emp.lastName">
                <span class="emp-name">{{ emp.firstName }} {{ emp.lastName }}</span>
                <span class="emp-cat">{{ formatCategory(emp.category) }}</span>
              </td>
              @for (d of days(); track d.num) {
                @let abs  = getAbsence(emp.id, d.dateStr);
                @let cell = getCell(emp.id, d.dateStr);
                <td
                  class="td-day"
                  [class.is-weekend]="d.isWeekend"
                  [class.is-today]="d.isToday"
                  [class.editable]="editable() && !abs"
                  (click)="editable() && !abs && onCellClick(emp.id, d.dateStr, cell?.assignment ?? null)"
                  (keydown.enter)="editable() && !abs && onCellClick(emp.id, d.dateStr, cell?.assignment ?? null)"
                  (keydown.space)="editable() && !abs && onCellClick(emp.id, d.dateStr, cell?.assignment ?? null)"
                  [attr.tabindex]="editable() && !abs ? 0 : -1"
                  [attr.role]="editable() && !abs ? 'gridcell' : null"
                  [title]="abs ? abs.typeLabel : (cell ? cell.shiftName + ' ' + cell.times : '')"
                >
                  @if (abs) {
                    <div
                      class="absence-chip"
                      [style.background]="abs.bg"
                      [style.color]="abs.text"
                      [style.border-color]="abs.border"
                      [attr.aria-label]="abs.typeLabel"
                    >{{ abs.label }}</div>
                  } @else if (cell) {
                    <div
                      class="shift-chip"
                      [style.background]="cell.bg"
                      [style.color]="cell.text"
                      [style.border-color]="cell.border"
                    >{{ cell.label }}</div>
                  } @else {
                    <div class="cell-empty">+</div>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class CuadranteGridComponent {
  readonly employees   = input.required<EmployeeRow[]>();
  readonly assignments = input.required<ShiftAssignment[]>();
  readonly templates   = input.required<ShiftTemplate[]>();
  readonly year        = input.required<number>();
  readonly month       = input.required<number>();
  readonly editable    = input<boolean>(false);
  readonly absences    = input<AbsenceDto[]>([]);

  readonly assignmentClick = output<AssignmentClickEvent>();

  private readonly DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  readonly days = computed(() => {
    const y = this.year(), m = this.month();
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(y, m - 1, i + 1);
      const dow = d.getDay();
      const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
      return {
        num:       i + 1,
        label:     this.DAY_LABELS[dow],
        dateStr,
        isWeekend: dow === 0 || dow === 6,
        isToday:   dateStr === todayStr,
      };
    });
  });

  /** Build lookup: employeeId+date → enriched cell */
  readonly cellMap = computed(() => {
    const tMap = new Map(this.templates().map(t => [t.id, t]));
    const map = new Map<string, { assignment: ShiftAssignment; label: string; bg: string; text: string; border: string; shiftName: string; times: string }>();
    // Sort ascending so later assignments overwrite earlier duplicates
    const sorted = [...this.assignments()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const a of sorted) {
      const tmpl = tMap.get(a.shiftTemplateId);
      if (!tmpl) continue;
      const cfg = SHIFT_CONFIG[tmpl.shiftType] ?? { label: '?', bg: 'rgba(100,100,100,0.2)', text: '#aaa', border: 'rgba(100,100,100,0.4)' };
      const dateStr = a.date.slice(0, 10);
      const times = tmpl.shiftType === 'LIBRANZA' ? '' : `${tmpl.startTime}–${tmpl.endTime}`;
      map.set(`${a.employeeId}:${dateStr}`, { assignment: a, ...cfg, shiftName: tmpl.name, times });
    }
    return map;
  });

  getCell(employeeId: string, dateStr: string) {
    return this.cellMap().get(`${employeeId}:${dateStr}`) ?? null;
  }

  readonly absenceMap = computed(() => {
    const map = new Map<string, AbsenceCfg>();
    const y = this.year(), m = this.month();
    for (const a of this.absences()) {
      if (a.status !== 'APPROVED') continue;
      const cfg = ABSENCE_CONFIG[a.type] ?? ABSENCE_FALLBACK;
      const cur = new Date(a.startDate);
      const end = new Date(a.endDate);
      // Iterate each day in the absence range, clamping to displayed month
      while (cur <= end) {
        if (cur.getFullYear() === y && cur.getMonth() + 1 === m) {
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          map.set(`${a.employeeId}:${dateStr}`, cfg);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  });

  getAbsence(employeeId: string, dateStr: string): AbsenceCfg | null {
    return this.absenceMap().get(`${employeeId}:${dateStr}`) ?? null;
  }

  onCellClick(employeeId: string, date: string, assignment: ShiftAssignment | null): void {
    this.assignmentClick.emit({ employeeId, date, assignment });
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, ' ').toLowerCase();
  }
}
