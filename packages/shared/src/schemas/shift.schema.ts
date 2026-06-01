import { z } from 'zod';
import {
  SHIFT_TYPE_VALUES,
  SCHEDULE_STATUS_VALUES,
  SWAP_STATUS_VALUES,
} from '../constants/enums.js';

const TimeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format');

export const ShiftTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  shiftType: z.enum(SHIFT_TYPE_VALUES),
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  crossesMidnight: z.boolean().default(false),
  breakMinutes: z.number().int().min(0).default(0),
  categoryRequirements: z.record(z.string(), z.number().int().min(0)).optional(),
});

export const ShiftTemplateResponseSchema = ShiftTemplateSchema.extend({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const RotationPatternSchema = z.object({
  name: z.string().min(1).max(100),
  cycleLength: z.number().int().positive(),
  cycle: z.array(
    z.object({
      day: z.number().int().min(1),
      shiftTemplateId: z.string().uuid().optional(),
      libranza: z.boolean().optional(),
    }),
  ),
});

export const RotationPatternResponseSchema = RotationPatternSchema.extend({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const CreateScheduleSchema = z.object({
  centerId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const PublishScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
});

export const ScheduleResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  centerId: z.string().uuid(),
  departmentId: z.string().uuid().nullable(),
  year: z.number().int(),
  month: z.number().int(),
  status: z.enum(SCHEDULE_STATUS_VALUES),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  publishedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const ShiftAssignmentSchema = z.object({
  scheduleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  shiftTemplateId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ShiftAssignmentResponseSchema = ShiftAssignmentSchema.extend({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const CreateSwapSchema = z.object({
  requesterAssignmentId: z.string().uuid(),
  targetAssignmentId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

export const ApproveSwapSchema = z.object({
  swapId: z.string().uuid(),
});

export const SwapResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  requesterAssignmentId: z.string().uuid(),
  targetAssignmentId: z.string().uuid().nullable(),
  status: z.enum(SWAP_STATUS_VALUES),
  reason: z.string().nullable(),
  approverId: z.string().uuid().nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
