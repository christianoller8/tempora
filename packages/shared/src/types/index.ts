import type { z } from 'zod';
import type {
  LoginRequestSchema,
  LoginResponseSchema,
  RefreshResponseSchema,
  MeResponseSchema,
} from '../schemas/auth.schema.js';
import type {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  OrganizationResponseSchema,
  CreateCenterSchema,
  UpdateCenterSchema,
  CenterResponseSchema,
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  DepartmentResponseSchema,
} from '../schemas/organization.schema.js';
import type {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  EmployeeResponseSchema,
  WorkingCalendarSchema,
  CreateWorkingCalendarSchema,
} from '../schemas/employee.schema.js';
import type {
  ShiftTemplateSchema,
  ShiftTemplateResponseSchema,
  RotationPatternSchema,
  RotationPatternResponseSchema,
  CreateScheduleSchema,
  ScheduleResponseSchema,
  ShiftAssignmentSchema,
  ShiftAssignmentResponseSchema,
  CreateSwapSchema,
  SwapResponseSchema,
} from '../schemas/shift.schema.js';
import type {
  ClockInSchema,
  ClockOutSchema,
  TimeEntryResponseSchema,
  CreateCorrectionSchema,
  CorrectionResponseSchema,
  OvertimeQuerySchema,
} from '../schemas/time-entry.schema.js';
import type {
  CreateAbsenceSchema,
  ApproveAbsenceSchema,
  AbsenceResponseSchema,
  AbsenceBalanceQuerySchema,
  AbsenceBalanceResponseSchema,
} from '../schemas/absence.schema.js';
import type {
  RuleSetSchema,
  RuleCheckResultSchema,
} from '../schemas/rule.schema.js';
import type {
  PaginationQuerySchema,
  ErrorEnvelopeSchema,
} from '../schemas/common.schema.js';

// Auth
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;

// Organization
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;
export type Organization = z.infer<typeof OrganizationResponseSchema>;
export type CreateCenter = z.infer<typeof CreateCenterSchema>;
export type UpdateCenter = z.infer<typeof UpdateCenterSchema>;
export type Center = z.infer<typeof CenterResponseSchema>;
export type CreateDepartment = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartment = z.infer<typeof UpdateDepartmentSchema>;
export type Department = z.infer<typeof DepartmentResponseSchema>;

// Employee
export type CreateEmployee = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof UpdateEmployeeSchema>;
export type Employee = z.infer<typeof EmployeeResponseSchema>;
export type WorkingCalendar = z.infer<typeof WorkingCalendarSchema>;
export type CreateWorkingCalendar = z.infer<typeof CreateWorkingCalendarSchema>;

// Shifts
export type ShiftTemplate = z.infer<typeof ShiftTemplateSchema>;
export type ShiftTemplateResponse = z.infer<typeof ShiftTemplateResponseSchema>;
export type RotationPattern = z.infer<typeof RotationPatternSchema>;
export type RotationPatternResponse = z.infer<typeof RotationPatternResponseSchema>;
export type CreateSchedule = z.infer<typeof CreateScheduleSchema>;
export type Schedule = z.infer<typeof ScheduleResponseSchema>;
export type ShiftAssignment = z.infer<typeof ShiftAssignmentSchema>;
export type ShiftAssignmentResponse = z.infer<typeof ShiftAssignmentResponseSchema>;
export type CreateSwap = z.infer<typeof CreateSwapSchema>;
export type SwapResponse = z.infer<typeof SwapResponseSchema>;

// Time entries
export type ClockIn = z.infer<typeof ClockInSchema>;
export type ClockOut = z.infer<typeof ClockOutSchema>;
export type TimeEntry = z.infer<typeof TimeEntryResponseSchema>;
export type CreateCorrection = z.infer<typeof CreateCorrectionSchema>;
export type Correction = z.infer<typeof CorrectionResponseSchema>;
export type OvertimeQuery = z.infer<typeof OvertimeQuerySchema>;

// Absences
export type CreateAbsence = z.infer<typeof CreateAbsenceSchema>;
export type ApproveAbsence = z.infer<typeof ApproveAbsenceSchema>;
export type Absence = z.infer<typeof AbsenceResponseSchema>;
export type AbsenceBalanceQuery = z.infer<typeof AbsenceBalanceQuerySchema>;
export type AbsenceBalance = z.infer<typeof AbsenceBalanceResponseSchema>;

// Rules
export type RuleSet = z.infer<typeof RuleSetSchema>;
export type RuleCheckResult = z.infer<typeof RuleCheckResultSchema>;

// Common
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
