import type { Request, Response } from 'express';
import { eventBus } from '../../sse/event-bus';
import type { AuthUser } from '../../types/auth';

type RequestWithUser = Request & { user: AuthUser };
import { sseHub } from '../../sse/sse-hub';
import type { SseEvent } from '../../sse/events';
import { prisma } from '../../db/prisma';
import { getDb, getUser } from '../../db-context';
import { persist, listNotifications, markRead } from './notifications.service';

/**
 * GET /notifications/stream
 *
 * Establishes an SSE connection for the authenticated user.
 * This route uses `authenticate` ONLY — no `tenantContext`.
 * SSE connections are long-lived; holding a Prisma transaction for the
 * duration would exhaust the connection pool.
 *
 * After writing each SSE event to the client, calls persist() fire-and-forget
 * so events can be replayed on reconnect (FR-NOTIF-7).
 *
 * Satisfies FR-NOTIF-1, FR-NOTIF-7, FR-NOTIF-8; acceptance: AC-NOTIF-1, AC-NOTIF-2, AC-NOTIF-6
 */
export function stream(req: Request, res: Response): void {
  const user = (req as RequestWithUser).user;
  const { organizationId, userId, role } = user;

  // SSE headers (design §9.2).
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx/proxy buffering
  });

  // Initial connected comment — tells the client the stream is open.
  res.write(': connected\n\n');

  // Register this client in the hub.
  const client = sseHub.register(organizationId, userId, role, res);

  // Listen for events on this org's emitter and deliver if eligible.
  const onEvent = (event: SseEvent): void => {
    if (sseHub.shouldDeliver(client, event)) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      // FR-NOTIF-7: persist user-targeted events fire-and-forget.
      persist(event, prisma).catch(() => {});
    }
  };
  eventBus.for(organizationId).on('event', onEvent);

  // 25-second keep-alive ping to prevent proxy timeouts.
  const keepAliveInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 25_000);

  // Cleanup when client disconnects.
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    eventBus.for(organizationId).off('event', onEvent);
    sseHub.unregister(client);
  });
}

/**
 * GET /notifications
 *
 * Returns paginated notification list for the current user.
 * Satisfies FR-NOTIF-9.
 */
export async function handleListNotifications(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const notifications = await listNotifications(user.userId, user.organizationId, db);
  res.json({ data: notifications });
}

/**
 * PATCH /notifications/:id/read
 *
 * Marks a notification as read.
 * Returns 404 if not found.
 * Satisfies FR-NOTIF-9; acceptance: AC-NOTIF-6.
 */
export async function handleMarkRead(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const id = req.params['id'] as string;
  const notification = await markRead(id, user.userId, user.organizationId, db);
  res.json({ data: notification });
}
