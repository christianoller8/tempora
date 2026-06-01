import { Router } from 'express';

/**
 * Placeholder notifications router.
 * The real SSE implementation is delivered in Phase 3 (TASK-P3-10, P3-11).
 */
export const notificationsRouter = Router();

notificationsRouter.get('/stream', (_req, res) => {
  res.status(501).json({ code: 'NOT_IMPLEMENTED', message: 'SSE not yet implemented' });
});
