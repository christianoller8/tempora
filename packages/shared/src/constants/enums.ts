// Mirrors of Prisma enums as const arrays for z.enum usage.
// These must stay in sync with backend/prisma/schema.prisma.

export const ROLE_VALUES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;

export const EMPLOYEE_CATEGORY_VALUES = [
  'MEDICO',
  'ENFERMERO',
  'TCAE',
  'FISIOTERAPEUTA',
  'TERAPEUTA_OCUPACIONAL',
  'PSICOLOGO',
  'TRABAJADOR_SOCIAL',
  'CELADOR',
  'ADMINISTRATIVO',
  'COCINERO',
  'AUXILIAR_SERVICIOS',
] as const;

export const CONTRACT_TYPE_VALUES = [
  'INDEFINIDO',
  'TEMPORAL',
  'INTERINIDAD',
  'OBRA_Y_SERVICIO',
  'TIEMPO_PARCIAL',
] as const;

export const SHIFT_TYPE_VALUES = [
  'MANANA',
  'TARDE',
  'NOCHE',
  'GUARDIA',
  'RETEN',
  'REFUERZO',
  'LIBRANZA',
] as const;

export const SCHEDULE_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export const ABSENCE_TYPE_VALUES = [
  'VACACIONES',
  'IT',
  'PERMISO_RETRIBUIDO',
  'AUSENCIA_INJUSTIFICADA',
  'LACTANCIA',
  'REDUCCION_JORNADA',
  'ASUNTOS_PROPIOS',
  'PERMISO_NO_RETRIBUIDO',
  'MATERNIDAD_PATERNIDAD',
] as const;

export const ABSENCE_STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

export const ENTRY_STATUS_VALUES = ['OPEN', 'CLOSED'] as const;

export const CORRECTION_STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const SWAP_STATUS_VALUES = ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

export const RULE_VIOLATION_VALUES = [
  'MIN_REST_12H',
  'MAX_DAILY_9H',
  'MAX_ANNUAL_OT_80H',
  'WEEKLY_REST_1_5_DAYS',
  'CATEGORY_COVERAGE',
  'SHIFT_OVERLAP',
] as const;

export const AUDIT_ACTION_VALUES = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'READ',
  'APPROVE',
  'REJECT',
  'PUBLISH',
  'LOGIN',
  'LOGOUT',
] as const;

// Derived union types
export type Role = (typeof ROLE_VALUES)[number];
export type EmployeeCategory = (typeof EMPLOYEE_CATEGORY_VALUES)[number];
export type ContractType = (typeof CONTRACT_TYPE_VALUES)[number];
export type ShiftType = (typeof SHIFT_TYPE_VALUES)[number];
export type ScheduleStatus = (typeof SCHEDULE_STATUS_VALUES)[number];
export type AbsenceType = (typeof ABSENCE_TYPE_VALUES)[number];
export type AbsenceStatus = (typeof ABSENCE_STATUS_VALUES)[number];
export type EntryStatus = (typeof ENTRY_STATUS_VALUES)[number];
export type CorrectionStatus = (typeof CORRECTION_STATUS_VALUES)[number];
export type SwapStatus = (typeof SWAP_STATUS_VALUES)[number];
export type RuleViolation = (typeof RULE_VIOLATION_VALUES)[number];
export type AuditAction = (typeof AUDIT_ACTION_VALUES)[number];
