"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/schemas/index.ts
var schemas_exports = {};
__export(schemas_exports, {
  AbsenceBalanceQuerySchema: () => AbsenceBalanceQuerySchema,
  AbsenceBalanceResponseSchema: () => AbsenceBalanceResponseSchema,
  AbsenceResponseSchema: () => AbsenceResponseSchema,
  ApproveAbsenceSchema: () => ApproveAbsenceSchema,
  ApproveCorrectionSchema: () => ApproveCorrectionSchema,
  ApproveSwapSchema: () => ApproveSwapSchema,
  CenterResponseSchema: () => CenterResponseSchema,
  ClockInSchema: () => ClockInSchema,
  ClockOutSchema: () => ClockOutSchema,
  ConfirmTimesheetSchema: () => ConfirmTimesheetSchema,
  ConfirmationStatusQuerySchema: () => ConfirmationStatusQuerySchema,
  ConfirmationStatusRowSchema: () => ConfirmationStatusRowSchema,
  CorrectionResponseSchema: () => CorrectionResponseSchema,
  CreateAbsenceSchema: () => CreateAbsenceSchema,
  CreateCenterSchema: () => CreateCenterSchema,
  CreateCorrectionSchema: () => CreateCorrectionSchema,
  CreateDepartmentSchema: () => CreateDepartmentSchema,
  CreateEmployeeSchema: () => CreateEmployeeSchema,
  CreateOrganizationSchema: () => CreateOrganizationSchema,
  CreateScheduleSchema: () => CreateScheduleSchema,
  CreateSwapSchema: () => CreateSwapSchema,
  CreateWorkingCalendarSchema: () => CreateWorkingCalendarSchema,
  DecisionAbsenceSchema: () => DecisionAbsenceSchema,
  DepartmentResponseSchema: () => DepartmentResponseSchema,
  EmployeeResponseSchema: () => EmployeeResponseSchema,
  ErrorEnvelopeSchema: () => ErrorEnvelopeSchema,
  IsoDateSchema: () => IsoDateSchema,
  IsoDateTimeSchema: () => IsoDateTimeSchema,
  LoginRequestSchema: () => LoginRequestSchema,
  LoginResponseSchema: () => LoginResponseSchema,
  MeResponseSchema: () => MeResponseSchema,
  OperationWithWarningsSchema: () => OperationWithWarningsSchema,
  OrganizationResponseSchema: () => OrganizationResponseSchema,
  OvertimeQuerySchema: () => OvertimeQuerySchema,
  PaginatedResultSchema: () => PaginatedResultSchema,
  PaginationQuerySchema: () => PaginationQuerySchema,
  PublishScheduleSchema: () => PublishScheduleSchema,
  RefreshResponseSchema: () => RefreshResponseSchema,
  RotationPatternResponseSchema: () => RotationPatternResponseSchema,
  RotationPatternSchema: () => RotationPatternSchema,
  RuleCheckResultSchema: () => RuleCheckResultSchema,
  RuleSetSchema: () => RuleSetSchema,
  SSE_EVENT_TYPES: () => SSE_EVENT_TYPES,
  ScheduleResponseSchema: () => ScheduleResponseSchema,
  ShiftAssignmentResponseSchema: () => ShiftAssignmentResponseSchema,
  ShiftAssignmentSchema: () => ShiftAssignmentSchema,
  ShiftTemplateResponseSchema: () => ShiftTemplateResponseSchema,
  ShiftTemplateSchema: () => ShiftTemplateSchema,
  SseEventSchema: () => SseEventSchema,
  SwapResponseSchema: () => SwapResponseSchema,
  TimeEntryResponseSchema: () => TimeEntryResponseSchema,
  TimesheetEntrySchema: () => TimesheetEntrySchema,
  TimesheetSignatureResponseSchema: () => TimesheetSignatureResponseSchema,
  TimesheetSummaryQuerySchema: () => TimesheetSummaryQuerySchema,
  TimesheetSummaryResponseSchema: () => TimesheetSummaryResponseSchema,
  UpdateCenterSchema: () => UpdateCenterSchema,
  UpdateDepartmentSchema: () => UpdateDepartmentSchema,
  UpdateEmployeeSchema: () => UpdateEmployeeSchema,
  UpdateOrganizationSchema: () => UpdateOrganizationSchema,
  UuidSchema: () => UuidSchema,
  WorkingCalendarSchema: () => WorkingCalendarSchema
});
module.exports = __toCommonJS(schemas_exports);

// src/schemas/common.schema.ts
var import_zod = require("zod");
var UuidSchema = import_zod.z.string().uuid();
var IsoDateSchema = import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");
var IsoDateTimeSchema = import_zod.z.string().datetime({ offset: true });
var PaginationQuerySchema = import_zod.z.object({
  page: import_zod.z.coerce.number().int().min(1).default(1),
  pageSize: import_zod.z.coerce.number().int().min(1).max(200).default(20)
});
function PaginatedResultSchema(itemSchema) {
  return import_zod.z.object({
    data: import_zod.z.array(itemSchema),
    total: import_zod.z.number().int().nonnegative(),
    page: import_zod.z.number().int().positive(),
    pageSize: import_zod.z.number().int().positive(),
    totalPages: import_zod.z.number().int().nonnegative()
  });
}
var ErrorEnvelopeSchema = import_zod.z.object({
  code: import_zod.z.string(),
  message: import_zod.z.string(),
  details: import_zod.z.unknown().optional()
});

// src/schemas/auth.schema.ts
var import_zod2 = require("zod");

// src/constants/enums.ts
var ROLE_VALUES = ["ADMIN", "MANAGER", "EMPLOYEE"];
var EMPLOYEE_CATEGORY_VALUES = [
  "MEDICO",
  "ENFERMERO",
  "TCAE",
  "FISIOTERAPEUTA",
  "TERAPEUTA_OCUPACIONAL",
  "PSICOLOGO",
  "TRABAJADOR_SOCIAL",
  "CELADOR",
  "ADMINISTRATIVO",
  "COCINERO",
  "AUXILIAR_SERVICIOS"
];
var CONTRACT_TYPE_VALUES = [
  "INDEFINIDO",
  "TEMPORAL",
  "INTERINIDAD",
  "OBRA_Y_SERVICIO",
  "TIEMPO_PARCIAL"
];
var SHIFT_TYPE_VALUES = [
  "MANANA",
  "TARDE",
  "NOCHE",
  "GUARDIA",
  "RETEN",
  "REFUERZO",
  "LIBRANZA"
];
var SCHEDULE_STATUS_VALUES = ["DRAFT", "PUBLISHED", "ARCHIVED"];
var ABSENCE_TYPE_VALUES = [
  "VACACIONES",
  "IT",
  "PERMISO_RETRIBUIDO",
  "AUSENCIA_INJUSTIFICADA",
  "LACTANCIA",
  "REDUCCION_JORNADA",
  "ASUNTOS_PROPIOS",
  "PERMISO_NO_RETRIBUIDO",
  "MATERNIDAD_PATERNIDAD"
];
var ABSENCE_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
var ENTRY_STATUS_VALUES = ["OPEN", "CLOSED"];
var CORRECTION_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED"];
var SWAP_STATUS_VALUES = ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED"];
var RULE_VIOLATION_VALUES = [
  "MIN_REST_12H",
  "MAX_DAILY_9H",
  "MAX_ANNUAL_OT_80H",
  "WEEKLY_REST_1_5_DAYS",
  "CATEGORY_COVERAGE",
  "SHIFT_OVERLAP"
];

// src/schemas/auth.schema.ts
var LoginRequestSchema = import_zod2.z.object({
  email: import_zod2.z.string().email(),
  password: import_zod2.z.string().min(8)
});
var LoginResponseSchema = import_zod2.z.object({
  accessToken: import_zod2.z.string(),
  user: import_zod2.z.object({
    id: import_zod2.z.string().uuid(),
    email: import_zod2.z.string().email(),
    role: import_zod2.z.enum(ROLE_VALUES),
    organizationId: import_zod2.z.string().uuid(),
    employeeId: import_zod2.z.string().uuid().nullable()
  })
});
var RefreshResponseSchema = import_zod2.z.object({
  accessToken: import_zod2.z.string()
});
var MeResponseSchema = import_zod2.z.object({
  id: import_zod2.z.string().uuid(),
  email: import_zod2.z.string().email(),
  role: import_zod2.z.enum(ROLE_VALUES),
  organizationId: import_zod2.z.string().uuid(),
  employeeId: import_zod2.z.string().uuid().nullable(),
  isActive: import_zod2.z.boolean(),
  lastLoginAt: import_zod2.z.string().datetime({ offset: true }).nullable()
});

// src/schemas/organization.schema.ts
var import_zod3 = require("zod");
var CreateOrganizationSchema = import_zod3.z.object({
  name: import_zod3.z.string().min(1).max(200),
  cif: import_zod3.z.string().max(20).optional()
});
var UpdateOrganizationSchema = CreateOrganizationSchema.partial();
var OrganizationResponseSchema = import_zod3.z.object({
  id: import_zod3.z.string().uuid(),
  name: import_zod3.z.string(),
  cif: import_zod3.z.string().nullable(),
  createdAt: import_zod3.z.string().datetime({ offset: true }),
  updatedAt: import_zod3.z.string().datetime({ offset: true })
});
var CreateCenterSchema = import_zod3.z.object({
  name: import_zod3.z.string().min(1).max(200),
  address: import_zod3.z.string().max(500).optional()
});
var UpdateCenterSchema = CreateCenterSchema.partial();
var CenterResponseSchema = import_zod3.z.object({
  id: import_zod3.z.string().uuid(),
  organizationId: import_zod3.z.string().uuid(),
  name: import_zod3.z.string(),
  address: import_zod3.z.string().nullable(),
  createdAt: import_zod3.z.string().datetime({ offset: true }),
  updatedAt: import_zod3.z.string().datetime({ offset: true })
});
var CreateDepartmentSchema = import_zod3.z.object({
  centerId: import_zod3.z.string().uuid(),
  name: import_zod3.z.string().min(1).max(200)
});
var UpdateDepartmentSchema = CreateDepartmentSchema.partial().omit({ centerId: true });
var DepartmentResponseSchema = import_zod3.z.object({
  id: import_zod3.z.string().uuid(),
  organizationId: import_zod3.z.string().uuid(),
  centerId: import_zod3.z.string().uuid(),
  name: import_zod3.z.string(),
  createdAt: import_zod3.z.string().datetime({ offset: true }),
  updatedAt: import_zod3.z.string().datetime({ offset: true })
});

// src/schemas/employee.schema.ts
var import_zod4 = require("zod");
var WorkingCalendarSchema = import_zod4.z.object({
  id: import_zod4.z.string().uuid(),
  organizationId: import_zod4.z.string().uuid(),
  name: import_zod4.z.string(),
  year: import_zod4.z.number().int().min(2e3).max(2100),
  annualHours: import_zod4.z.number().positive(),
  holidays: import_zod4.z.array(
    import_zod4.z.object({
      date: import_zod4.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      label: import_zod4.z.string()
    })
  ),
  createdAt: import_zod4.z.string().datetime({ offset: true }),
  updatedAt: import_zod4.z.string().datetime({ offset: true })
});
var CreateWorkingCalendarSchema = import_zod4.z.object({
  name: import_zod4.z.string().min(1).max(200),
  year: import_zod4.z.number().int().min(2e3).max(2100),
  annualHours: import_zod4.z.number().positive(),
  holidays: import_zod4.z.array(
    import_zod4.z.object({
      date: import_zod4.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      label: import_zod4.z.string()
    })
  )
});
var CreateEmployeeBaseSchema = import_zod4.z.object({
  firstName: import_zod4.z.string().min(1).max(100),
  lastName: import_zod4.z.string().min(1).max(100),
  nif: import_zod4.z.string().max(20).optional(),
  category: import_zod4.z.enum(EMPLOYEE_CATEGORY_VALUES),
  contractType: import_zod4.z.enum(CONTRACT_TYPE_VALUES),
  contractedHoursPerWeek: import_zod4.z.number().positive().optional(),
  primaryCenterId: import_zod4.z.string().uuid(),
  workingCalendarId: import_zod4.z.string().uuid().optional(),
  hireDate: import_zod4.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
var CreateEmployeeSchema = CreateEmployeeBaseSchema.superRefine(
  (data, ctx) => {
    if (data.contractType === "TIEMPO_PARCIAL") {
      if (data.contractedHoursPerWeek === void 0 || data.contractedHoursPerWeek <= 0) {
        ctx.addIssue({
          code: import_zod4.z.ZodIssueCode.custom,
          message: "contractedHoursPerWeek must be > 0 for TIEMPO_PARCIAL contracts",
          path: ["contractedHoursPerWeek"]
        });
      }
    }
  }
);
var UpdateEmployeeSchema = CreateEmployeeBaseSchema.partial().extend({
  isActive: import_zod4.z.boolean().optional()
});
var EmployeeResponseSchema = import_zod4.z.object({
  id: import_zod4.z.string().uuid(),
  organizationId: import_zod4.z.string().uuid(),
  firstName: import_zod4.z.string(),
  lastName: import_zod4.z.string(),
  nif: import_zod4.z.string().nullable(),
  category: import_zod4.z.enum(EMPLOYEE_CATEGORY_VALUES),
  contractType: import_zod4.z.enum(CONTRACT_TYPE_VALUES),
  contractedHoursPerWeek: import_zod4.z.number(),
  primaryCenterId: import_zod4.z.string().uuid(),
  workingCalendarId: import_zod4.z.string().uuid().nullable(),
  hireDate: import_zod4.z.string(),
  terminationDate: import_zod4.z.string().nullable(),
  isActive: import_zod4.z.boolean(),
  createdAt: import_zod4.z.string().datetime({ offset: true }),
  updatedAt: import_zod4.z.string().datetime({ offset: true })
});

// src/schemas/shift.schema.ts
var import_zod5 = require("zod");
var TimeStringSchema = import_zod5.z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format");
var ShiftTemplateSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(1).max(100),
  shiftType: import_zod5.z.enum(SHIFT_TYPE_VALUES),
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  crossesMidnight: import_zod5.z.boolean().default(false),
  breakMinutes: import_zod5.z.number().int().min(0).default(0),
  categoryRequirements: import_zod5.z.record(import_zod5.z.string(), import_zod5.z.number().int().min(0)).optional()
});
var ShiftTemplateResponseSchema = ShiftTemplateSchema.extend({
  id: import_zod5.z.string().uuid(),
  organizationId: import_zod5.z.string().uuid(),
  createdAt: import_zod5.z.string().datetime({ offset: true }),
  updatedAt: import_zod5.z.string().datetime({ offset: true })
});
var RotationPatternSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(1).max(100),
  cycleLength: import_zod5.z.number().int().positive(),
  cycle: import_zod5.z.array(
    import_zod5.z.object({
      day: import_zod5.z.number().int().min(1),
      shiftTemplateId: import_zod5.z.string().uuid().optional(),
      libranza: import_zod5.z.boolean().optional()
    })
  )
});
var RotationPatternResponseSchema = RotationPatternSchema.extend({
  id: import_zod5.z.string().uuid(),
  organizationId: import_zod5.z.string().uuid(),
  createdAt: import_zod5.z.string().datetime({ offset: true }),
  updatedAt: import_zod5.z.string().datetime({ offset: true })
});
var CreateScheduleSchema = import_zod5.z.object({
  centerId: import_zod5.z.string().uuid(),
  departmentId: import_zod5.z.string().uuid().optional(),
  year: import_zod5.z.number().int().min(2020).max(2100),
  month: import_zod5.z.number().int().min(1).max(12)
});
var PublishScheduleSchema = import_zod5.z.object({
  scheduleId: import_zod5.z.string().uuid()
});
var ScheduleResponseSchema = import_zod5.z.object({
  id: import_zod5.z.string().uuid(),
  organizationId: import_zod5.z.string().uuid(),
  centerId: import_zod5.z.string().uuid(),
  departmentId: import_zod5.z.string().uuid().nullable(),
  year: import_zod5.z.number().int(),
  month: import_zod5.z.number().int(),
  status: import_zod5.z.enum(SCHEDULE_STATUS_VALUES),
  publishedAt: import_zod5.z.string().datetime({ offset: true }).nullable(),
  publishedBy: import_zod5.z.string().uuid().nullable(),
  createdAt: import_zod5.z.string().datetime({ offset: true }),
  updatedAt: import_zod5.z.string().datetime({ offset: true })
});
var ShiftAssignmentSchema = import_zod5.z.object({
  scheduleId: import_zod5.z.string().uuid(),
  employeeId: import_zod5.z.string().uuid(),
  shiftTemplateId: import_zod5.z.string().uuid(),
  departmentId: import_zod5.z.string().uuid().optional(),
  date: import_zod5.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
var ShiftAssignmentResponseSchema = ShiftAssignmentSchema.extend({
  id: import_zod5.z.string().uuid(),
  organizationId: import_zod5.z.string().uuid(),
  createdAt: import_zod5.z.string().datetime({ offset: true }),
  updatedAt: import_zod5.z.string().datetime({ offset: true })
});
var CreateSwapSchema = import_zod5.z.object({
  requesterAssignmentId: import_zod5.z.string().uuid(),
  targetAssignmentId: import_zod5.z.string().uuid().optional(),
  reason: import_zod5.z.string().max(500).optional()
});
var ApproveSwapSchema = import_zod5.z.object({
  swapId: import_zod5.z.string().uuid()
});
var SwapResponseSchema = import_zod5.z.object({
  id: import_zod5.z.string().uuid(),
  organizationId: import_zod5.z.string().uuid(),
  requesterAssignmentId: import_zod5.z.string().uuid(),
  targetAssignmentId: import_zod5.z.string().uuid().nullable(),
  status: import_zod5.z.enum(SWAP_STATUS_VALUES),
  reason: import_zod5.z.string().nullable(),
  approverId: import_zod5.z.string().uuid().nullable(),
  decidedAt: import_zod5.z.string().datetime({ offset: true }).nullable(),
  createdAt: import_zod5.z.string().datetime({ offset: true }),
  updatedAt: import_zod5.z.string().datetime({ offset: true })
});

// src/schemas/time-entry.schema.ts
var import_zod6 = require("zod");
var ClockInSchema = import_zod6.z.object({
  // source is optional — defaults to 'web' on the server
  source: import_zod6.z.enum(["web", "kiosk", "api"]).optional(),
  // capturedAtClient is metadata only; server timestamp is authoritative
  capturedAtClient: import_zod6.z.string().datetime({ offset: true }).optional()
});
var ClockOutSchema = import_zod6.z.object({
  source: import_zod6.z.enum(["web", "kiosk", "api"]).optional(),
  capturedAtClient: import_zod6.z.string().datetime({ offset: true }).optional()
});
var TimeEntryResponseSchema = import_zod6.z.object({
  id: import_zod6.z.string().uuid(),
  organizationId: import_zod6.z.string().uuid(),
  employeeId: import_zod6.z.string().uuid(),
  clockIn: import_zod6.z.string().datetime({ offset: true }),
  clockOut: import_zod6.z.string().datetime({ offset: true }).nullable(),
  status: import_zod6.z.enum(ENTRY_STATUS_VALUES),
  source: import_zod6.z.string(),
  capturedAtClient: import_zod6.z.string().datetime({ offset: true }).nullable(),
  createdAt: import_zod6.z.string().datetime({ offset: true })
});
var CreateCorrectionSchema = import_zod6.z.object({
  timeEntryId: import_zod6.z.string().uuid(),
  proposedClockIn: import_zod6.z.string().datetime({ offset: true }).optional(),
  proposedClockOut: import_zod6.z.string().datetime({ offset: true }).optional(),
  justification: import_zod6.z.string().min(1).max(1e3)
});
var ApproveCorrectionSchema = import_zod6.z.object({
  correctionId: import_zod6.z.string().uuid()
});
var CorrectionResponseSchema = import_zod6.z.object({
  id: import_zod6.z.string().uuid(),
  organizationId: import_zod6.z.string().uuid(),
  timeEntryId: import_zod6.z.string().uuid(),
  requestedById: import_zod6.z.string().uuid(),
  proposedClockIn: import_zod6.z.string().datetime({ offset: true }).nullable(),
  proposedClockOut: import_zod6.z.string().datetime({ offset: true }).nullable(),
  justification: import_zod6.z.string(),
  status: import_zod6.z.enum(CORRECTION_STATUS_VALUES),
  approverId: import_zod6.z.string().uuid().nullable(),
  decidedAt: import_zod6.z.string().datetime({ offset: true }).nullable(),
  createdAt: import_zod6.z.string().datetime({ offset: true }),
  updatedAt: import_zod6.z.string().datetime({ offset: true })
});
var OvertimeQuerySchema = import_zod6.z.object({
  employeeId: import_zod6.z.string().uuid().optional(),
  year: import_zod6.z.coerce.number().int().min(2020).max(2100)
});

// src/schemas/absence.schema.ts
var import_zod7 = require("zod");
var CreateAbsenceSchema = import_zod7.z.object({
  employeeId: import_zod7.z.string().uuid(),
  type: import_zod7.z.enum(ABSENCE_TYPE_VALUES),
  startDate: import_zod7.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: import_zod7.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // cause is only applicable for IT (incapacidad temporal) — special-category field.
  // Transmitted in plaintext; encrypted at the application layer before storage.
  cause: import_zod7.z.string().max(2e3).optional()
});
var DecisionAbsenceSchema = import_zod7.z.object({
  comment: import_zod7.z.string().max(500).optional()
});
var ApproveAbsenceSchema = DecisionAbsenceSchema;
var AbsenceBalanceQuerySchema = import_zod7.z.object({
  employeeId: import_zod7.z.string().uuid().optional(),
  year: import_zod7.z.coerce.number().int().min(2020).max(2100)
});
var AbsenceResponseSchema = import_zod7.z.object({
  id: import_zod7.z.string().uuid(),
  organizationId: import_zod7.z.string().uuid(),
  employeeId: import_zod7.z.string().uuid(),
  type: import_zod7.z.enum(ABSENCE_TYPE_VALUES),
  startDate: import_zod7.z.string(),
  endDate: import_zod7.z.string(),
  status: import_zod7.z.enum(ABSENCE_STATUS_VALUES),
  // causeEncrypted is NEVER returned; only the decrypted cause is returned to authorized users
  // and ONLY after an AuditLog READ row is written first.
  cause: import_zod7.z.string().nullable().optional(),
  approverId: import_zod7.z.string().uuid().nullable(),
  decidedAt: import_zod7.z.string().datetime({ offset: true }).nullable(),
  decisionComment: import_zod7.z.string().nullable(),
  createdAt: import_zod7.z.string().datetime({ offset: true }),
  updatedAt: import_zod7.z.string().datetime({ offset: true })
});
var AbsenceBalanceResponseSchema = import_zod7.z.object({
  employeeId: import_zod7.z.string().uuid(),
  year: import_zod7.z.number().int(),
  entitled: import_zod7.z.number(),
  used: import_zod7.z.number(),
  remaining: import_zod7.z.number()
});

// src/schemas/rule.schema.ts
var import_zod8 = require("zod");
var RuleSetSchema = import_zod8.z.object({
  id: import_zod8.z.string().uuid().optional(),
  name: import_zod8.z.string().min(1).max(100),
  isDefault: import_zod8.z.boolean().default(false),
  minRestHours: import_zod8.z.number().positive().default(12),
  maxDailyHours: import_zod8.z.number().positive().default(9),
  maxAnnualOvertime: import_zod8.z.number().positive().default(80),
  weeklyRestDays: import_zod8.z.number().positive().default(1.5),
  params: import_zod8.z.record(import_zod8.z.string(), import_zod8.z.unknown()).optional()
});
var RuleCheckResultSchema = import_zod8.z.object({
  type: import_zod8.z.enum(["block", "warn"]),
  code: import_zod8.z.enum(RULE_VIOLATION_VALUES),
  message: import_zod8.z.string(),
  meta: import_zod8.z.record(import_zod8.z.string(), import_zod8.z.unknown()).optional()
});
var OperationWithWarningsSchema = (dataSchema) => import_zod8.z.object({
  data: dataSchema,
  warnings: import_zod8.z.array(RuleCheckResultSchema)
});

// src/schemas/sse.schema.ts
var import_zod9 = require("zod");
var SSE_EVENT_TYPES = {
  CLOCK_IN: "CLOCK_IN",
  CLOCK_OUT: "CLOCK_OUT",
  SHIFT_PUBLISHED: "SHIFT_PUBLISHED",
  SWAP_REQUESTED: "SWAP_REQUESTED",
  SWAP_APPROVED: "SWAP_APPROVED",
  NOTIFICATION: "NOTIFICATION",
  NOTIFICATION_READ: "NOTIFICATION_READ"
};
var SseEventSchema = import_zod9.z.object({
  type: import_zod9.z.enum([
    "CLOCK_IN",
    "CLOCK_OUT",
    "SHIFT_PUBLISHED",
    "SWAP_REQUESTED",
    "SWAP_APPROVED",
    "NOTIFICATION",
    "NOTIFICATION_READ"
  ]),
  organizationId: import_zod9.z.string().uuid(),
  targetUserId: import_zod9.z.string().uuid().optional(),
  targetRole: import_zod9.z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
  payload: import_zod9.z.unknown(),
  emittedAt: import_zod9.z.string()
});

// src/schemas/timesheet-signature.schema.ts
var import_zod10 = require("zod");
var ConfirmTimesheetSchema = import_zod10.z.object({
  year: import_zod10.z.number().int().min(2020).max(2100),
  month: import_zod10.z.number().int().min(1).max(12)
});
var TimesheetSummaryQuerySchema = import_zod10.z.object({
  employeeId: import_zod10.z.string().uuid().optional(),
  year: import_zod10.z.coerce.number().int().min(2020).max(2100),
  month: import_zod10.z.coerce.number().int().min(1).max(12)
});
var ConfirmationStatusQuerySchema = import_zod10.z.object({
  year: import_zod10.z.coerce.number().int().min(2020).max(2100),
  month: import_zod10.z.coerce.number().int().min(1).max(12),
  centerId: import_zod10.z.string().uuid().optional()
});
var TimesheetSignatureResponseSchema = import_zod10.z.object({
  id: import_zod10.z.string().uuid(),
  organizationId: import_zod10.z.string().uuid(),
  employeeId: import_zod10.z.string().uuid(),
  year: import_zod10.z.number().int(),
  month: import_zod10.z.number().int(),
  confirmedAt: import_zod10.z.string().datetime({ offset: true }),
  createdAt: import_zod10.z.string().datetime({ offset: true }),
  alreadyConfirmed: import_zod10.z.boolean()
});
var TimesheetEntrySchema = import_zod10.z.object({
  id: import_zod10.z.string().uuid(),
  clockIn: import_zod10.z.string().datetime({ offset: true }),
  clockOut: import_zod10.z.string().datetime({ offset: true }).nullable(),
  status: import_zod10.z.enum(["OPEN", "CLOSED"]),
  durationMinutes: import_zod10.z.number().int().nullable()
});
var TimesheetSummaryResponseSchema = import_zod10.z.object({
  year: import_zod10.z.number().int(),
  month: import_zod10.z.number().int(),
  employeeId: import_zod10.z.string().uuid(),
  hours: import_zod10.z.object({
    regularHours: import_zod10.z.number(),
    overtimeHours: import_zod10.z.number(),
    partTimeDeviation: import_zod10.z.number()
  }).nullable(),
  confirmed: import_zod10.z.boolean(),
  confirmedAt: import_zod10.z.string().datetime({ offset: true }).nullable(),
  hasOpenEntry: import_zod10.z.boolean(),
  totalAbsenceDays: import_zod10.z.number().int().nonnegative(),
  entries: import_zod10.z.array(TimesheetEntrySchema)
});
var ConfirmationStatusRowSchema = import_zod10.z.object({
  employeeId: import_zod10.z.string().uuid(),
  firstName: import_zod10.z.string(),
  lastName: import_zod10.z.string(),
  confirmed: import_zod10.z.boolean(),
  confirmedAt: import_zod10.z.string().datetime({ offset: true }).nullable()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AbsenceBalanceQuerySchema,
  AbsenceBalanceResponseSchema,
  AbsenceResponseSchema,
  ApproveAbsenceSchema,
  ApproveCorrectionSchema,
  ApproveSwapSchema,
  CenterResponseSchema,
  ClockInSchema,
  ClockOutSchema,
  ConfirmTimesheetSchema,
  ConfirmationStatusQuerySchema,
  ConfirmationStatusRowSchema,
  CorrectionResponseSchema,
  CreateAbsenceSchema,
  CreateCenterSchema,
  CreateCorrectionSchema,
  CreateDepartmentSchema,
  CreateEmployeeSchema,
  CreateOrganizationSchema,
  CreateScheduleSchema,
  CreateSwapSchema,
  CreateWorkingCalendarSchema,
  DecisionAbsenceSchema,
  DepartmentResponseSchema,
  EmployeeResponseSchema,
  ErrorEnvelopeSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  MeResponseSchema,
  OperationWithWarningsSchema,
  OrganizationResponseSchema,
  OvertimeQuerySchema,
  PaginatedResultSchema,
  PaginationQuerySchema,
  PublishScheduleSchema,
  RefreshResponseSchema,
  RotationPatternResponseSchema,
  RotationPatternSchema,
  RuleCheckResultSchema,
  RuleSetSchema,
  SSE_EVENT_TYPES,
  ScheduleResponseSchema,
  ShiftAssignmentResponseSchema,
  ShiftAssignmentSchema,
  ShiftTemplateResponseSchema,
  ShiftTemplateSchema,
  SseEventSchema,
  SwapResponseSchema,
  TimeEntryResponseSchema,
  TimesheetEntrySchema,
  TimesheetSignatureResponseSchema,
  TimesheetSummaryQuerySchema,
  TimesheetSummaryResponseSchema,
  UpdateCenterSchema,
  UpdateDepartmentSchema,
  UpdateEmployeeSchema,
  UpdateOrganizationSchema,
  UuidSchema,
  WorkingCalendarSchema
});
