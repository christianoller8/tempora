import { z } from 'zod';

// Confirm request body — client MUST NOT supply confirmedAt.
export const ConfirmTimesheetSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

// Query params for the employee summary endpoint.
export const TimesheetSummaryQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// Query params for the manager/admin status endpoint.
export const ConfirmationStatusQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  centerId: z.string().uuid().optional(),
});

// Full TimesheetSignature record shape returned from the API.
export const TimesheetSignatureResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int(),
  confirmedAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  alreadyConfirmed: z.boolean(),
});

// One time entry row returned inside the monthly summary.
export const TimesheetEntrySchema = z.object({
  id: z.string().uuid(),
  clockIn: z.string().datetime({ offset: true }),
  clockOut: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(['OPEN', 'CLOSED']),
  durationMinutes: z.number().int().nullable(),
});

// Employee monthly summary — includes hours + confirmation state.
export const TimesheetSummaryResponseSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  employeeId: z.string().uuid(),
  hours: z
    .object({
      regularHours: z.number(),
      overtimeHours: z.number(),
      partTimeDeviation: z.number(),
    })
    .nullable(),
  confirmed: z.boolean(),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
  hasOpenEntry: z.boolean(),
  totalAbsenceDays: z.number().int().nonnegative(),
  entries: z.array(TimesheetEntrySchema),
});

// One row in the manager/admin status list.
export const ConfirmationStatusRowSchema = z.object({
  employeeId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  confirmed: z.boolean(),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
});

// Inferred TypeScript types
export type ConfirmTimesheetDto = z.infer<typeof ConfirmTimesheetSchema>;
export type TimesheetSummaryQuery = z.infer<typeof TimesheetSummaryQuerySchema>;
export type ConfirmationStatusQuery = z.infer<typeof ConfirmationStatusQuerySchema>;
export type TimesheetSignatureResponse = z.infer<typeof TimesheetSignatureResponseSchema>;
export type TimesheetSummaryResponse = z.infer<typeof TimesheetSummaryResponseSchema>;
export type ConfirmationStatusRow = z.infer<typeof ConfirmationStatusRowSchema>;
export type TimesheetEntry = z.infer<typeof TimesheetEntrySchema>;
