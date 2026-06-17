import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { TimeApi, type TimeEntryDto } from '../../time-tracking/data-access/time.api';
import { AbsencesApi, type AbsenceDto } from '../../absences/data-access/absences.api';
import { ShiftsApi, type SwapRequest } from '../../shifts/data-access/shifts.api';
import { ApiService } from '../../../core/http/api.service';

// ---------------------------------------------------------------------------
// Employee shape returned by GET /employees
// ---------------------------------------------------------------------------
export interface EmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  category: string;
  contractType: string;
  contractedHoursPerWeek: number;
  primaryCenterId: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Derived types used in the Dashboard
// ---------------------------------------------------------------------------
export interface DashboardStats {
  totalEmployees: number;
  clockedIn: number;
  onAbsenceToday: number;
  pendingSwaps: number;
}

export interface ClockInEntry {
  employeeId: string;
  fullName: string;
  category: string;
  clockInTime: string;   // ISO string
  duration: string;      // "2h 35m"
}

export type IncidentSeverity = 'danger' | 'warn' | 'info';
export interface Incident {
  id: string;
  severity: IncidentSeverity;
  label: string;
  detail: string;
  employeeId?: string;
}

export interface WeeklyHoursEntry {
  employeeId: string;
  name: string;
  hours: number;
}

export interface DashboardData {
  employees: EmployeeDto[];
  openEntries: TimeEntryDto[];
  approvedAbsences: AbsenceDto[];
  pendingSwaps: SwapRequest[];
  weekEntries: TimeEntryDto[];
}

// ---------------------------------------------------------------------------
// DashboardApi — aggregates all calls needed by the dashboard in parallel
// ---------------------------------------------------------------------------
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly api    = inject(ApiService);
  private readonly time   = inject(TimeApi);
  private readonly absences = inject(AbsencesApi);
  private readonly shifts = inject(ShiftsApi);

  /** One parallel load of everything the dashboard needs. */
  load(): Observable<DashboardData> {
    const now  = new Date();
    const mon  = startOfWeek(now);
    const sun  = endOfWeek(now);

    return forkJoin({
      // /employees returns an array directly (no {data:[]} wrapper)
      employees: this.api.get<EmployeeDto[]>('/employees', { activeOnly: 'true' }),
      openEntries: this.time.listEntries({ status: 'OPEN' }),
      approvedAbsences: this.absences.listAbsences({ status: 'APPROVED' }),
      pendingSwaps: this.shifts.listSwaps({ status: 'REQUESTED' }),
      weekEntries: this.time.listEntries({ from: mon.toISOString(), to: sun.toISOString() }),
    });
  }
}

// ---------------------------------------------------------------------------
// Pure derivation helpers (used both in the service and component)
// ---------------------------------------------------------------------------

export function deriveStats(d: DashboardData): DashboardStats {
  const today = todayStr();
  return {
    totalEmployees:  d.employees.length,
    clockedIn:       d.openEntries.length,
    onAbsenceToday:  d.approvedAbsences.filter(a => a.startDate.slice(0,10) <= today && a.endDate.slice(0,10) >= today).length,
    pendingSwaps:    d.pendingSwaps.length,
  };
}

export function deriveFeed(d: DashboardData): ClockInEntry[] {
  const empMap = new Map(d.employees.map(e => [e.id, e]));
  const now = Date.now();
  return d.openEntries
    .slice()
    .sort((a, b) => b.clockIn.localeCompare(a.clockIn))
    .map(entry => {
      const emp = empMap.get(entry.employeeId);
      const durationMs = now - new Date(entry.clockIn).getTime();
      return {
        employeeId: entry.employeeId,
        fullName:   emp ? `${emp.firstName} ${emp.lastName}` : entry.employeeId.slice(0, 8),
        category:   emp?.category ?? '—',
        clockInTime: entry.clockIn,
        duration:   formatDuration(durationMs),
      };
    });
}

export function deriveIncidents(d: DashboardData): Incident[] {
  const incidents: Incident[] = [];
  const empMap = new Map(d.employees.map(e => [e.id, e]));
  const today  = todayStr();
  const now    = Date.now();

  // 1. Missed clock-out: OPEN entry whose clock-in was before today
  for (const entry of d.openEntries) {
    if (entry.clockIn.slice(0, 10) < today) {
      const emp  = empMap.get(entry.employeeId);
      const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Desconocido';
      incidents.push({
        id:         `missed-${entry.id}`,
        severity:   'danger',
        label:      'Fichaje no cerrado',
        detail:     `${name} — fichó el ${entry.clockIn.slice(0, 10)}, nunca cerró el fichaje`,
        employeeId: entry.employeeId,
      });
    }
  }

  // 2. Long session warning: OPEN entry running for > 9 h
  for (const entry of d.openEntries) {
    const runningH = (now - new Date(entry.clockIn).getTime()) / 3_600_000;
    if (runningH > 9 && entry.clockIn.slice(0, 10) === today) {
      const emp  = empMap.get(entry.employeeId);
      const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Desconocido';
      incidents.push({
        id:       `overtime-${entry.id}`,
        severity: 'warn',
        label:    'Sesión > 9 h',
        detail:   `${name} — ${runningH.toFixed(1)} h desde el fichaje`,
      });
    }
  }

  // 3. Short rest: consecutive CLOSED entries per employee with gap < 12 h
  const closedByEmployee = new Map<string, TimeEntryDto[]>();
  for (const entry of d.weekEntries) {
    if (entry.status === 'CLOSED' && entry.clockOut) {
      if (!closedByEmployee.has(entry.employeeId)) closedByEmployee.set(entry.employeeId, []);
      closedByEmployee.get(entry.employeeId)!.push(entry);
    }
  }
  for (const [empId, entries] of closedByEmployee) {
    const sorted = entries.sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    for (let i = 1; i < sorted.length; i++) {
      const gapH = (new Date(sorted[i].clockIn).getTime() - new Date(sorted[i-1].clockOut!).getTime()) / 3_600_000;
      if (gapH > 0 && gapH < 12) {
        const emp  = empMap.get(empId);
        const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Desconocido';
        incidents.push({
          id:       `rest-${sorted[i].id}`,
          severity: 'warn',
          label:    'Período de descanso corto',
          detail:   `${name} — solo ${gapH.toFixed(1)} h de descanso (mín. 12 h)`,
        });
      }
    }
  }

  return incidents.slice(0, 20); // cap to avoid overflowing the panel
}

export function deriveWeeklyHours(d: DashboardData): WeeklyHoursEntry[] {
  const empMap = new Map(d.employees.map(e => [e.id, e]));
  const totals = new Map<string, number>();
  for (const entry of d.weekEntries) {
    if (entry.status === 'CLOSED' && entry.clockOut) {
      const h = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 3_600_000;
      totals.set(entry.employeeId, (totals.get(entry.employeeId) ?? 0) + h);
    }
  }
  return Array.from(totals.entries())
    .map(([id, hours]) => {
      const emp = empMap.get(id);
      return {
        employeeId: id,
        name: emp ? `${emp.firstName} ${emp.lastName.charAt(0)}.` : id.slice(0, 6),
        hours: Math.round(hours * 10) / 10,
      };
    })
    .filter(e => e.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day  = d.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function endOfWeek(d: Date): Date {
  const sun = new Date(startOfWeek(d));
  sun.setDate(sun.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

export function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
