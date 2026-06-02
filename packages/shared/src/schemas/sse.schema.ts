import { z } from 'zod';

/**
 * SSE event schemas — shared between backend and frontend.
 * Mirrors backend/src/sse/events.ts.
 */

export const SSE_EVENT_TYPES = {
  CLOCK_IN: 'CLOCK_IN',
  CLOCK_OUT: 'CLOCK_OUT',
  SHIFT_PUBLISHED: 'SHIFT_PUBLISHED',
  SWAP_REQUESTED: 'SWAP_REQUESTED',
  SWAP_APPROVED: 'SWAP_APPROVED',
  NOTIFICATION: 'NOTIFICATION',
  NOTIFICATION_READ: 'NOTIFICATION_READ',
} as const;

export type SseEventType = (typeof SSE_EVENT_TYPES)[keyof typeof SSE_EVENT_TYPES];

export const SseEventSchema = z.object({
  type: z.enum([
    'CLOCK_IN',
    'CLOCK_OUT',
    'SHIFT_PUBLISHED',
    'SWAP_REQUESTED',
    'SWAP_APPROVED',
    'NOTIFICATION',
    'NOTIFICATION_READ',
  ]),
  organizationId: z.string().uuid(),
  targetUserId: z.string().uuid().optional(),
  targetRole: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  payload: z.unknown(),
  emittedAt: z.string(),
});

export type SseEvent = z.infer<typeof SseEventSchema>;
