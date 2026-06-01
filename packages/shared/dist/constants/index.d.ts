declare const ROLES: readonly ["ADMIN", "MANAGER", "EMPLOYEE"];
type RoleName = (typeof ROLES)[number];

declare const PERMISSIONS: {
    readonly 'employees:write': readonly ["ADMIN"];
    readonly 'employees:read': readonly ["ADMIN", "MANAGER"];
    readonly 'shifts:write': readonly ["ADMIN", "MANAGER"];
    readonly 'shifts:publish': readonly ["ADMIN", "MANAGER"];
    readonly 'time:approve': readonly ["ADMIN", "MANAGER"];
    readonly 'time:clock-self': readonly ["ADMIN", "MANAGER", "EMPLOYEE"];
    readonly 'swaps:request': readonly ["ADMIN", "MANAGER", "EMPLOYEE"];
    readonly 'swaps:approve': readonly ["ADMIN", "MANAGER"];
    readonly 'absences:approve': readonly ["ADMIN", "MANAGER"];
    readonly 'reports:export': readonly ["ADMIN", "MANAGER"];
    readonly 'centers:manage': readonly ["ADMIN"];
};
type Permission = keyof typeof PERMISSIONS;

declare const ROLE_VALUES: readonly ["ADMIN", "MANAGER", "EMPLOYEE"];
declare const EMPLOYEE_CATEGORY_VALUES: readonly ["MEDICO", "ENFERMERO", "TCAE", "FISIOTERAPEUTA", "TERAPEUTA_OCUPACIONAL", "PSICOLOGO", "TRABAJADOR_SOCIAL", "CELADOR", "ADMINISTRATIVO", "COCINERO", "AUXILIAR_SERVICIOS"];
declare const CONTRACT_TYPE_VALUES: readonly ["INDEFINIDO", "TEMPORAL", "INTERINIDAD", "OBRA_Y_SERVICIO", "TIEMPO_PARCIAL"];
declare const SHIFT_TYPE_VALUES: readonly ["MANANA", "TARDE", "NOCHE", "GUARDIA", "RETEN", "REFUERZO", "LIBRANZA"];
declare const SCHEDULE_STATUS_VALUES: readonly ["DRAFT", "PUBLISHED", "ARCHIVED"];
declare const ABSENCE_TYPE_VALUES: readonly ["VACACIONES", "IT", "PERMISO_RETRIBUIDO", "AUSENCIA_INJUSTIFICADA", "LACTANCIA", "REDUCCION_JORNADA"];
declare const ABSENCE_STATUS_VALUES: readonly ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
declare const ENTRY_STATUS_VALUES: readonly ["OPEN", "CLOSED"];
declare const CORRECTION_STATUS_VALUES: readonly ["PENDING", "APPROVED", "REJECTED"];
declare const SWAP_STATUS_VALUES: readonly ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED"];
declare const RULE_VIOLATION_VALUES: readonly ["MIN_REST_12H", "MAX_DAILY_9H", "MAX_ANNUAL_OT_80H", "WEEKLY_REST_1_5_DAYS", "CATEGORY_COVERAGE", "SHIFT_OVERLAP"];
declare const AUDIT_ACTION_VALUES: readonly ["CREATE", "UPDATE", "DELETE", "READ", "APPROVE", "REJECT", "PUBLISH", "LOGIN", "LOGOUT"];
type Role = (typeof ROLE_VALUES)[number];
type EmployeeCategory = (typeof EMPLOYEE_CATEGORY_VALUES)[number];
type ContractType = (typeof CONTRACT_TYPE_VALUES)[number];
type ShiftType = (typeof SHIFT_TYPE_VALUES)[number];
type ScheduleStatus = (typeof SCHEDULE_STATUS_VALUES)[number];
type AbsenceType = (typeof ABSENCE_TYPE_VALUES)[number];
type AbsenceStatus = (typeof ABSENCE_STATUS_VALUES)[number];
type EntryStatus = (typeof ENTRY_STATUS_VALUES)[number];
type CorrectionStatus = (typeof CORRECTION_STATUS_VALUES)[number];
type SwapStatus = (typeof SWAP_STATUS_VALUES)[number];
type RuleViolation = (typeof RULE_VIOLATION_VALUES)[number];
type AuditAction = (typeof AUDIT_ACTION_VALUES)[number];

declare const ERROR_CODES: {
    readonly INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly CONFLICT: "CONFLICT";
    readonly UNAUTHENTICATED: "UNAUTHENTICATED";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly TOKEN_BLOCKLISTED: "TOKEN_BLOCKLISTED";
    readonly NO_TENANT_CONTEXT: "NO_TENANT_CONTEXT";
    readonly TENANT_MISMATCH: "TENANT_MISMATCH";
    readonly RULE_VIOLATION: "RULE_VIOLATION";
    readonly DUPLICATE_CLOCK_IN: "DUPLICATE_CLOCK_IN";
    readonly NO_OPEN_ENTRY: "NO_OPEN_ENTRY";
    readonly INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE";
    readonly OVERLAPPING_ABSENCE: "OVERLAPPING_ABSENCE";
    readonly SCHEDULE_ALREADY_PUBLISHED: "SCHEDULE_ALREADY_PUBLISHED";
    readonly DEPENDENCY_CONFLICT: "DEPENDENCY_CONFLICT";
};
type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export { ABSENCE_STATUS_VALUES, ABSENCE_TYPE_VALUES, AUDIT_ACTION_VALUES, type AbsenceStatus, type AbsenceType, type AuditAction, CONTRACT_TYPE_VALUES, CORRECTION_STATUS_VALUES, type ContractType, type CorrectionStatus, EMPLOYEE_CATEGORY_VALUES, ENTRY_STATUS_VALUES, ERROR_CODES, type EmployeeCategory, type EntryStatus, type ErrorCode, PERMISSIONS, type Permission, ROLES, ROLE_VALUES, RULE_VIOLATION_VALUES, type Role, type RoleName, type RuleViolation, SCHEDULE_STATUS_VALUES, SHIFT_TYPE_VALUES, SWAP_STATUS_VALUES, type ScheduleStatus, type ShiftType, type SwapStatus };
