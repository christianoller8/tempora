import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireRole } from '../../middleware/require-role';
import {
  handleListAbsences,
  handleCreateAbsence,
  handleGetBalance,
  handleGetAbsence,
  handleApproveAbsence,
  handleRejectAbsence,
} from './absences.controller';

/**
 * Absences router — satisfies FR-ABS-1..7 [GDPR] [COMPLIANCE]
 *
 * Mounted at /absences in app.ts.
 * authenticate + tenantContext are applied upstream.
 *
 * Route ordering note: /balance MUST come before /:id to prevent Express
 * from matching "balance" as an ID parameter.
 */
export const absencesRouter = Router();

// GET /absences — list absences (all roles; employee sees own absences via service layer).
absencesRouter.get('/', asyncHandler(handleListAbsences));

// POST /absences — create absence request (any authenticated user).
absencesRouter.post('/', asyncHandler(handleCreateAbsence));

// GET /absences/balance — vacation balance query (must be before /:id).
absencesRouter.get('/balance', asyncHandler(handleGetBalance));

// GET /absences/:id — single absence; triggers GDPR READ audit if causeEncrypted present.
absencesRouter.get('/:id', asyncHandler(handleGetAbsence));

// POST /absences/:id/approve — MANAGER/ADMIN only.
absencesRouter.post(
  '/:id/approve',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleApproveAbsence),
);

// POST /absences/:id/reject — MANAGER/ADMIN only.
absencesRouter.post(
  '/:id/reject',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleRejectAbsence),
);
