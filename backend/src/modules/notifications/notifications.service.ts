import type { PrismaClient, Notification } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import type { SseEvent } from '../../sse/events';
import { ApiError } from '../../middleware/error';

// ---------------------------------------------------------------------------
// Notifications service — satisfies FR-NOTIF-7, FR-NOTIF-8, FR-NOTIF-9
// Acceptance: AC-NOTIF-6
// ---------------------------------------------------------------------------

const NOTIFICATION_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// persist — fire-and-forget; never throws (caller wraps in .catch(() => {}))
// ---------------------------------------------------------------------------

/**
 * Persists an SSE event as a Notification row for user-targeted events.
 * Uses the global Prisma singleton (outside tenant context) — the notification
 * table uses organizationId for RLS, so we write with the singleton and bypass
 * by running outside of withTenant.
 *
 * Only persists events that target a specific userId (targetUserId present).
 * Broadcast events (no targetUserId) are not persisted as per-user notifications.
 *
 * Satisfies FR-NOTIF-8; acceptance: AC-NOTIF-6.
 */
export async function persist(
  event: SseEvent,
  db: PrismaClient,
): Promise<void> {
  // Only persist user-targeted events
  if (!event.targetUserId) return;

  try {
    await db.notification.create({
      data: {
        organizationId: event.organizationId,
        userId: event.targetUserId,
        type: event.type,
        payload: event.payload as object,
        read: false,
      },
    });
  } catch {
    // Fire-and-forget: never crash the SSE stream on a DB error.
  }
}

// ---------------------------------------------------------------------------
// listNotifications — paginated, newest first
// ---------------------------------------------------------------------------

/**
 * Returns the most recent notifications for a user, ordered by createdAt DESC.
 * Paginated to NOTIFICATION_PAGE_SIZE (50) rows.
 *
 * Satisfies FR-NOTIF-9.
 */
export async function listNotifications(
  userId: string,
  orgId: string,
  db: TenantClient,
): Promise<Notification[]> {
  return db.notification.findMany({
    where: { userId, organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: NOTIFICATION_PAGE_SIZE,
  });
}

// ---------------------------------------------------------------------------
// markAllRead — sets read = true on all unread notifications for a user
// ---------------------------------------------------------------------------

/**
 * Marks all unread notifications as read for a given user within an org.
 * Returns the count of rows updated.
 * Idempotent: zero unread rows → returns { updated: 0 } with no error.
 *
 * Satisfies FR-NOT-05, AC-NOT-05.
 */
export async function markAllRead(
  userId: string,
  orgId: string,
  db: TenantClient,
): Promise<{ updated: number }> {
  const result = await db.notification.updateMany({
    where: { userId, organizationId: orgId, read: false },
    data: { read: true },
  });
  return { updated: result.count };
}

// ---------------------------------------------------------------------------
// markRead — transitions read: false → true
// ---------------------------------------------------------------------------

/**
 * Marks a notification as read.
 * Returns 404 ApiError if the notification is not found.
 *
 * Satisfies FR-NOTIF-9; acceptance: AC-NOTIF-6.
 */
export async function markRead(
  id: string,
  userId: string,
  orgId: string,
  db: TenantClient,
): Promise<Notification> {
  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif) {
    throw new ApiError(404, 'NOT_FOUND', `Notification ${id} not found`);
  }

  return db.notification.update({
    where: { id },
    data: { read: true },
  });
}
