# Tasks: Notification Center

**Change:** notification-center
**Status:** ready
**Delivery:** 2 chained PRs (stacked-to-main) — PR 1 must land before PR 2
**Estimated lines:** ~560 (prod ~280 + tests ~280)

---

## Review Workload Forecast

```
Estimated changed lines: ~560
400-line budget risk:    High
Chained PRs recommended: Yes
Suggested slices:        Slice 1 — T01–T06 | Slice 2 — T07–T12
Decision needed:         Resolved — 2 PRs, stacked-to-main
```

---

## Dependency order

```
T01 → T02 → T03 → T04 → T05 → T06      (Slice 1 — sequential)
                                  ↓
              T07 → T08 → T09 → T10 → T11 → T12   (Slice 2 — sequential)
```

T05 and T06 can run in parallel (type-check and tests are independent once T01–T04 are done).
T11 and T12 can run in parallel once T07–T10 are done.

---

## Slice 1 — Backend + SseService fix (PR 1)

### [x] T01 — Emit notifications from `absences.service.ts`

**Files**
- `backend/src/modules/absences/absences.service.ts`
- `backend/src/sse/events.ts`
- `backend/src/server.ts`

**What to do**
1. Add `prePersisted?: boolean` to the `SseEvent` interface in `events.ts`.
2. Add `setEventBus(fn)` module-level injection to `absences.service.ts` (mirror `time.service.ts` pattern).
3. Add private `emitNotification(orgId, targetUserId, payload, db)` helper:
   - `await db.notification.create(...)` first (FR-NOT-04)
   - then `_eventBus?.(orgId, { type: 'NOTIFICATION', targetUserId, payload, prePersisted: true, ... })`
4. In `approveAbsence`: extend existing `findUnique` to `include: { employee: { include: { user: { select: { id: true } } } } }`; after audit write call `emitNotification` with `ABSENCE_APPROVED` payload (skip if `ownerUserId` undefined — ADR-2).
5. In `rejectAbsence`: same extension + call with `ABSENCE_REJECTED` payload.
6. In `createAbsence`: after absence + audit write, query `db.user.findMany({ where: { organizationId, role: { in: ['ADMIN','MANAGER'] }, isActive: true }, select: { id: true } })`; loop and call `emitNotification` per manager with `ABSENCE_REQUESTED` payload (no `decidedAt`).
7. In `server.ts`: call `setAbsencesEventBus(publishFn)` (same pattern as existing services).

**ACs satisfied:** FR-NOT-01, FR-NOT-02, FR-NOT-03, FR-NOT-04 → AC-NOT-01, AC-NOT-02, AC-NOT-03, AC-NOT-04

**Dependencies:** none

**Estimated lines:** ~75 (service ~70, events.ts ~1, server.ts ~4)

---

### [x] T02 — Fix `SseService` named-event listeners

**Files**
- `frontend/src/app/core/sse/sse.service.ts`

**What to do**
1. After the existing `this.eventSource.onmessage = ...` assignment, add `addEventListener` calls for each `SseEventType` value (including `NOTIFICATION`, `NOTIFICATION_READ`, `CLOCK_IN`, `CLOCK_OUT`, `SHIFT_UPDATED`, etc. — all that the backend writes as named events).
2. Each listener callback parses the event data identically to `onmessage` and calls `this.lastEvent.set(parsed)`.
3. No change to the public API or existing `onmessage` handler — only addition.

**ACs satisfied:** FR-NOT-12 (prerequisite — without this, named SSE events never reach `lastEvent`)

**Dependencies:** T01 (for context on which event names are in play, but can be written independently)

**Estimated lines:** ~20

---

### [x] T03 — Add `markAllRead` to `notifications.service.ts`

**Files**
- `backend/src/modules/notifications/notifications.service.ts`

**What to do**
1. Export `async function markAllRead(userId: string, orgId: string, db: TenantClient): Promise<{ updated: number }>`.
2. Implementation: `db.notification.updateMany({ where: { userId, organizationId: orgId, read: false }, data: { read: true } })` → return `{ updated: result.count }`.
3. Idempotent: zero unread rows → returns `{ updated: 0 }` with no error.

**ACs satisfied:** FR-NOT-05 (service layer), AC-NOT-05 (partial — endpoint tested in T06)

**Dependencies:** none (parallel-safe with T01, T02)

**Estimated lines:** ~12

---

### [x] T04 — Wire `PATCH /notifications/read-all` route

**Files**
- `backend/src/modules/notifications/notifications.controller.ts`
- `backend/src/modules/notifications/notifications.router.ts`

**What to do**

Controller (`notifications.controller.ts`):
1. Add `export async function handleMarkAllRead(req, res): Promise<void>` — calls `markAllRead(user.userId, user.organizationId, db)` and `res.json(result)`.
2. In the existing `onEvent` / `stream` handler: if `event.prePersisted === true`, skip the `persist()` call (ADR-3 guard). All existing events without the flag continue to persist on delivery as before.

Router (`notifications.router.ts`):
1. Add `notificationsRouter.patch('/read-all', tenantContext, asyncHandler(handleMarkAllRead))`.
2. This line MUST appear BEFORE the existing `notificationsRouter.patch('/:id/read', ...)` to avoid Express matching `read-all` as `{ id: 'read-all' }`.

**ACs satisfied:** FR-NOT-05, AC-NOT-05 (full)

**Dependencies:** T03

**Estimated lines:** ~17 (controller ~15, router ~2)

---

### [x] T05 — Backend TypeScript check (zero errors)

**Files**
- All modified backend files (T01–T04)

**What to do**
1. Run `npx tsc --noEmit` (or equivalent project check command) inside `backend/`.
2. Resolve every type error to zero before marking done.
3. No `any` casts; use the existing `TenantClient`, `SseEvent`, `AbsenceNotificationPayload` types.

**ACs satisfied:** Spec §5 — TypeScript strict mode, no `any`

**Dependencies:** T01, T02 (T03, T04 produce no unique type risk beyond T01 patterns)

**Estimated lines:** 0 new lines — fix only

---

### [x] T06 — Backend tests (emission + mark-all-read + persist-order)

**Files**
- `backend/src/modules/absences/absences.service.spec.ts` (or nearest test file for the service)
- `backend/src/modules/notifications/notifications.service.spec.ts`
- `backend/src/modules/notifications/notifications.controller.spec.ts` (or integration test)

**What to do**

For `absences.service.spec.ts` — add tests for:
1. `approveAbsence` creates a `Notification` row with `payload.type = 'ABSENCE_APPROVED'` and `read = false`.
2. `rejectAbsence` creates a `Notification` row with `payload.type = 'ABSENCE_REJECTED'`.
3. `createAbsence` creates one `Notification` row per MANAGER/ADMIN in the org, all with `payload.type = 'ABSENCE_REQUESTED'`; EMPLOYEE users have no row.
4. `approveAbsence` when employee has no linked `User` — no notification error, absence flow completes normally (ADR-2).
5. Persist-before-deliver: mock `_eventBus`; assert `db.notification.create` resolves BEFORE the bus publish is called (AC-NOT-04).

For `notifications.service.spec.ts` — add tests for:
6. `markAllRead` with unread rows → returns `{ updated: N }` where N > 0; rows are now read.
7. `markAllRead` with no unread rows → returns `{ updated: 0 }` (idempotent).

For `notifications.controller.spec.ts` — add tests for:
8. `PATCH /notifications/read-all` returns HTTP 200 with `{ updated: N }` body.
9. `onEvent` with `prePersisted: true` → `persist()` is NOT called.
10. `onEvent` without `prePersisted` flag → `persist()` IS called (regression guard — ADR-3).

Existing 231 tests MUST remain green. Run full backend suite to confirm.

**ACs satisfied:** Spec §5 — test coverage; AC-NOT-01 through AC-NOT-05; regression for persist path

**Dependencies:** T01, T03, T04 (must be implemented first)

**Estimated lines:** ~140

---

## Slice 2 — Frontend UX (PR 2, after PR 1 merged)

### [x] T07 — Extend `NotificationsStore` with `markAllRead` and `applySseEvent`

**Files**
- `frontend/src/app/features/notifications/data-access/notifications.store.ts`

**What to do**
1. Add `async markAllRead(): Promise<void>` method:
   - `http.patch<{ updated: number }>('.../notifications/read-all', {}, { withCredentials: true })`
   - On success: `patchState(store, { notifications: store.notifications().map(n => ({ ...n, read: true })) })`.
2. Add `applySseEvent(event: SseEvent): void` method:
   - `NOTIFICATION` event: prepend mapped `NotificationItem` (derive from event payload + `emittedAt`, `read: false`).
   - `NOTIFICATION_READ` event: flip matching item's `read` flag by `id`.
3. All existing methods and state remain unchanged.

**ACs satisfied:** FR-NOT-12, FR-NOT-13, AC-NOT-12, AC-NOT-13

**Dependencies:** T02 (SseService fix landed in PR 1), T04 (endpoint exists)

**Estimated lines:** ~45

---

### [x] T08 — Redesign `NotificationBellComponent` output + update `NotificationListComponent`

**Files**
- `frontend/src/app/features/notifications/ui/notification-bell.component.ts` (or wherever `NotificationBellComponent` lives)
- `frontend/src/app/features/notifications/feature/notification-list.component.ts`

**What to do**

`NotificationBellComponent`:
1. Widen the `open` output from `output<void>()` to `output<MouseEvent>()`.
2. Emit `$event` (the PrimeNG `(onClick)` event) rather than `void`.
3. Bell badge visibility: show when `count() > 0` (existing behavior confirmed, no change needed unless broken).

`NotificationListComponent`:
1. Add `notificationMessage(item)` helper using the spec §2.3 switch table.
2. Add relative-time display (e.g. `formatDistanceToNow` from date-fns, or a simple hand-rolled pipe — match whatever the project uses).
3. Add per-row "mark read" button — visible only when `item.read === false`; calls `notificationsStore.markRead(item.id)`.
4. Add "Mark all as read" header button — hidden/disabled when `unreadCount() === 0`; calls `notificationsStore.markAllRead()`.
5. Add `(navigated)` output — emit after a row click that navigates (so the host can close the popover).
6. Row click: call `markRead(id)`, if type has a route (spec §2.5 map) navigate via `router.navigate([...])` then emit `navigated`.
7. Scrollable container: `max-height: 420px; overflow-y: auto` on the list container element.
8. All Angular conventions: `OnPush`, signals, `input()`/`output()`, native control flow, no `any`.

**ACs satisfied:** FR-NOT-08, FR-NOT-09, FR-NOT-10, AC-NOT-07 (partial), AC-NOT-08, AC-NOT-09, AC-NOT-10

**Dependencies:** T07 (store exposes `markAllRead`)

**Estimated lines:** ~70

---

### [x] T09 — Refactor `ShellComponent` — remove sidebar panel, add topbar bell + popover

**Files**
- `frontend/src/app/core/layout/shell.component.ts`

**What to do**

Remove:
1. Sidebar `<li>` / `<button (click)="toggleNotifications()">` block.
2. `readonly showNotifications = signal(false);` declaration.
3. `toggleNotifications()` method.
4. `@if (showNotifications()) { <app-notification-list .../> }` block below the topbar.

Add to template (inside `.topbar-end`, between theme-toggle and `.user-block`):
```html
<app-notification-bell
  [count]="notificationsStore.unreadCount()"
  (open)="notifPanel.toggle($event)"
/>
<p-popover #notifPanel [style]="{ width: 'min(380px, calc(100vw - 2rem))' }" (onShow)="onPopoverOpen()">
  <app-notification-list (navigated)="notifPanel.hide()" />
</p-popover>
```

Add to class:
1. `import { PopoverModule } from 'primeng/popover';` — add to `imports` array.
2. `onPopoverOpen()` method: `void this.notificationsStore.loadNotifications();` (FR-NOT-14).
3. SSE bridge `effect` in constructor:
   ```ts
   effect(() => {
     const ev = this.sse.lastEvent();
     if (ev) this.notificationsStore.applySseEvent(ev);
   });
   ```
4. Keep `NotificationListComponent` import (already present — now used inside popover).
5. Keep `NotificationBellComponent` import (already present or add if missing).

**ACs satisfied:** FR-NOT-06, FR-NOT-07, FR-NOT-12 (SSE bridge), FR-NOT-14, AC-NOT-06, AC-NOT-07

**Dependencies:** T07, T08

**Estimated lines:** ~40

---

### [x] T10 — Update `NotificationsStore` exported type alias

**Files**
- `frontend/src/app/features/notifications/data-access/notifications.store.ts`

**What to do**
1. Locate the exported `NotificationsStore` type alias.
2. Add `markAllRead(): Promise<void>;` to the interface.
3. Add `applySseEvent(event: SseEvent): void;` to the interface.
4. Ensure `SseEvent` is imported at the type level if not already present.

**Note:** This may be done as part of T07 if the implementer modifies the type alias inline. Listed separately to ensure it is not forgotten and the exported contract is complete.

**ACs satisfied:** Spec §5 — type alias must include new methods; AC-NOT-13 (type-safety for `markAllRead`)

**Dependencies:** T07

**Estimated lines:** ~5 (type-only change)

---

### [x] T11 — Angular build clean (zero errors)

**Files**
- All modified frontend files (T07–T10)

**What to do**
1. Run `ng build` (or `npx ng build`) in `frontend/`.
2. Resolve every TypeScript and template compilation error to zero.
3. No `any` casts; no unused imports; no standalone/module violations.

**ACs satisfied:** Spec §5 — TypeScript strict mode; Angular conventions

**Dependencies:** T07, T08, T09, T10

**Estimated lines:** 0 new lines — fix only

---

### [x] T12 — Frontend smoke-test checklist

**Files**
- (manual verification — no code changes expected)

**What to do**
Verify each item against a running dev server (both backend and frontend):

1. Bell appears in topbar between theme-toggle and user block.
2. Unread badge shows correct count; disappears when count is 0.
3. Clicking bell opens `<p-popover>` anchored below the bell; no page navigation.
4. Popover width is 380px on wide viewport; `calc(100vw - 2rem)` on narrow (≤480px).
5. Notification list shows icon, message text (per §2.3), relative time, and "mark read" for unread items.
6. "Mark all as read" button is hidden when count = 0.
7. Clicking "Mark all as read" → badge disappears; all rows no longer show "mark read" buttons.
8. Clicking a notification row marks it read and navigates to `/absences`.
9. Popover closes after row-click navigation.
10. Approve an absence in one browser tab → connected employee's bell increments via SSE (live sync).
11. Sidebar no longer shows notifications button or below-topbar panel.
12. Escape key dismisses the popover.

**ACs satisfied:** AC-NOT-06 through AC-NOT-14 (smoke)

**Dependencies:** T09, T11 (all prior tasks done)

**Estimated lines:** 0 — verification only

---

## Summary table

| ID  | Title                                          | Slice | Est. lines | Deps        | Parallel-safe with |
|-----|------------------------------------------------|-------|-----------|-------------|-------------------|
| T01 | Emit notifications from `absences.service.ts`  | 1     | ~75       | —           | T03               |
| T02 | Fix `SseService` named-event listeners         | 1     | ~20       | —           | T01, T03          |
| T03 | Add `markAllRead` to `notifications.service.ts`| 1     | ~12       | —           | T01, T02          |
| T04 | Wire `PATCH /read-all` route + controller      | 1     | ~17       | T03         | —                 |
| T05 | Backend TypeScript check                       | 1     | 0         | T01–T04     | T06               |
| T06 | Backend tests                                  | 1     | ~140      | T01–T04     | T05               |
| T07 | Extend `NotificationsStore`                    | 2     | ~45       | PR 1 merged | T08 (partial)     |
| T08 | Bell output + list redesign                    | 2     | ~70       | T07         | —                 |
| T09 | Refactor `ShellComponent`                      | 2     | ~40       | T07, T08    | —                 |
| T10 | Update `NotificationsStore` type alias         | 2     | ~5        | T07         | T08, T09          |
| T11 | Angular build clean                            | 2     | 0         | T07–T10     | T12               |
| T12 | Frontend smoke-test checklist                  | 2     | 0         | T11         | T11               |

**Total estimated:** ~424 lines of new/changed code; ~280 of those are tests.
