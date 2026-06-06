import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { API_BASE_URL } from '../http/api.tokens';
import type { SseEvent } from '@tempora/shared';

/**
 * SSE client service.
 *
 * Wraps the browser's EventSource API with:
 * - `connected` signal for connection state
 * - `lastEvent` signal for the most recently received event
 * - Auto-reconnect with exponential backoff on error (max 30s)
 * - Automatic disconnect via DestroyRef lifecycle
 *
 * Satisfies FR-NOTIF-6 [TEST]
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);

  private source: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000; // ms; doubles on each failure, capped at 30s
  private readonly maxReconnectDelay = 30_000;

  readonly connected = signal(false);
  readonly lastEvent = signal<SseEvent | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.disconnect());
  }

  /**
   * Establishes the SSE connection.
   * No-op if already connected. Called by smart containers on init.
   */
  connect(): void {
    if (this.source) return;
    this.openConnection();
  }

  private openConnection(): void {
    // withCredentials sends the access_token httpOnly cookie so the backend
    // authenticate middleware can validate the SSE connection.
    this.source = new EventSource(`${this.baseUrl}/notifications/stream`, {
      withCredentials: true,
    });

    this.source.onopen = () => {
      this.connected.set(true);
      this.reconnectDelay = 1000; // reset backoff on successful connect
    };

    this.source.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as SseEvent;
        this.lastEvent.set(event);
      } catch {
        // ignore malformed events
      }
    };

    // ADR-4: the backend emits named SSE events (event: TYPE\ndata: ...).
    // EventSource.onmessage only fires for unnamed events (no event: field).
    // Add addEventListener for each known named event type so lastEvent fires
    // for all backend events.
    const namedEvents: string[] = [
      'NOTIFICATION',
      'NOTIFICATION_READ',
      'CLOCK_IN',
      'CLOCK_OUT',
      'SHIFT_PUBLISHED',
      'SWAP_REQUESTED',
      'SWAP_APPROVED',
    ];
    for (const eventName of namedEvents) {
      this.source.addEventListener(eventName, (event: Event) => {
        const msgEvent = event as MessageEvent;
        try {
          const parsed = JSON.parse(msgEvent.data as string) as SseEvent;
          this.lastEvent.set(parsed);
        } catch {
          // ignore malformed events
        }
      });
    }

    this.source.onerror = () => {
      this.connected.set(false);
      this.source?.close();
      this.source = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return; // already scheduled
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
      // Exponential backoff capped at maxReconnectDelay.
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  /**
   * Closes the SSE connection and cancels any pending reconnect.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.source?.close();
    this.source = null;
    this.connected.set(false);
  }
}
