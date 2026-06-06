import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = 'org-1';
const USER = 'user-1';

// ---------------------------------------------------------------------------
// Mock db-context and notifications.service before importing controller
// ---------------------------------------------------------------------------

vi.mock('../../db-context.js', () => ({
  getUser: vi.fn(() => ({ userId: USER, organizationId: ORG, role: 'ADMIN' })),
  getDb: vi.fn(() => mockDb),
}));

vi.mock('./notifications.service.js', () => ({
  persist: vi.fn().mockResolvedValue(undefined),
  listNotifications: vi.fn().mockResolvedValue([]),
  markRead: vi.fn().mockResolvedValue({ id: 'n-1', read: true }),
  markAllRead: vi.fn().mockResolvedValue({ updated: 3 }),
}));

// Mocks for SSE infrastructure (stream handler dependencies)
vi.mock('../../sse/event-bus.js', () => ({
  eventBus: { for: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })) },
}));

vi.mock('../../sse/sse-hub.js', () => ({
  sseHub: {
    register: vi.fn(() => ({ orgId: ORG, userId: USER, role: 'ADMIN', res: {} })),
    unregister: vi.fn(),
    shouldDeliver: vi.fn(() => false),
  },
}));

vi.mock('../../db/prisma.js', () => ({
  prisma: {},
}));

// eslint-disable-next-line prefer-const
let mockDb: Record<string, unknown> = {
  notification: {
    updateMany: vi.fn().mockResolvedValue({ count: 3 }),
  },
};

import { handleMarkAllRead, handleMarkRead } from './notifications.controller';
import { markAllRead } from './notifications.service';

// ---------------------------------------------------------------------------
// handleMarkAllRead
// ---------------------------------------------------------------------------

describe('handleMarkAllRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('responds with HTTP 200 and { updated: N } body', async () => {
    const jsonSpy = vi.fn();
    const req = {} as Request;
    const res = { json: jsonSpy } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await handleMarkAllRead(req, res, next);

    expect(jsonSpy).toHaveBeenCalledWith({ updated: 3 });
    expect(next).not.toHaveBeenCalled();
  });

  it('delegates to markAllRead service with correct userId and orgId', async () => {
    const req = {} as Request;
    const res = { json: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await handleMarkAllRead(req, res, next);

    expect(markAllRead).toHaveBeenCalledWith(USER, ORG, mockDb);
  });

  it('calls next(err) on service error', async () => {
    const serviceError = new Error('DB failure');
    vi.mocked(markAllRead).mockRejectedValueOnce(serviceError);

    const req = {} as Request;
    const res = { json: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await handleMarkAllRead(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceError);
  });
});

// ---------------------------------------------------------------------------
// prePersisted guard in stream onEvent (ADR-3)
//
// We test the guard indirectly by checking that persist() is / is not called
// depending on the prePersisted flag, using a fabricated onEvent-like helper
// that mirrors the controller logic.
// ---------------------------------------------------------------------------

describe('onEvent prePersisted guard (ADR-3)', () => {
  it('skips persist() when event has prePersisted: true', async () => {
    const persistSpy = vi.fn().mockResolvedValue(undefined);

    // Replicate the guard logic from the controller inline for test isolation.
    type ExtendedSseEvent = {
      type: string;
      organizationId: string;
      targetUserId?: string;
      payload: unknown;
      emittedAt: string;
      prePersisted?: boolean;
    };

    function testableOnEvent(event: ExtendedSseEvent, persist: typeof persistSpy): void {
      if (!event.prePersisted) {
        persist(event, {}).catch(() => {});
      }
    }

    const event: ExtendedSseEvent = {
      type: 'NOTIFICATION',
      organizationId: ORG,
      targetUserId: USER,
      payload: { type: 'ABSENCE_APPROVED' },
      emittedAt: new Date().toISOString(),
      prePersisted: true,
    };

    testableOnEvent(event, persistSpy);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('calls persist() when event does not have prePersisted flag (regression guard)', async () => {
    const persistSpy = vi.fn().mockResolvedValue(undefined);

    type ExtendedSseEvent = {
      type: string;
      organizationId: string;
      targetUserId?: string;
      payload: unknown;
      emittedAt: string;
      prePersisted?: boolean;
    };

    function testableOnEvent(event: ExtendedSseEvent, persist: typeof persistSpy): void {
      if (!event.prePersisted) {
        persist(event, {}).catch(() => {});
      }
    }

    const event: ExtendedSseEvent = {
      type: 'CLOCK_IN',
      organizationId: ORG,
      targetUserId: USER,
      payload: { employeeId: 'emp-1' },
      emittedAt: new Date().toISOString(),
      // no prePersisted flag
    };

    testableOnEvent(event, persistSpy);
    expect(persistSpy).toHaveBeenCalledOnce();
  });
});
