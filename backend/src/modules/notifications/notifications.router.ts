import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../../middleware/auth';
import { tenantContext } from '../../middleware/tenant-context';
import { stream, handleListNotifications, handleMarkRead, handleMarkAllRead } from './notifications.controller';

/**
 * Notifications router — SSE stream + REST notification endpoints.
 *
 * This router is mounted in app.ts with `authenticate` ONLY:
 *   app.use('/notifications', authenticate, notificationsRouter)
 *
 * The SSE /stream route intentionally has no tenantContext (long-lived connection).
 * The REST routes (/  and /:id/read) apply tenantContext inline.
 *
 * Satisfies FR-NOTIF-1, FR-NOTIF-7, FR-NOTIF-8, FR-NOTIF-9;
 * acceptance: AC-NOTIF-1, AC-NOTIF-2, AC-NOTIF-6.
 */
export const notificationsRouter = Router();

// GET /notifications/stream — authenticated SSE endpoint (no tenantContext).
// Cookie-based auth fallback is active via the `authenticate` middleware
// so EventSource connections (which cannot set Authorization headers) work.
notificationsRouter.get('/stream', stream);

// GET /notifications — paginated list for current user (requires tenantContext).
notificationsRouter.get('/', tenantContext, asyncHandler(handleListNotifications));

// PATCH /notifications/read-all — mark all notifications read (requires tenantContext).
// IMPORTANT: this route MUST appear BEFORE /:id/read to prevent Express from
// matching 'read-all' as { id: 'read-all' }.
notificationsRouter.patch('/read-all', tenantContext, asyncHandler(handleMarkAllRead));

// PATCH /notifications/:id/read — mark notification read (requires tenantContext).
notificationsRouter.patch('/:id/read', tenantContext, asyncHandler(handleMarkRead));
