import {
  ABSENCE_STATUS_VALUES,
  ABSENCE_TYPE_VALUES,
  CONTRACT_TYPE_VALUES,
  CORRECTION_STATUS_VALUES,
  EMPLOYEE_CATEGORY_VALUES,
  ENTRY_STATUS_VALUES,
  ROLE_VALUES,
  RULE_VIOLATION_VALUES,
  SCHEDULE_STATUS_VALUES,
  SHIFT_TYPE_VALUES,
  SWAP_STATUS_VALUES
} from "./chunk-EJUHZAQG.js";

// src/schemas/common.schema.ts
import { z } from "zod";
var UuidSchema = z.string().uuid();
var IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");
var IsoDateTimeSchema = z.string().datetime({ offset: true });
var PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20)
});
function PaginatedResultSchema(itemSchema) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative()
  });
}
var ErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});

// src/schemas/auth.schema.ts
import { z as z2 } from "zod";
var LoginRequestSchema = z2.object({
  email: z2.string().email(),
  password: z2.string().min(8)
});
var LoginResponseSchema = z2.object({
  accessToken: z2.string(),
  user: z2.object({
    id: z2.string().uuid(),
    email: z2.string().email(),
    role: z2.enum(ROLE_VALUES),
    organizationId: z2.string().uuid(),
    employeeId: z2.string().uuid().nullable()
  })
});
var RefreshResponseSchema = z2.object({
  accessToken: z2.string()
});
var MeResponseSchema = z2.object({
  id: z2.string().uuid(),
  email: z2.string().email(),
  role: z2.enum(ROLE_VALUES),
  organizationId: z2.string().uuid(),
  employeeId: z2.string().uuid().nullable(),
  isActive: z2.boolean(),
  lastLoginAt: z2.string().datetime({ offset: true }).nullable()
});

// src/schemas/organization.schema.ts
import { z as z3 } from "zod";
var CreateOrganizationSchema = z3.object({
  name: z3.string().min(1).max(200),
  cif: z3.string().max(20).optional()
});
var UpdateOrganizationSchema = CreateOrganizationSchema.partial();
var OrganizationResponseSchema = z3.object({
  id: z3.string().uuid(),
  name: z3.string(),
  cif: z3.string().nullable(),
  createdAt: z3.string().datetime({ offset: true }),
  updatedAt: z3.string().datetime({ offset: true })
});
var CreateCenterSchema = z3.object({
  name: z3.string().min(1).max(200),
  address: z3.string().max(500).optional()
});
var UpdateCenterSchema = CreateCenterSchema.partial();
var CenterResponseSchema = z3.object({
  id: z3.string().uuid(),
  organizationId: z3.string().uuid(),
  name: z3.string(),
  address: z3.string().nullable(),
  createdAt: z3.string().datetime({ offset: true }),
  updatedAt: z3.string().datetime({ offset: true })
});
var CreateDepartmentSchema = z3.object({
  centerId: z3.string().uuid(),
  name: z3.string().min(1).max(200)
});
var UpdateDepartmentSchema = CreateDepartmentSchema.partial().omit({ centerId: true });
var DepartmentResponseSchema = z3.object({
  id: z3.string().uuid(),
  organizationId: z3.string().uuid(),
  centerId: z3.string().uuid(),
  name: z3.string(),
  createdAt: z3.string().datetime({ offset: true }),
  updatedAt: z3.string().datetime({ offset: true })
});

// src/schemas/employee.schema.ts
import { z as z4 } from "zod";
var WorkingCalendarSchema = z4.object({
  id: z4.string().uuid(),
  organizationId: z4.string().uuid(),
  name: z4.string(),
  year: z4.number().int().min(2e3).max(2100),
  annualHours: z4.number().positive(),
  holidays: z4.array(
    z4.object({
      date: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      label: z4.string()
    })
  ),
  createdAt: z4.string().datetime({ offset: true }),
  updatedAt: z4.string().datetime({ offset: true })
});
var CreateWorkingCalendarSchema = z4.object({
  name: z4.string().min(1).max(200),
  year: z4.number().int().min(2e3).max(2100),
  annualHours: z4.number().positive(),
  holidays: z4.array(
    z4.object({
      date: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      label: z4.string()
    })
  )
});
var CreateEmployeeBaseSchema = z4.object({
  firstName: z4.string().min(1).max(100),
  lastName: z4.string().min(1).max(100),
  nif: z4.string().max(20).optional(),
  category: z4.enum(EMPLOYEE_CATEGORY_VALUES),
  contractType: z4.enum(CONTRACT_TYPE_VALUES),
  contractedHoursPerWeek: z4.number().positive().optional(),
  primaryCenterId: z4.string().uuid(),
  workingCalendarId: z4.string().uuid().optional(),
  hireDate: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
var CreateEmployeeSchema = CreateEmployeeBaseSchema.superRefine(
  (data, ctx) => {
    if (data.contractType === "TIEMPO_PARCIAL") {
      if (data.contractedHoursPerWeek === void 0 || data.contractedHoursPerWeek <= 0) {
        ctx.addIssue({
          code: z4.ZodIssueCode.custom,
          message: "contractedHoursPerWeek must be > 0 for TIEMPO_PARCIAL contracts",
          path: ["contractedHoursPerWeek"]
        });
      }
    }
  }
);
var UpdateEmployeeSchema = CreateEmployeeBaseSchema.partial();
var EmployeeResponseSchema = z4.object({
  id: z4.string().uuid(),
  organizationId: z4.string().uuid(),
  firstName: z4.string(),
  lastName: z4.string(),
  nif: z4.string().nullable(),
  category: z4.enum(EMPLOYEE_CATEGORY_VALUES),
  contractType: z4.enum(CONTRACT_TYPE_VALUES),
  contractedHoursPerWeek: z4.number(),
  primaryCenterId: z4.string().uuid(),
  workingCalendarId: z4.string().uuid().nullable(),
  hireDate: z4.string(),
  terminationDate: z4.string().nullable(),
  isActive: z4.boolean(),
  createdAt: z4.string().datetime({ offset: true }),
  updatedAt: z4.string().datetime({ offset: true })
});

// src/schemas/shift.schema.ts
import { z as z5 } from "zod";
var TimeStringSchema = z5.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format");
var ShiftTemplateSchema = z5.object({
  name: z5.string().min(1).max(100),
  shiftType: z5.enum(SHIFT_TYPE_VALUES),
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  crossesMidnight: z5.boolean().default(false),
  breakMinutes: z5.number().int().min(0).default(0),
  categoryRequirements: z5.record(z5.string(), z5.number().int().min(0)).optional()
});
var ShiftTemplateResponseSchema = ShiftTemplateSchema.extend({
  id: z5.string().uuid(),
  organizationId: z5.string().uuid(),
  createdAt: z5.string().datetime({ offset: true }),
  updatedAt: z5.string().datetime({ offset: true })
});
var RotationPatternSchema = z5.object({
  name: z5.string().min(1).max(100),
  cycleLength: z5.number().int().positive(),
  cycle: z5.array(
    z5.object({
      day: z5.number().int().min(1),
      shiftTemplateId: z5.string().uuid().optional(),
      libranza: z5.boolean().optional()
    })
  )
});
var RotationPatternResponseSchema = RotationPatternSchema.extend({
  id: z5.string().uuid(),
  organizationId: z5.string().uuid(),
  createdAt: z5.string().datetime({ offset: true }),
  updatedAt: z5.string().datetime({ offset: true })
});
var CreateScheduleSchema = z5.object({
  centerId: z5.string().uuid(),
  departmentId: z5.string().uuid().optional(),
  year: z5.number().int().min(2020).max(2100),
  month: z5.number().int().min(1).max(12)
});
var PublishScheduleSchema = z5.object({
  scheduleId: z5.string().uuid()
});
var ScheduleResponseSchema = z5.object({
  id: z5.string().uuid(),
  organizationId: z5.string().uuid(),
  centerId: z5.string().uuid(),
  departmentId: z5.string().uuid().nullable(),
  year: z5.number().int(),
  month: z5.number().int(),
  status: z5.enum(SCHEDULE_STATUS_VALUES),
  publishedAt: z5.string().datetime({ offset: true }).nullable(),
  publishedBy: z5.string().uuid().nullable(),
  createdAt: z5.string().datetime({ offset: true }),
  updatedAt: z5.string().datetime({ offset: true })
});
var ShiftAssignmentSchema = z5.object({
  scheduleId: z5.string().uuid(),
  employeeId: z5.string().uuid(),
  shiftTemplateId: z5.string().uuid(),
  departmentId: z5.string().uuid().optional(),
  date: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
var ShiftAssignmentResponseSchema = ShiftAssignmentSchema.extend({
  id: z5.string().uuid(),
  organizationId: z5.string().uuid(),
  createdAt: z5.string().datetime({ offset: true }),
  updatedAt: z5.string().datetime({ offset: true })
});
var CreateSwapSchema = z5.object({
  requesterAssignmentId: z5.string().uuid(),
  targetAssignmentId: z5.string().uuid().optional(),
  reason: z5.string().max(500).optional()
});
var ApproveSwapSchema = z5.object({
  swapId: z5.string().uuid()
});
var SwapResponseSchema = z5.object({
  id: z5.string().uuid(),
  organizationId: z5.string().uuid(),
  requesterAssignmentId: z5.string().uuid(),
  targetAssignmentId: z5.string().uuid().nullable(),
  status: z5.enum(SWAP_STATUS_VALUES),
  reason: z5.string().nullable(),
  approverId: z5.string().uuid().nullable(),
  decidedAt: z5.string().datetime({ offset: true }).nullable(),
  createdAt: z5.string().datetime({ offset: true }),
  updatedAt: z5.string().datetime({ offset: true })
});

// src/schemas/time-entry.schema.ts
import { z as z6 } from "zod";
var ClockInSchema = z6.object({
  // source is optional — defaults to 'web' on the server
  source: z6.enum(["web", "kiosk", "api"]).optional(),
  // capturedAtClient is metadata only; server timestamp is authoritative
  capturedAtClient: z6.string().datetime({ offset: true }).optional()
});
var ClockOutSchema = z6.object({
  source: z6.enum(["web", "kiosk", "api"]).optional(),
  capturedAtClient: z6.string().datetime({ offset: true }).optional()
});
var TimeEntryResponseSchema = z6.object({
  id: z6.string().uuid(),
  organizationId: z6.string().uuid(),
  employeeId: z6.string().uuid(),
  clockIn: z6.string().datetime({ offset: true }),
  clockOut: z6.string().datetime({ offset: true }).nullable(),
  status: z6.enum(ENTRY_STATUS_VALUES),
  source: z6.string(),
  capturedAtClient: z6.string().datetime({ offset: true }).nullable(),
  createdAt: z6.string().datetime({ offset: true })
});
var CreateCorrectionSchema = z6.object({
  timeEntryId: z6.string().uuid(),
  proposedClockIn: z6.string().datetime({ offset: true }).optional(),
  proposedClockOut: z6.string().datetime({ offset: true }).optional(),
  justification: z6.string().min(1).max(1e3)
});
var ApproveCorrectionSchema = z6.object({
  correctionId: z6.string().uuid()
});
var CorrectionResponseSchema = z6.object({
  id: z6.string().uuid(),
  organizationId: z6.string().uuid(),
  timeEntryId: z6.string().uuid(),
  requestedById: z6.string().uuid(),
  proposedClockIn: z6.string().datetime({ offset: true }).nullable(),
  proposedClockOut: z6.string().datetime({ offset: true }).nullable(),
  justification: z6.string(),
  status: z6.enum(CORRECTION_STATUS_VALUES),
  approverId: z6.string().uuid().nullable(),
  decidedAt: z6.string().datetime({ offset: true }).nullable(),
  createdAt: z6.string().datetime({ offset: true }),
  updatedAt: z6.string().datetime({ offset: true })
});
var OvertimeQuerySchema = z6.object({
  employeeId: z6.string().uuid().optional(),
  year: z6.coerce.number().int().min(2020).max(2100)
});

// src/schemas/absence.schema.ts
import { z as z7 } from "zod";
var CreateAbsenceSchema = z7.object({
  employeeId: z7.string().uuid(),
  type: z7.enum(ABSENCE_TYPE_VALUES),
  startDate: z7.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z7.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // cause is only applicable for IT (incapacidad temporal) — special-category field.
  // Transmitted in plaintext; encrypted at the application layer before storage.
  cause: z7.string().max(2e3).optional()
});
var ApproveAbsenceSchema = z7.object({
  absenceId: z7.string().uuid()
});
var AbsenceBalanceQuerySchema = z7.object({
  employeeId: z7.string().uuid().optional(),
  year: z7.coerce.number().int().min(2020).max(2100)
});
var AbsenceResponseSchema = z7.object({
  id: z7.string().uuid(),
  organizationId: z7.string().uuid(),
  employeeId: z7.string().uuid(),
  type: z7.enum(ABSENCE_TYPE_VALUES),
  startDate: z7.string(),
  endDate: z7.string(),
  status: z7.enum(ABSENCE_STATUS_VALUES),
  // causeEncrypted is NEVER returned; only the decrypted cause is returned to authorized users
  // and ONLY after an AuditLog READ row is written first.
  cause: z7.string().nullable().optional(),
  approverId: z7.string().uuid().nullable(),
  decidedAt: z7.string().datetime({ offset: true }).nullable(),
  createdAt: z7.string().datetime({ offset: true }),
  updatedAt: z7.string().datetime({ offset: true })
});
var AbsenceBalanceResponseSchema = z7.object({
  employeeId: z7.string().uuid(),
  year: z7.number().int(),
  entitled: z7.number(),
  used: z7.number(),
  remaining: z7.number()
});

// src/schemas/rule.schema.ts
import { z as z8 } from "zod";
var RuleSetSchema = z8.object({
  id: z8.string().uuid().optional(),
  name: z8.string().min(1).max(100),
  isDefault: z8.boolean().default(false),
  minRestHours: z8.number().positive().default(12),
  maxDailyHours: z8.number().positive().default(9),
  maxAnnualOvertime: z8.number().positive().default(80),
  weeklyRestDays: z8.number().positive().default(1.5),
  params: z8.record(z8.string(), z8.unknown()).optional()
});
var RuleCheckResultSchema = z8.object({
  type: z8.enum(["block", "warn"]),
  code: z8.enum(RULE_VIOLATION_VALUES),
  message: z8.string(),
  meta: z8.record(z8.string(), z8.unknown()).optional()
});
var OperationWithWarningsSchema = (dataSchema) => z8.object({
  data: dataSchema,
  warnings: z8.array(RuleCheckResultSchema)
});

// src/schemas/sse.schema.ts
import { z as z9 } from "zod";
var SSE_EVENT_TYPES = {
  CLOCK_IN: "CLOCK_IN",
  CLOCK_OUT: "CLOCK_OUT",
  SHIFT_PUBLISHED: "SHIFT_PUBLISHED",
  SWAP_REQUESTED: "SWAP_REQUESTED",
  SWAP_APPROVED: "SWAP_APPROVED",
  NOTIFICATION: "NOTIFICATION",
  NOTIFICATION_READ: "NOTIFICATION_READ"
};
var SseEventSchema = z9.object({
  type: z9.enum([
    "CLOCK_IN",
    "CLOCK_OUT",
    "SHIFT_PUBLISHED",
    "SWAP_REQUESTED",
    "SWAP_APPROVED",
    "NOTIFICATION",
    "NOTIFICATION_READ"
  ]),
  organizationId: z9.string().uuid(),
  targetUserId: z9.string().uuid().optional(),
  targetRole: z9.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
  payload: z9.unknown(),
  emittedAt: z9.string()
});

export {
  UuidSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  PaginationQuerySchema,
  PaginatedResultSchema,
  ErrorEnvelopeSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  RefreshResponseSchema,
  MeResponseSchema,
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  OrganizationResponseSchema,
  CreateCenterSchema,
  UpdateCenterSchema,
  CenterResponseSchema,
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  DepartmentResponseSchema,
  WorkingCalendarSchema,
  CreateWorkingCalendarSchema,
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  EmployeeResponseSchema,
  ShiftTemplateSchema,
  ShiftTemplateResponseSchema,
  RotationPatternSchema,
  RotationPatternResponseSchema,
  CreateScheduleSchema,
  PublishScheduleSchema,
  ScheduleResponseSchema,
  ShiftAssignmentSchema,
  ShiftAssignmentResponseSchema,
  CreateSwapSchema,
  ApproveSwapSchema,
  SwapResponseSchema,
  ClockInSchema,
  ClockOutSchema,
  TimeEntryResponseSchema,
  CreateCorrectionSchema,
  ApproveCorrectionSchema,
  CorrectionResponseSchema,
  OvertimeQuerySchema,
  CreateAbsenceSchema,
  ApproveAbsenceSchema,
  AbsenceBalanceQuerySchema,
  AbsenceResponseSchema,
  AbsenceBalanceResponseSchema,
  RuleSetSchema,
  RuleCheckResultSchema,
  OperationWithWarningsSchema,
  SSE_EVENT_TYPES,
  SseEventSchema
};
