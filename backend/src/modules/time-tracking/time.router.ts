import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireRole } from '../../middleware/require-role';
import {
  handleClockIn,
  handleClockOut,
  handleListEntries,
  handleCreateCorrection,
  handleApproveCorrection,
  handleRejectCorrection,
} from './time.controller';

/**
 * Time entries and corrections router.
 *
 * Routes are mounted twice in app.ts:
 *   app.use('/time-entries', timeRouter)
 *   app.use('/time-corrections', timeRouter)
 *
 * Both authenticate + tenantContext middlewares are already applied upstream.
 */
export const timeRouter = Router();

// ---------------------------------------------------------------------------
// Time entries
// ---------------------------------------------------------------------------

// POST /time-entries/clock-in — any authenticated employee can clock in.
timeRouter.post('/clock-in', asyncHandler(handleClockIn));

// POST /time-entries/clock-out — any authenticated employee can clock out.
timeRouter.post('/clock-out', asyncHandler(handleClockOut));

// GET /time-entries — manager/admin can list all; employee reads own entries.
timeRouter.get('/', asyncHandler(handleListEntries));

// ---------------------------------------------------------------------------
// Time corrections (mounted at /time-corrections)
// ---------------------------------------------------------------------------

// POST /time-corrections — any employee can request a correction.
timeRouter.post('/', asyncHandler(handleCreateCorrection));

// POST /time-corrections/:id/approve — manager/admin only.
timeRouter.post(
  '/:id/approve',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleApproveCorrection),
);

// POST /time-corrections/:id/reject — manager/admin only.
timeRouter.post(
  '/:id/reject',
  requireRole(['ADMIN', 'MANAGER']),
  asyncHandler(handleRejectCorrection),
);
