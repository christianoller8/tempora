import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireRole } from '../../middleware/require-role';
import {
  handleGetSummary,
  handleConfirm,
  handleGetStatus,
} from './timesheet-signature.controller';

/**
 * Timesheet Signature router — satisfies FR-TSS-012, NFR-TSS-010.
 *
 * Mounted at /timesheet-signatures in app.ts.
 * authenticate + tenantContext are applied upstream (global middleware in app.ts).
 *
 * Static paths only: /summary, /confirm, /status — no /:id route.
 * Route ordering: all paths are static and unique, so no ordering hazard.
 *
 * Authorization matrix (spec §Authorization Matrix):
 *   GET  /summary  — all authenticated roles (EMPLOYEE forced to own)
 *   POST /confirm  — all authenticated roles (EMPLOYEE forced to own)
 *   GET  /status   — ADMIN and MANAGER only (403 for EMPLOYEE)
 */
export const timesheetSignatureRouter = Router();

// GET /timesheet-signatures/summary?year=&month=&employeeId=
timesheetSignatureRouter.get('/summary', asyncHandler(handleGetSummary));

// POST /timesheet-signatures/confirm
timesheetSignatureRouter.post('/confirm', asyncHandler(handleConfirm));

// GET /timesheet-signatures/status?year=&month=&centerId=
// ADMIN/MANAGER only — requireRole returns 403 for EMPLOYEE.
timesheetSignatureRouter.get(
  '/status',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleGetStatus),
);
