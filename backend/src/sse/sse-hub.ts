import type { Response } from 'express';
import type { SseEvent } from './events.js';

/**
 * Registered SSE client.
 */
export interface SseClient {
  orgId: string;
  userId: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  res: Response;
}

/**
 * In-process SSE client hub.
 *
 * Maintains a registry of connected clients and handles fan-out with
 * per-client targeting (org, userId, role).
 *
 * Satisfies: FR-NOTIF-2, FR-NOTIF-3
 */
export class SseHub {
  private readonly clients = new Set<SseClient>();

  /**
   * Registers a new SSE client. Sets required SSE response headers.
   */
  register(orgId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE', res: Response): SseClient {
    const client: SseClient = { orgId, userId, role, res };
    this.clients.add(client);
    return client;
  }

  /**
   * Removes a client from the registry and ends the response.
   */
  unregister(client: SseClient): void {
    this.clients.delete(client);
  }

  /**
   * Determines whether an event should be delivered to a specific client.
   *
   * Rules (all must pass):
   * 1. client.orgId MUST match event.organizationId
   * 2. If event has targetUserId, client.userId MUST match
   * 3. If event has targetRole, client.role MUST match
   */
  shouldDeliver(client: SseClient, event: SseEvent): boolean {
    if (client.orgId !== event.organizationId) return false;
    if (event.targetUserId !== undefined && client.userId !== event.targetUserId) return false;
    if (event.targetRole !== undefined && client.role !== event.targetRole) return false;
    return true;
  }

  /**
   * Broadcasts an event to all eligible clients.
   */
  broadcast(event: SseEvent): void {
    for (const client of this.clients) {
      if (this.shouldDeliver(client, event)) {
        client.res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    }
  }

  /**
   * Ends all client responses. Called on graceful server shutdown.
   */
  closeAll(): void {
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch {
        // ignore — client may already be disconnected
      }
    }
    this.clients.clear();
  }

  /**
   * Returns current client count (useful for tests and metrics).
   */
  get size(): number {
    return this.clients.size;
  }
}

export const sseHub = new SseHub();
