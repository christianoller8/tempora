import type { Request, Response } from 'express';
import { getDb, getUser } from '../../db-context';
import { ApiError } from '../../middleware/error';
import {
  ConfirmTimesheetSchema,
  TimesheetSummaryQuerySchema,
  ConfirmationStatusQuerySchema,
} from '@tempora/shared';
import {
  confirmMonth,
  getMonthlySummary,
  listConfirmationStatus,
} from './timesheet-signature.service';

// ---------------------------------------------------------------------------
// Timesheet Signature controller — thin handlers; auth-agnostic service.
// Satisfies FR-TSS-003, FR-TSS-010, FR-TSS-011, FR-TSS-012;
// AC-TSS-009, AC-TSS-010; NFR-TSS-010.
//
// EMPLOYEE self-scoping: EMPLOYEE role is always forced to their own employeeId
// (fail-closed to '__none__' if no employeeId on token — mirrors absences pattern).
// MANAGER/ADMIN may supply an employeeId query param for summary lookup.
// ---------------------------------------------------------------------------

/**
 * GET /timesheet-signatures/summary?year=&month=&employeeId=
 * Returns the monthly timesheet summary for an employee.
 * EMPLOYEE is restricted to their own record; MANAGER/ADMIN may specify employeeId.
 */
export async function handleGetSummary(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const parsed = TimesheetSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(422, 'INVALID_PARAMS', 'Invalid query parameters', parsed.error.issues);
  }
  const { year, month, employeeId: qEmployeeId } = parsed.data;

  // EMPLOYEE is always forced to their own employeeId (fail-closed).
  const employeeId =
    user.role === 'EMPLOYEE'
      ? (user.employeeId ?? '__none__')
      : (qEmployeeId ?? user.employeeId ?? '__none__');

  const summary = await getMonthlySummary(employeeId, year, month, user.organizationId, db);
  res.json({ data: summary });
}

/**
 * POST /timesheet-signatures/confirm
 * Creates (or reads existing) TimesheetSignature for the employee's month.
 * Returns 201 on first create, 200 on re-confirm (idempotent, ADR-4).
 * EMPLOYEE is always forced to their own record; client-supplied employeeId in body is ignored.
 */
export async function handleConfirm(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const parsed = ConfirmTimesheetSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(422, 'INVALID_PARAMS', 'Invalid request body', parsed.error.issues);
  }
  const { year, month } = parsed.data;

  // Always confirm for the requesting employee — fail-closed if no employeeId on token.
  const employeeId = user.employeeId ?? '__none__';

  const { signature, created } = await confirmMonth(
    employeeId,
    year,
    month,
    user.userId,
    user.organizationId,
    db,
  );

  const responseData = {
    id: signature.id,
    organizationId: signature.organizationId,
    employeeId: signature.employeeId,
    year: signature.year,
    month: signature.month,
    confirmedAt: signature.confirmedAt.toISOString(),
    createdAt: signature.createdAt.toISOString(),
    alreadyConfirmed: !created,
  };

  if (created) {
    res.status(201).json({ data: responseData });
  } else {
    res.json({ data: responseData });
  }
}

/**
 * GET /timesheet-signatures/status?year=&month=&centerId=
 * Returns confirmation status for all employees in the org.
 * MANAGER/ADMIN only — role guard applied in the router.
 * Includes a summary aggregate (total, confirmed, pending).
 */
export async function handleGetStatus(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const parsed = ConfirmationStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(422, 'INVALID_PARAMS', 'Invalid query parameters', parsed.error.issues);
  }
  const { year, month, centerId } = parsed.data;

  const items = await listConfirmationStatus(year, month, centerId, db);

  const confirmed = items.filter((i) => i.confirmed).length;
  const pending = items.length - confirmed;

  res.json({
    data: {
      year,
      month,
      organizationId: user.organizationId,
      items,
      summary: {
        total: items.length,
        confirmed,
        pending,
      },
    },
  });
}
