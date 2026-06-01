import { z } from 'zod';
import { RULE_VIOLATION_VALUES } from '../constants/enums.js';

export const RuleSetSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  isDefault: z.boolean().default(false),
  minRestHours: z.number().positive().default(12),
  maxDailyHours: z.number().positive().default(9),
  maxAnnualOvertime: z.number().positive().default(80),
  weeklyRestDays: z.number().positive().default(1.5),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const RuleCheckResultSchema = z.object({
  type: z.enum(['block', 'warn']),
  code: z.enum(RULE_VIOLATION_VALUES),
  message: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// Response wrapper for operations that may produce rule warnings
export const OperationWithWarningsSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    warnings: z.array(RuleCheckResultSchema),
  });
