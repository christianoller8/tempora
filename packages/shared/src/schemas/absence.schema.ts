import { z } from 'zod';
import { ABSENCE_TYPE_VALUES, ABSENCE_STATUS_VALUES } from '../constants/enums.js';

export const CreateAbsenceSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(ABSENCE_TYPE_VALUES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // cause is only applicable for IT (incapacidad temporal) — special-category field.
  // Transmitted in plaintext; encrypted at the application layer before storage.
  cause: z.string().max(2000).optional(),
});

export const ApproveAbsenceSchema = z.object({
  absenceId: z.string().uuid(),
});

export const AbsenceBalanceQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2020).max(2100),
});

export const AbsenceResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  type: z.enum(ABSENCE_TYPE_VALUES),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(ABSENCE_STATUS_VALUES),
  // causeEncrypted is NEVER returned; only the decrypted cause is returned to authorized users
  // and ONLY after an AuditLog READ row is written first.
  cause: z.string().nullable().optional(),
  approverId: z.string().uuid().nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const AbsenceBalanceResponseSchema = z.object({
  employeeId: z.string().uuid(),
  year: z.number().int(),
  entitled: z.number(),
  used: z.number(),
  remaining: z.number(),
});
