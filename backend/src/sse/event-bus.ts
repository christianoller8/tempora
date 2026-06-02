import { EventEmitter } from 'node:events';
import type { SseEvent } from './events.js';

/**
 * Per-organization in-process event bus.
 *
 * Each organization has its own EventEmitter — events from org A are never
 * emitted on org B's emitter. This enforces FR-NOTIF-2 at the bus level.
 *
 * Designed so replacing this with a Redis pub/sub adapter later only
 * requires changing this module — the interface stays stable.
 *
 * Satisfies: FR-NOTIF-3
 */
export class OrgEventBus {
  private readonly emitters = new Map<string, EventEmitter>();

  /**
   * Returns (or lazily creates) the EventEmitter for the given org.
   */
  for(orgId: string): EventEmitter {
    let emitter = this.emitters.get(orgId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(0); // unlimited SSE clients per org
      this.emitters.set(orgId, emitter);
    }
    return emitter;
  }

  /**
   * Publishes an SSE event to all listeners of the event's organizationId.
   */
  publish(event: SseEvent): void {
    this.emitters.get(event.organizationId)?.emit('event', event);
  }
}

export const eventBus = new OrgEventBus();
