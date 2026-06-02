import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persist, listNotifications, markRead } from './notifications.service.js';
import type { TenantClient } from '../../db/tenant.js';
import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = 'org-1';
const USER = 'user-1';
const NOTIF_ID = 'notif-1';

const baseNotification = {
  id: NOTIF_ID,
  organizationId: ORG,
  userId: USER,
  type: 'CLOCK_IN',
  payload: { employeeId: 'emp-1' },
  read: false,
  createdAt: new Date(),
};

const ssEvent = {
  type: 'CLOCK_IN' as const,
  organizationId: ORG,
  targetUserId: USER,
  payload: { employeeId: 'emp-1' },
  emittedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Mock Prisma singletons
// ---------------------------------------------------------------------------

function makeTenantDb(overrides: Partial<Record<string, unknown>> = {}): TenantClient {
  return {
    notification: {
      findMany: vi.fn().mockResolvedValue([baseNotification]),
      findUnique: vi.fn().mockResolvedValue(baseNotification),
      update: vi.fn().mockResolvedValue({ ...baseNotification, read: true }),
      create: vi.fn().mockResolvedValue(baseNotification),
    },
    ...overrides,
  } as unknown as TenantClient;
}

function makePrismaClient(): PrismaClient {
  return {
    notification: {
      create: vi.fn().mockResolvedValue(baseNotification),
    },
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// persist()
// ---------------------------------------------------------------------------

describe('persist', () => {
  it('creates a notification row for targetUserId events', async () => {
    const prisma = makePrismaClient();
    await persist(ssEvent, prisma);
    expect((prisma.notification.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });

  it('skips creation when event has no targetUserId and no targetRole', async () => {
    const prisma = makePrismaClient();
    const broadcastEvent = {
      type: 'SHIFT_PUBLISHED' as const,
      organizationId: ORG,
      payload: {},
      emittedAt: new Date().toISOString(),
    };
    // Broadcast events (no targetUserId) are not persisted as user notifications
    await persist(broadcastEvent, prisma);
    expect((prisma.notification.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('does not throw if DB write fails (fire-and-forget safety)', async () => {
    const prisma = {
      notification: {
        create: vi.fn().mockRejectedValue(new Error('DB error')),
      },
    } as unknown as PrismaClient;

    // persist itself resolves — error is swallowed at call site via .catch(()=>{})
    await expect(persist(ssEvent, prisma)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listNotifications()
// ---------------------------------------------------------------------------

describe('listNotifications', () => {
  it('returns notifications for the user ordered by createdAt DESC', async () => {
    const db = makeTenantDb();
    const result = await listNotifications(USER, ORG, db);
    expect(result).toHaveLength(1);
    expect((db.notification.findMany as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER, organizationId: ORG }),
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('applies take limit (pagination)', async () => {
    const db = makeTenantDb();
    await listNotifications(USER, ORG, db);
    expect((db.notification.findMany as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    );
  });
});

// ---------------------------------------------------------------------------
// markRead()
// ---------------------------------------------------------------------------

describe('markRead', () => {
  it('transitions read: false → true', async () => {
    const db = makeTenantDb();
    const result = await markRead(NOTIF_ID, USER, ORG, db);
    expect(result.read).toBe(true);
  });

  it('throws 404 when notification is not found', async () => {
    const db = makeTenantDb({
      notification: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
    });
    await expect(markRead('nonexistent', USER, ORG, db)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('calls update with read: true', async () => {
    const db = makeTenantDb();
    await markRead(NOTIF_ID, USER, ORG, db);
    expect((db.notification.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { read: true },
      }),
    );
  });
});
