import { z } from 'zod';
import {
  EMPLOYEE_CATEGORY_VALUES,
  CONTRACT_TYPE_VALUES,
} from '../constants/enums.js';

export const WorkingCalendarSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  year: z.number().int().min(2000).max(2100),
  annualHours: z.number().positive(),
  holidays: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      label: z.string(),
    }),
  ),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const CreateWorkingCalendarSchema = z.object({
  name: z.string().min(1).max(200),
  year: z.number().int().min(2000).max(2100),
  annualHours: z.number().positive(),
  holidays: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      label: z.string(),
    }),
  ),
});

const CreateEmployeeBaseSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  nif: z.string().max(20).optional(),
  category: z.enum(EMPLOYEE_CATEGORY_VALUES),
  contractType: z.enum(CONTRACT_TYPE_VALUES),
  contractedHoursPerWeek: z.number().positive().optional(),
  primaryCenterId: z.string().uuid(),
  workingCalendarId: z.string().uuid().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Part-time hours must be > 0 when contractType is TIEMPO_PARCIAL.
// The superRefine validates this cross-field constraint.
export const CreateEmployeeSchema = CreateEmployeeBaseSchema.superRefine(
  (data, ctx) => {
    if (data.contractType === 'TIEMPO_PARCIAL') {
      if (
        data.contractedHoursPerWeek === undefined ||
        data.contractedHoursPerWeek <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'contractedHoursPerWeek must be > 0 for TIEMPO_PARCIAL contracts',
          path: ['contractedHoursPerWeek'],
        });
      }
    }
  },
);

export const UpdateEmployeeSchema = CreateEmployeeBaseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const EmployeeResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  nif: z.string().nullable(),
  category: z.enum(EMPLOYEE_CATEGORY_VALUES),
  contractType: z.enum(CONTRACT_TYPE_VALUES),
  contractedHoursPerWeek: z.number(),
  primaryCenterId: z.string().uuid(),
  workingCalendarId: z.string().uuid().nullable(),
  hireDate: z.string(),
  terminationDate: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
