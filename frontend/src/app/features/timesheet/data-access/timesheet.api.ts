import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';

// ---------------------------------------------------------------------------
// DTOs — mirror the shared Zod schemas for use in the frontend
// ---------------------------------------------------------------------------

export interface TimesheetHoursDto {
  regularHours: number;
  overtimeHours: number;
  partTimeDeviation: number;
}

export interface TimesheetEntryDto {
  id: string;
  date: string;         // YYYY-MM-DD
  clockIn: string;      // UTC ISO-8601
  clockOut: string | null;
  status: 'OPEN' | 'CLOSED';
  durationMinutes: number | null;
}

export interface TimesheetSummaryDto {
  year: number;
  month: number;
  employeeId: string;
  hours: TimesheetHoursDto | null;
  confirmed: boolean;
  confirmedAt: string | null;
  hasOpenEntry: boolean;
  totalAbsenceDays: number;
}

export interface TimesheetSignatureDto {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  confirmedAt: string;
  alreadyConfirmed: boolean;
}

export interface ConfirmationStatusRowDto {
  employeeId: string;
  firstName: string;
  lastName: string;
  confirmed: boolean;
  confirmedAt: string | null;
}

// ---------------------------------------------------------------------------
// API service
// ---------------------------------------------------------------------------

/**
 * TimesheetApi — wraps all timesheet-signature HTTP calls.
 * Mirrors the backend endpoints at /timesheet-signatures.
 */
@Injectable({ providedIn: 'root' })
export class TimesheetApi {
  private readonly api = inject(ApiService);

  /**
   * GET /timesheet-signatures/summary?year=&month=
   * Optionally pass employeeId for manager/admin lookups.
   */
  getSummary(year: number, month: number, employeeId?: string): Observable<TimesheetSummaryDto> {
    const params: Record<string, string> = {
      year: String(year),
      month: String(month),
    };
    if (employeeId) params['employeeId'] = employeeId;

    return this.api
      .get<{ data: TimesheetSummaryDto }>('/timesheet-signatures/summary', params)
      .pipe(map((res) => res.data));
  }

  /**
   * POST /timesheet-signatures/confirm
   * Confirms the employee's monthly timesheet.
   * Idempotent — returns existing record with alreadyConfirmed=true on re-confirm.
   */
  confirmMonth(year: number, month: number): Observable<TimesheetSignatureDto> {
    return this.api
      .post<{ data: TimesheetSignatureDto }>('/timesheet-signatures/confirm', { year, month })
      .pipe(map((res) => res.data));
  }

  /**
   * GET /timesheet-signatures/status?year=&month=
   * Manager/admin only — returns all employees' confirmation status.
   */
  getConfirmationStatus(year: number, month: number, centerId?: string): Observable<ConfirmationStatusRowDto[]> {
    const params: Record<string, string> = {
      year: String(year),
      month: String(month),
    };
    if (centerId) params['centerId'] = centerId;

    return this.api
      .get<{ data: ConfirmationStatusRowDto[] }>('/timesheet-signatures/status', params)
      .pipe(map((res) => res.data));
  }
}
