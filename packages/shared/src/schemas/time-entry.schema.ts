import { z } from 'zod';
import { ENTRY_STATUS_VALUES, CORRECTION_STATUS_VALUES } from '../constants/enums.js';

export const ClockInSchema = z.object({
  // source is optional — defaults to 'web' on the server
  source: z.enum(['web', 'kiosk', 'api']).optional(),
  // capturedAtClient is metadata only; server timestamp is authoritative
  capturedAtClient: z.string().datetime({ offset: true }).optional(),
});

export const ClockOutSchema = z.object({
  source: z.enum(['web', 'kiosk', 'api']).optional(),
  capturedAtClient: z.string().datetime({ offset: true }).optional(),
});

export const TimeEntryResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  clockIn: z.string().datetime({ offset: true }),
  clockOut: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(ENTRY_STATUS_VALUES),
  source: z.string(),
  capturedAtClient: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const CreateCorrectionSchema = z.object({
  timeEntryId: z.string().uuid(),
  proposedClockIn: z.string().datetime({ offset: true }).optional(),
  proposedClockOut: z.string().datetime({ offset: true }).optional(),
  justification: z.string().min(1).max(1000),
});

export const ApproveCorrectionSchema = z.object({
  correctionId: z.string().uuid(),
});

export const CorrectionResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  timeEntryId: z.string().uuid(),
  requestedById: z.string().uuid(),
  proposedClockIn: z.string().datetime({ offset: true }).nullable(),
  proposedClockOut: z.string().datetime({ offset: true }).nullable(),
  justification: z.string(),
  status: z.enum(CORRECTION_STATUS_VALUES),
  approverId: z.string().uuid().nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const OvertimeQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2020).max(2100),
});
