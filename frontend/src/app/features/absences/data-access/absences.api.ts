import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';

export type AbsenceType =
  | 'VACACIONES'
  | 'IT'
  | 'PERMISO_RETRIBUIDO'
  | 'AUSENCIA_INJUSTIFICADA'
  | 'LACTANCIA'
  | 'REDUCCION_JORNADA'
  | 'ASUNTOS_PROPIOS'
  | 'PERMISO_NO_RETRIBUIDO'
  | 'MATERNIDAD_PATERNIDAD';

export interface AbsenceDto {
  id: string;
  employeeId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  cause?: string;
  decisionComment: string | null;
}

export interface AbsenceBalanceDto {
  entitled: number;
  used: number;
  remaining: number;
}

export interface CreateAbsenceDto {
  employeeId?: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  cause?: string;
}

/**
 * Absences API service.
 * Wraps all absence HTTP calls.
 */
@Injectable({ providedIn: 'root' })
export class AbsencesApi {
  private readonly api = inject(ApiService);

  listAbsences(params?: { employeeId?: string; status?: string; type?: string; from?: string; to?: string }): Observable<AbsenceDto[]> {
    return this.api.get<{ data: AbsenceDto[] }>('/absences', params).pipe(
      map((res) => res.data),
    );
  }

  createAbsence(dto: CreateAbsenceDto): Observable<AbsenceDto> {
    return this.api.post<{ data: AbsenceDto }>('/absences', dto).pipe(
      map((res) => res.data),
    );
  }

  getAbsence(id: string): Observable<AbsenceDto> {
    return this.api.get<{ data: AbsenceDto }>(`/absences/${id}`).pipe(
      map((res) => res.data),
    );
  }

  approveAbsence(id: string, comment?: string): Observable<AbsenceDto> {
    return this.api.post<{ data: AbsenceDto }>(`/absences/${id}/approve`, comment ? { comment } : {}).pipe(
      map((res) => res.data),
    );
  }

  rejectAbsence(id: string, comment?: string): Observable<AbsenceDto> {
    return this.api.post<{ data: AbsenceDto }>(`/absences/${id}/reject`, comment ? { comment } : {}).pipe(
      map((res) => res.data),
    );
  }

  getBalance(params: { employeeId?: string; year?: number }): Observable<AbsenceBalanceDto> {
    const query = {
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.year !== undefined ? { year: String(params.year) } : {}),
    };
    return this.api.get<{ data: AbsenceBalanceDto }>('/absences/balance', query).pipe(
      map((res) => res.data),
    );
  }
}
