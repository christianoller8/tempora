/**
 * SSE event type definitions — backend side.
 * Mirrored in packages/shared for the frontend.
 * Satisfies: FR-NOTIF-3 (fan-out by org, user, role)
 */

const SSE_EVENT_TYPES = {
  CLOCK_IN: 'CLOCK_IN',
  CLOCK_OUT: 'CLOCK_OUT',
  SHIFT_PUBLISHED: 'SHIFT_PUBLISHED',
  SWAP_REQUESTED: 'SWAP_REQUESTED',
  SWAP_APPROVED: 'SWAP_APPROVED',
  NOTIFICATION: 'NOTIFICATION',
  NOTIFICATION_READ: 'NOTIFICATION_READ',
} as const;

export type SseEventType = (typeof SSE_EVENT_TYPES)[keyof typeof SSE_EVENT_TYPES];

export interface SseEvent {
  type: SseEventType;
  organizationId: string;
  targetUserId?: string;   // user-targeted delivery
  targetRole?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'; // role-targeted
  payload: unknown;
  emittedAt: string;       // ISO timestamp
}

export { SSE_EVENT_TYPES };
