import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireRole } from '../../middleware/require-role';
import {
  handleMonthlyHours,
  handleOvertime,
  handleAbsenteeism,
  handleCoverage,
  handleCompliance,
  handleTimeEntriesPdf,
  handleTimeEntriesExcel,
  handleSchedulePdf,
} from './reporting.controller';

/**
 * Reporting router — satisfies FR-REP-1..9 [GDPR] [COMPLIANCE]
 *
 * Mounted at /reports in app.ts.
 * authenticate + tenantContext applied upstream.
 *
 * AC-REP-2: MANAGER role is scoped to own center in the controller.
 * AC-REP-3: format query param (pdf|xlsx|json) selects output type.
 */
export const reportingRouter = Router();

// GET /reports/monthly-hours — MANAGER/ADMIN
reportingRouter.get(
  '/monthly-hours',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleMonthlyHours),
);

// GET /reports/overtime — MANAGER/ADMIN
reportingRouter.get(
  '/overtime',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleOvertime),
);

// GET /reports/absenteeism — MANAGER/ADMIN
reportingRouter.get(
  '/absenteeism',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleAbsenteeism),
);

// GET /reports/coverage — MANAGER/ADMIN
reportingRouter.get(
  '/coverage',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleCoverage),
);

// GET /reports/compliance — ADMIN only; default XLSX output; always writes audit row
reportingRouter.get(
  '/compliance',
  requireRole(['ADMIN']),
  asyncHandler(handleCompliance),
);

// POST /reports/time-entries/pdf — ADMIN | MANAGER (FR-EXP-01)
reportingRouter.post(
  '/time-entries/pdf',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleTimeEntriesPdf),
);

// POST /reports/time-entries/excel — ADMIN | MANAGER (FR-EXP-02)
reportingRouter.post(
  '/time-entries/excel',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleTimeEntriesExcel),
);

// POST /reports/schedule/pdf — all authenticated roles (FR-EXP-03)
reportingRouter.post(
  '/schedule/pdf',
  requireRole(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  asyncHandler(handleSchedulePdf),
);
