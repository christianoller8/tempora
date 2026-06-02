import { describe, it, expect, vi } from 'vitest';
import { OrgEventBus } from './event-bus';
import type { SseEvent } from './events';

function makeEvent(orgId: string, overrides: Partial<SseEvent> = {}): SseEvent {
  return {
    type: 'CLOCK_IN',
    organizationId: orgId,
    payload: {},
    emittedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('OrgEventBus', () => {
  it('delivers published event to subscriber of the same org', () => {
    const bus = new OrgEventBus();
    const listener = vi.fn();
    bus.for('org-1').on('event', listener);

    const event = makeEvent('org-1');
    bus.publish(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('does NOT deliver to subscriber of a different org', () => {
    const bus = new OrgEventBus();
    const listenerOrg1 = vi.fn();
    const listenerOrg2 = vi.fn();
    bus.for('org-1').on('event', listenerOrg1);
    bus.for('org-2').on('event', listenerOrg2);

    // Publish only to org-1.
    bus.publish(makeEvent('org-1'));

    expect(listenerOrg1).toHaveBeenCalledOnce();
    expect(listenerOrg2).not.toHaveBeenCalled();
  });

  it('for() returns the same emitter on repeated calls for the same org', () => {
    const bus = new OrgEventBus();
    expect(bus.for('org-1')).toBe(bus.for('org-1'));
  });

  it('creating different orgs returns different emitters', () => {
    const bus = new OrgEventBus();
    expect(bus.for('org-1')).not.toBe(bus.for('org-2'));
  });

  it('publish is a no-op when no subscribers exist for the org', () => {
    const bus = new OrgEventBus();
    // Should not throw even when no emitter exists for this org.
    expect(() => bus.publish(makeEvent('org-never-subscribed'))).not.toThrow();
  });
});
