import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type {
  ShiftTemplateSchema,
  RotationPatternSchema,
  CreateScheduleSchema,
  ShiftAssignmentSchema,
  CreateSwapSchema,
} from '@tempora/shared';
import type { z } from 'zod';

// Re-export inferred types for use throughout the feature.
export type ShiftTemplate = z.infer<typeof ShiftTemplateSchema> & {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type RotationPattern = z.infer<typeof RotationPatternSchema> & {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type ShiftSchedule = {
  id: string;
  organizationId: string;
  centerId: string;
  departmentId: string | null;
  year: number;
  month: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShiftAssignment = z.infer<typeof ShiftAssignmentSchema> & {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type SwapRequest = {
  id: string;
  organizationId: string;
  requesterAssignmentId: string;
  targetAssignmentId: string | null;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string | null;
  approverId: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RuleCheckResult = {
  type: 'block' | 'warn';
  code: string;
  message: string;
  meta?: Record<string, unknown>;
};

export type PublishResult = {
  schedule: ShiftSchedule;
  warnings: RuleCheckResult[];
};

export type AssignmentResult = {
  assignment: ShiftAssignment;
  warnings: RuleCheckResult[];
};

export type CreateShiftTemplate = z.infer<typeof ShiftTemplateSchema>;
export type CreateRotationPattern = z.infer<typeof RotationPatternSchema>;
export type CreateSchedule = z.infer<typeof CreateScheduleSchema>;
export type CreateShiftAssignment = z.infer<typeof ShiftAssignmentSchema>;
export type CreateSwap = z.infer<typeof CreateSwapSchema>;

@Injectable({ providedIn: 'root' })
export class ShiftsApi {
  private readonly api = inject(ApiService);

  // --- ShiftTemplate ---
  listTemplates(): Observable<ShiftTemplate[]> {
    return this.api.get<ShiftTemplate[]>('/shifts/templates');
  }

  createTemplate(dto: CreateShiftTemplate): Observable<ShiftTemplate> {
    return this.api.post<ShiftTemplate>('/shifts/templates', dto);
  }

  // --- RotationPattern ---
  listPatterns(): Observable<RotationPattern[]> {
    return this.api.get<RotationPattern[]>('/shifts/rotation-patterns');
  }

  // --- ShiftSchedule ---
  listSchedules(params?: { centerId?: string; year?: string; month?: string }): Observable<ShiftSchedule[]> {
    return this.api.get<ShiftSchedule[]>('/shifts/schedules', params);
  }

  createSchedule(dto: CreateSchedule): Observable<ShiftSchedule> {
    return this.api.post<ShiftSchedule>('/shifts/schedules', dto);
  }

  getSchedule(id: string): Observable<ShiftSchedule> {
    return this.api.get<ShiftSchedule>(`/shifts/schedules/${id}`);
  }

  publishSchedule(id: string): Observable<PublishResult> {
    return this.api.post<PublishResult>(`/shifts/schedules/${id}/publish`, {});
  }

  // --- ShiftAssignment ---
  listAssignments(params?: { scheduleId?: string; employeeId?: string }): Observable<ShiftAssignment[]> {
    return this.api.get<ShiftAssignment[]>('/shifts/assignments', params);
  }

  createAssignment(dto: CreateShiftAssignment): Observable<AssignmentResult> {
    return this.api.post<AssignmentResult>('/shifts/assignments', dto);
  }

  // --- Swaps ---
  listSwaps(params?: { status?: string }): Observable<SwapRequest[]> {
    return this.api.get<SwapRequest[]>('/shifts/swaps', params);
  }

  requestSwap(dto: CreateSwap): Observable<SwapRequest> {
    return this.api.post<SwapRequest>('/shifts/swaps', dto);
  }

  approveSwap(id: string): Observable<{ swap: SwapRequest; warnings: RuleCheckResult[] }> {
    return this.api.post<{ swap: SwapRequest; warnings: RuleCheckResult[] }>(`/shifts/swaps/${id}/approve`, {});
  }

  rejectSwap(id: string): Observable<void> {
    return this.api.post<void>(`/shifts/swaps/${id}/reject`, {});
  }
}
