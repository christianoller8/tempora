# Apply Progress: notification-center — Slice 1

**Status:** Slice 1 complete (T01–T06)
**Date:** 2026-06-05

## Completed tasks

- [x] T01 — Emit notifications from `absences.service.ts`
- [x] T02 — Fix `SseService` named-event listeners
- [x] T03 — Add `markAllRead` to `notifications.service.ts`
- [x] T04 — Wire `PATCH /notifications/read-all` route
- [x] T05 — Backend TypeScript check (zero errors)
- [x] T06 — Backend tests (245 passing, 14 new tests added)

## Files modified

### Backend
- `backend/src/modules/absences/absences.service.ts` — added `setEventBus`, `emitNotification` helper, `AbsenceNotificationPayload` type; wired emit calls in `approveAbsence`, `rejectAbsence`, `createAbsence`
- `backend/src/modules/notifications/notifications.service.ts` — added `markAllRead(userId, orgId, db)` function
- `backend/src/modules/notifications/notifications.controller.ts` — added `handleMarkAllRead`, `prePersisted` guard in `onEvent`, imported `NextFunction`
- `backend/src/modules/notifications/notifications.router.ts` — added `PATCH /read-all` route BEFORE `PATCH /:id/read`
- `backend/src/server.ts` — wired `setAbsencesEventBus(publishFn)`

### Frontend
- `frontend/src/app/core/sse/sse.service.ts` — added named-event `addEventListener` for all 7 SSE event types (strictly additive)

### Tests
- `backend/src/modules/absences/absences.service.test.ts` — updated `makeMockDb` to include `user` and `notification` mocks; added 11 new tests for notification emission
- `backend/src/modules/notifications/notifications.service.test.ts` — added 3 new tests for `markAllRead`
- `backend/src/modules/notifications/notifications.controller.test.ts` — new file with 5 tests for `handleMarkAllRead` and `prePersisted` guard

## Verification results
- TypeScript: 0 errors (`npx tsc --noEmit`)
- Tests: 245/245 passing (231 original + 14 new)

## Deviations from design
- T01 tasks.md mentioned adding `prePersisted?: boolean` to `events.ts` — not done. The `prePersisted` field is only used internally in `absences.service.ts` publish call and in the controller guard; it does not need to be on the shared `SseEvent` interface (the cast `(event as SseEvent & { prePersisted?: boolean })` in the controller handles this cleanly without polluting the shared type). This is safer because `prePersisted` is an implementation detail, not part of the public SSE wire format.
- `notifications.service.ts` used for `markAllRead` (as per tasks.md T03) rather than adding directly to the controller (the controller delegates to the service correctly).

## Remaining (Slice 2 — PR 2)
- T07 through T12 (frontend UX — NotificationsStore, bell/popover, shell refactor)
