import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { EmployeeCategory, ContractType } from '@tempora/shared';
import { EMPLOYEE_CATEGORY_VALUES, CONTRACT_TYPE_VALUES } from '@tempora/shared';

// Re-export runtime arrays for use in dropdowns (Slice 2)
export { EMPLOYEE_CATEGORY_VALUES, CONTRACT_TYPE_VALUES };
export type { EmployeeCategory, ContractType };

// ---------------------------------------------------------------------------
// DTOs — authoritative shapes from EmployeeResponseSchema (spec "Data Contract Decision")
// ---------------------------------------------------------------------------

export interface EmployeeDto {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  nif: string | null;
  category: EmployeeCategory;
  contractType: ContractType;
  contractedHoursPerWeek: number;
  primaryCenterId: string;
  workingCalendarId: string | null;
  hireDate: string;
  terminationDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  firstName: string;        // 1–100 chars
  lastName: string;         // 1–100 chars
  nif?: string;             // max 20 chars
  category: EmployeeCategory;
  contractType: ContractType;
  contractedHoursPerWeek?: number;  // required and > 0 when contractType === 'TIEMPO_PARCIAL'
  primaryCenterId: string;          // UUID
  workingCalendarId?: string;       // UUID
  hireDate: string;                 // YYYY-MM-DD
}

export type UpdateEmployeeDto = Partial<CreateEmployeeDto>;

export interface CenterDto {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// EmployeesApi — bare-array responses; NO .data unwrap (AC-EMP-18, FR-EMP-14)
// ---------------------------------------------------------------------------

/**
 * Employees API service.
 * All responses from GET /employees and GET /employees/:id are bare
 * objects/arrays — no { data } envelope (contrast with AbsencesApi).
 */
@Injectable({ providedIn: 'root' })
export class EmployeesApi {
  private readonly api = inject(ApiService);

  list(params?: { activeOnly?: boolean }): Observable<EmployeeDto[]> {
    const query = params?.activeOnly !== undefined
      ? { activeOnly: String(params.activeOnly) }
      : undefined;
    return this.api.get<EmployeeDto[]>('/employees', query);
  }

  getById(id: string): Observable<EmployeeDto> {
    return this.api.get<EmployeeDto>(`/employees/${id}`);
  }

  create(dto: CreateEmployeeDto): Observable<EmployeeDto> {
    return this.api.post<EmployeeDto>('/employees', dto);
  }

  update(id: string, dto: UpdateEmployeeDto): Observable<EmployeeDto> {
    return this.api.patch<EmployeeDto>(`/employees/${id}`, dto);
  }

  terminate(id: string): Observable<void> {
    return this.api.post<void>(`/employees/${id}/terminate`, {});
  }

  reactivate(id: string): Observable<EmployeeDto> {
    return this.api.patch<EmployeeDto>(`/employees/${id}`, { isActive: true });
  }
}

// ---------------------------------------------------------------------------
// CentersApi — bare-array response; NO .data unwrap (design ADR)
// ---------------------------------------------------------------------------

/**
 * Centers API service.
 * GET /centers returns a bare CenterDto[] (no { data } envelope).
 */
@Injectable({ providedIn: 'root' })
export class CentersApi {
  private readonly api = inject(ApiService);

  list(): Observable<CenterDto[]> {
    return this.api.get<CenterDto[]>('/centers');
  }
}
