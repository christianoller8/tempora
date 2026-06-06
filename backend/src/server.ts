import http from 'http';
import { createApp } from './app';
import { prisma } from './db/prisma';
import { eventBus } from './sse/event-bus';
import { sseHub } from './sse/sse-hub';
import { setEventBus as setSchedulesEventBus } from './modules/shifts/schedules.service';
import { setEventBus as setSwapsEventBus } from './modules/shifts/swaps.service';
import { setEventBus as setTimeEventBus } from './modules/time-tracking/time.service';
import { setEventBus as setAbsencesEventBus } from './modules/absences/absences.service';

// Wire the real OrgEventBus into P2 services that were using no-op stubs,
// and into the new time service.
// Each service accepts a typed publish function; we adapt the interface here.
const publishFn = (orgId: string, event: Record<string, unknown>) => {
  eventBus.publish({
    type: event['type'] as import('./sse/events.js').SseEventType,
    organizationId: orgId,
    targetUserId: event['targetUserId'] as string | undefined,
    targetRole: event['targetRole'] as 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | undefined,
    payload: event['payload'],
    emittedAt: (event['emittedAt'] as string | undefined) ?? new Date().toISOString(),
  });
};

setSchedulesEventBus(publishFn);
setSwapsEventBus(publishFn);
setAbsencesEventBus(publishFn);

// The time service accepts the OrgEventBus directly (typed interface).
setTimeEventBus(eventBus);

// Wire the SseHub to broadcast every published event.
// All events emitted via eventBus.publish() will reach sseHub.broadcast().
// This is done by subscribing to each org emitter dynamically:
// The notifications.controller.ts already does per-connection subscription,
// so sseHub.broadcast() is the hub's own delivery to all registered clients.

const app = createApp();
const server = http.createServer(app);

const PORT = Number(process.env['PORT'] ?? 3000);

server.listen(PORT, () => {
  console.log(`Tempora API listening on :${PORT}`);
});

const shutdown = async () => {
  // P3: close all SSE connections gracefully before shutting down.
  sseHub.closeAll();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
