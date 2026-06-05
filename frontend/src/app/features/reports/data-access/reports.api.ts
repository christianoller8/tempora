import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../../../core/http/api.tokens';

export interface ReportRow {
  [key: string]: unknown;
}

export type ReportFormat = 'json' | 'xlsx' | 'pdf';

/**
 * ReportsApi — HTTP client for all reporting endpoints.
 *
 * When format is pdf or xlsx, uses responseType: 'blob' to receive binary data.
 * Satisfies FR-REP-5; acceptance: AC-REP-1, AC-REP-3, AC-REP-7.
 */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getMonthlyHours(
    year: number,
    month: number,
    centerId?: string,
    format?: ReportFormat,
  ): Observable<Blob | ReportRow[]> {
    return this.fetchReport('/reports/monthly-hours', { year, month, centerId, format });
  }

  getOvertime(
    year: number,
    employeeId?: string,
    format?: ReportFormat,
  ): Observable<Blob | ReportRow[]> {
    return this.fetchReport('/reports/overtime', { year, employeeId, format });
  }

  getAbsenteeism(
    startDate: string,
    endDate: string,
    centerId?: string,
    format?: ReportFormat,
  ): Observable<Blob | ReportRow[]> {
    return this.fetchReport('/reports/absenteeism', { startDate, endDate, centerId, format });
  }

  getCoverage(
    centerId: string,
    year: number,
    month: number,
    format?: ReportFormat,
  ): Observable<Blob | ReportRow[]> {
    return this.fetchReport('/reports/coverage', { centerId, year, month, format });
  }

  getCompliance(year: number): Observable<Blob> {
    return this.fetchReport('/reports/compliance', { year, format: 'xlsx' }) as Observable<Blob>;
  }

  downloadTimeEntries(params: {
    from: string;
    to: string;
    employeeId?: string;
    format: 'pdf' | 'excel';
  }): Observable<void> {
    const path = params.format === 'excel'
      ? '/reports/time-entries/excel'
      : '/reports/time-entries/pdf';
    const ext = params.format === 'excel' ? 'xlsx' : 'pdf';
    const body: Record<string, unknown> = { from: params.from, to: params.to };
    if (params.employeeId) body['employeeId'] = params.employeeId;
    return this.http
      .post(`${this.baseUrl}${path}`, body, { responseType: 'blob', withCredentials: true })
      .pipe(map(blob => { this.downloadReport(blob, `time-entries-${params.from}-${params.to}.${ext}`); }));
  }

  downloadSchedule(params: {
    year: number;
    month: number;
    employeeId?: string;
  }): Observable<void> {
    const body: Record<string, unknown> = { year: params.year, month: params.month };
    if (params.employeeId) body['employeeId'] = params.employeeId;
    return this.http
      .post(`${this.baseUrl}/reports/schedule/pdf`, body, { responseType: 'blob', withCredentials: true })
      .pipe(map(blob => { this.downloadReport(blob, `schedule-${params.year}-${params.month}.pdf`); }));
  }

  /**
   * Triggers a browser download of a Blob with the given filename.
   */
  downloadReport(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private fetchReport(
    path: string,
    params: Record<string, unknown>,
    ): Observable<Blob | ReportRow[]> {
    const isBinary = params['format'] === 'xlsx' || params['format'] === 'pdf';

    // Build params — filter out undefined/null values
    const httpParams = new HttpParams({
      fromObject: Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)]),
      ),
    });

    if (isBinary) {
      return this.http.get(`${this.baseUrl}${path}`, {
        params: httpParams,
        responseType: 'blob',
        withCredentials: true,
      });
    }

    return this.http
      .get<{ data: ReportRow[] }>(`${this.baseUrl}${path}`, {
        params: httpParams,
        withCredentials: true,
      })
      .pipe(map((res) => res.data));
  }
}
