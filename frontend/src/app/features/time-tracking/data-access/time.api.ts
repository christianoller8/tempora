import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';

export interface TimeEntryDto {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  status: 'OPEN' | 'CLOSED';
  source: string;
}

export interface ClockInResponse {
  data: TimeEntryDto;
}

export interface ClockOutResponse {
  data: TimeEntryDto;
  warnings: unknown[];
}

export interface CreateCorrectionDto {
  timeEntryId: string;
  justification: string;
  proposedClockIn?: string;
  proposedClockOut?: string;
}

/**
 * Time tracking API service.
 * Wraps all time-entry and time-correction HTTP calls.
 */
@Injectable({ providedIn: 'root' })
export class TimeApi {
  private readonly api = inject(ApiService);

  clockIn(): Observable<TimeEntryDto> {
    return this.api.post<ClockInResponse>('/time-entries/clock-in', {}).pipe(
      map((res) => res.data),
    );
  }

  clockOut(): Observable<TimeEntryDto> {
    return this.api.post<ClockOutResponse>('/time-entries/clock-out', {}).pipe(
      map((res) => res.data),
    );
  }

  listEntries(params?: { employeeId?: string; status?: string }): Observable<TimeEntryDto[]> {
    return this.api.get<{ data: TimeEntryDto[] }>('/time-entries', params).pipe(
      map((res) => res.data),
    );
  }

  createCorrection(dto: CreateCorrectionDto): Observable<unknown> {
    return this.api.post('/time-corrections', dto);
  }
}
