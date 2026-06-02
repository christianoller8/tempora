import { describe, it, expect, vi } from 'vitest';
import { SseHub } from './sse-hub';
import type { SseClient } from './sse-hub';
import type { SseEvent } from './events';

function makeRes() {
  return { write: vi.fn(), end: vi.fn() } as unknown as import('express').Response;
}

function makeEvent(orgId: string, overrides: Partial<SseEvent> = {}): SseEvent {
  return {
    type: 'CLOCK_IN',
    organizationId: orgId,
    payload: {},
    emittedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SseHub.shouldDeliver', () => {
  const hub = new SseHub();

  function makeClient(orgId: string, userId: string, role: SseClient['role']): SseClient {
    return { orgId, userId, role, res: makeRes() };
  }

  it('delivers org-wide event (no targetUserId, no targetRole) to matching org', () => {
    const client = makeClient('org-1', 'user-1', 'MANAGER');
    expect(hub.shouldDeliver(client, makeEvent('org-1'))).toBe(true);
  });

  it('blocks delivery when org does not match', () => {
    const client = makeClient('org-1', 'user-1', 'MANAGER');
    expect(hub.shouldDeliver(client, makeEvent('org-2'))).toBe(false);
  });

  it('delivers when targetUserId matches client userId', () => {
    const client = makeClient('org-1', 'user-1', 'EMPLOYEE');
    const event = makeEvent('org-1', { targetUserId: 'user-1' });
    expect(hub.shouldDeliver(client, event)).toBe(true);
  });

  it('blocks when targetUserId does not match client userId', () => {
    const client = makeClient('org-1', 'user-1', 'EMPLOYEE');
    const event = makeEvent('org-1', { targetUserId: 'user-other' });
    expect(hub.shouldDeliver(client, event)).toBe(false);
  });

  it('delivers when targetRole matches client role', () => {
    const client = makeClient('org-1', 'user-1', 'MANAGER');
    const event = makeEvent('org-1', { targetRole: 'MANAGER' });
    expect(hub.shouldDeliver(client, event)).toBe(true);
  });

  it('blocks when targetRole does not match client role', () => {
    const client = makeClient('org-1', 'user-1', 'EMPLOYEE');
    const event = makeEvent('org-1', { targetRole: 'MANAGER' });
    expect(hub.shouldDeliver(client, event)).toBe(false);
  });

  it('blocks when org matches but targetRole mismatches (combined filter)', () => {
    const client = makeClient('org-1', 'user-1', 'EMPLOYEE');
    const event = makeEvent('org-1', { targetRole: 'ADMIN' });
    expect(hub.shouldDeliver(client, event)).toBe(false);
  });
});

describe('SseHub.broadcast', () => {
  it('broadcasts to all eligible clients', () => {
    const hub = new SseHub();
    const res1 = makeRes();
    const res2 = makeRes();
    const res3 = makeRes();

    hub.register('org-1', 'user-1', 'MANAGER', res1);
    hub.register('org-1', 'user-2', 'EMPLOYEE', res2);
    hub.register('org-2', 'user-3', 'MANAGER', res3); // different org

    hub.broadcast(makeEvent('org-1'));

    expect(res1.write).toHaveBeenCalledOnce();
    expect(res2.write).toHaveBeenCalledOnce();
    expect(res3.write).not.toHaveBeenCalled(); // cross-org isolation
  });

  it('unregister removes client from broadcasts', () => {
    const hub = new SseHub();
    const res = makeRes();
    const client = hub.register('org-1', 'user-1', 'ADMIN', res);
    hub.unregister(client);

    hub.broadcast(makeEvent('org-1'));
    expect(res.write).not.toHaveBeenCalled();
  });

  it('closeAll ends all responses and clears clients', () => {
    const hub = new SseHub();
    const res1 = makeRes();
    const res2 = makeRes();
    hub.register('org-1', 'user-1', 'ADMIN', res1);
    hub.register('org-2', 'user-2', 'EMPLOYEE', res2);

    expect(hub.size).toBe(2);
    hub.closeAll();
    expect(res1.end).toHaveBeenCalled();
    expect(res2.end).toHaveBeenCalled();
    expect(hub.size).toBe(0);
  });
});
