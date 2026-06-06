# Design: Notification Center

**Change:** notification-center
**Status:** draft
**Based on:** proposal.md, spec.md
**Artifact store:** openspec

---

## 1. Architecture approach

End-to-end wiring of an existing-but-disconnected feature. No new infrastructure: we reuse `eventBus` (per-org `OrgEventBus`), the `Notification` Prisma model, `persist()`, and the frontend `SseService` + `NotificationsStore`. The work is additive on the backend (one service-emit hook in three absence methods, one new service method, one new route) and a UI relocation + live-sync on the frontend (bell into topbar inside a `<p-popover>`, SSE subscription, `markAllRead`).

Layering is preserved:

- **Backend**: controller (HTTP/SSE I/O) → service (domain + persistence + emit) → Prisma. The emit hook lives in the **service** layer, after the audit write, so it participates in the same logical unit as the state transition and is covered by service unit tests.
- **Frontend**: container (`ShellComponent`) owns the popover; presentational `NotificationBellComponent` stays dumb (emits `open`); `NotificationsStore` (NgRx SignalStore, `providedIn: 'root'`) owns all state and the SSE subscription; `NotificationListComponent` renders rows.

---

## 2. File layout

### Backend — modify

| File | Change |
| --- | --- |
| `backend/src/modules/absences/absences.service.ts` | Add `setEventBus()` injection (mirror `time.service.ts`), a private `emitNotification()` helper, and emit calls in `createAbsence` (→ managers/admins), `approveAbsence` (→ owner), `rejectAbsence` (→ owner). Resolve owner `userId` via `employee.user`. |
| `backend/src/modules/notifications/notifications.service.ts` | Add `markAllRead(userId, orgId, db)` → `updateMany({ where: { userId, organizationId, read: false }, data: { read: true } })`, returns `{ updated: count }`. |
| `backend/src/modules/notifications/notifications.controller.ts` | Add `handleMarkAllRead`. Modify `onEvent` in `stream` to skip `persist()` for events flagged `prePersisted` (see ADR-3). |
| `backend/src/modules/notifications/notifications.router.ts` | Add `PATCH /read-all` with `tenantContext` (mounted BEFORE `/:id/read` to avoid `read-all` matching the `:id` param). |
| `backend/src/sse/events.ts` | Add optional `prePersisted?: boolean` to `SseEvent` (delivery-time persist suppression). |
| `backend/src/server.ts` | Wire `setAbsencesEventBus(publishFn)` (the existing typed `publishFn` already supports `targetUserId`/`targetRole`). |

### Frontend — modify

| File | Change |
| --- | --- |
| `frontend/src/app/core/sse/sse.service.ts` | Add `addEventListener` registration for named events (`NOTIFICATION`, `NOTIFICATION_READ`, and existing typed events) so `lastEvent` fires for backend named events. **Required** — see ADR-4. |
| `frontend/src/app/features/notifications/data-access/notifications.store.ts` | Add `markAllRead()`, add `applySseEvent(event)` (prepend on `NOTIFICATION`, flip read on `NOTIFICATION_READ`); widen exported type alias. |
| `frontend/src/app/features/notifications/feature/notification-list.component.ts` | Add message-map derivation, relative-time, per-row "mark read" button, "Mark all as read" header button, row-click navigation; accept a `(navigated)` output so the host can close the popover. |
| `frontend/src/app/core/layout/shell.component.ts` | Remove sidebar notifications `<button>`, `showNotifications` signal, `toggleNotifications()`, and the below-topbar `@if (showNotifications())` panel. Add `<app-notification-bell>` + `<p-popover>` in the topbar; subscribe the store to SSE in `ngOnInit`. |

### Frontend — no new files

The popover is hosted inline in `ShellComponent` (ADR-5). No new component file is created; `NotificationListComponent` is reused as the popover body.

---

## 3. Backend: notification emission design

### 3.1 Owner resolution (confirmed against schema)

`User.employeeId` is the FK (`@unique`); `Employee.user` is the optional back-relation (`User?`). To resolve an absence owner's `userId`:

```ts
const absence = await db.absence.findUnique({
  where: { id },
  include: { employee: { include: { user: { select: { id: true } } } } },
});
const ownerUserId = absence?.employee.user?.id;
```

`user` is optional — an `Employee` may have no linked `User`. If `ownerUserId` is undefined, **skip emission** (no crash, no orphan notification). This is the documented edge case.

For `approveAbsence`/`rejectAbsence`, the existing code already does `findUnique`; extend that query with the `include` above (one query, no extra round-trip).

### 3.2 Emit helper (mirror `time.service.ts`)

```ts
let _eventBus: ((orgId: string, event: Record<string, unknown>) => void) | null = null;
export function setEventBus(fn: (orgId: string, event: Record<string, unknown>) => void): void {
  _eventBus = fn;
}

async function emitNotification(
  orgId: string,
  targetUserId: string,
  payload: AbsenceNotificationPayload,
  db: TenantClient,
): Promise<void> {
  // FR-NOT-04: persist BEFORE delivery. Commit the row first.
  await db.notification.create({
    data: { organizationId: orgId, userId: targetUserId, type: 'NOTIFICATION', payload, read: false },
  });
  // Then fan out to connected clients; flag prePersisted so the SSE
  // controller does not double-write (ADR-3).
  _eventBus?.(orgId, {
    type: 'NOTIFICATION',
    organizationId: orgId,
    targetUserId,
    payload,
    emittedAt: new Date().toISOString(),
    prePersisted: true,
  });
}
```

Note: `type` on the persisted row is the SSE event type `'NOTIFICATION'`; the discriminator (`ABSENCE_APPROVED` etc.) lives in `payload.type`, matching the existing `persist()` behavior and spec §2.1/§2.2.

### 3.3 Approve / reject

After the audit write, before returning:

```ts
const ownerUserId = existing.employee?.user?.id; // from extended findUnique
if (ownerUserId) {
  await emitNotification(orgId, ownerUserId, {
    type: 'ABSENCE_APPROVED', // or ABSENCE_REJECTED
    absenceId: id,
    employeeId: existing.employeeId,
    decidedAt: decidedAt.toISOString(),
  }, db);
}
```

### 3.4 Create absence → notify managers/admins

After the absence + audit write, before returning:

```ts
const recipients = await db.user.findMany({
  where: { organizationId: orgId, role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
  select: { id: true },
});
for (const u of recipients) {
  await emitNotification(orgId, u.id, {
    type: 'ABSENCE_REQUESTED',
    absenceId: absence.id,
    employeeId: dto.employeeId,
  }, db); // no decidedAt — spec §2.1
}
```

Spec assumption #1 (notify ALL managers/admins, not a hierarchy) is followed. Note: when an IT absence auto-approves (MANAGER/ADMIN creator, `initialStatus = 'APPROVED'`), the create path still emits `ABSENCE_REQUESTED` per FR-NOT-03 literal wording; this is acceptable since FR-NOT-03 keys off `createAbsence` completion, not status. Flagged as a verify-time check.

---

## 4. Backend: mark-all-read endpoint

```ts
// notifications.service.ts
export async function markAllRead(userId: string, orgId: string, db: TenantClient): Promise<{ updated: number }> {
  const result = await db.notification.updateMany({
    where: { userId, organizationId: orgId, read: false },
    data: { read: true },
  });
  return { updated: result.count };
}

// notifications.controller.ts
export async function handleMarkAllRead(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const result = await markAllRead(user.userId, user.organizationId, db);
  res.json(result); // { updated: N } — spec §2.4 (NOT wrapped in { data })
}

// notifications.router.ts — BEFORE the /:id/read route
notificationsRouter.patch('/read-all', tenantContext, asyncHandler(handleMarkAllRead));
notificationsRouter.patch('/:id/read', tenantContext, asyncHandler(handleMarkRead));
```

Idempotent: zero unread → `{ updated: 0 }`, status `200` (FR-NOT-05, AC-NOT-05). Route order matters — Express would otherwise treat `read-all` as `:id`.

---

## 5. Frontend: popover architecture

PrimeNG 21 ships `<p-popover>` (the renamed OverlayPanel). It is the correct component.

**Ownership**: the popover lives in `ShellComponent` (ADR-5). The dumb `NotificationBellComponent` keeps its existing `(open)` output. Shell wires:

```html
<app-notification-bell
  [count]="notificationsStore.unreadCount()"
  (open)="notifPanel.toggle($event)"
/>
<p-popover #notifPanel [style]="{ width: 'min(380px, calc(100vw - 2rem))' }" (onShow)="onPopoverOpen()">
  <app-notification-list (navigated)="notifPanel.hide()" />
</p-popover>
```

Responsive width (FR-NOT-11): `min(380px, calc(100vw - 2rem))` satisfies both AC-NOT-11 cases (≤380px on wide viewports; `100vw - 2rem` on ≤480px). Scroll cap (FR-NOT-08): `max-height: 420px; overflow-y: auto` on the list container inside `NotificationListComponent`.

`(open)` from the bell calls `notifPanel.toggle($event)` — the `$event` is needed by PrimeNG for anchor positioning, so `NotificationBellComponent.open` must emit the click event. **Change**: widen the bell output to `output<MouseEvent>()` and emit `$event` from `(onClick)`. (PrimeNG `p-button (onClick)` emits a `MouseEvent`-like object; pass it through.)

Accessibility (spec §5): `<p-popover>` provides Escape-dismiss and focus management by default; the bell's dynamic `aria-label` is already implemented.

---

## 6. Frontend: ShellComponent changes

**Remove:**
- The sidebar `<li>` with the notifications `<button (click)="toggleNotifications()">` (lines ~312–332).
- `readonly showNotifications = signal(false);`
- `toggleNotifications()` method.
- The `@if (showNotifications()) { <app-notification-list .../> }` block below the topbar (lines ~387–390).
- `NotificationListComponent` import is retained (now used inside the popover) — keep it.

**Add:**
- `import { PopoverModule } from 'primeng/popover';` and `NotificationBellComponent` import; add both to `imports`.
- The bell + popover markup (section 5) in `.topbar-end`, placed **between the theme-toggle `<p-button>` and the `.user-block`** (FR-NOT-07).
- `onPopoverOpen()` → `void this.notificationsStore.loadNotifications();` (FR-NOT-14).
- SSE subscription in `ngOnInit` (section 7.2).

Sidebar nav: per FR-NOT-06 the sidebar notifications button is removed entirely. No `/notifications` route exists, so it is NOT replaced with a nav link — the bell is the sole entry point.

---

## 7. Frontend: NotificationsStore + SSE

### 7.1 New methods

```ts
async markAllRead(): Promise<void> {
  try {
    await firstValueFrom(
      http.patch<{ updated: number }>(`${baseUrl}/notifications/read-all`, {}, { withCredentials: true }),
    );
    patchState(store, {
      notifications: (store.notifications() as NotificationItem[]).map((n) => ({ ...n, read: true })),
    });
  } catch { /* keep optimistic state minimal — ignore */ }
}

applySseEvent(event: SseEvent): void {
  if (event.type === 'NOTIFICATION') {
    const item = sseEventToItem(event); // maps payload + emittedAt → NotificationItem (read:false)
    patchState(store, { notifications: [item, ...store.notifications()] });
  } else if (event.type === 'NOTIFICATION_READ') {
    const id = (event.payload as { id?: string })?.id;
    if (id) patchState(store, {
      notifications: store.notifications().map((n) => (n.id === id ? { ...n, read: true } : n)),
    });
  }
}
```

### 7.2 SSE integration (ADR-4)

The store does not inject `SseService` directly (avoids a circular `providedIn: 'root'` wiring concern and keeps the store HTTP-only and unit-testable). Instead `ShellComponent` bridges via an `effect`:

```ts
// in ShellComponent constructor
effect(() => {
  const ev = this.sse.lastEvent();
  if (ev) this.notificationsStore.applySseEvent(ev);
});
```

This satisfies FR-NOT-12. The store stays pure (testable with `HttpTestingController`, AC-NOT-13); the bridge is a one-line effect.

### 7.3 Type alias update

```ts
export type NotificationsStore = {
  notifications(): NotificationItem[];
  loading(): boolean;
  unreadCount(): number;
  loadNotifications(): Promise<void>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;          // new
  applySseEvent(event: SseEvent): void;  // new
};
```

---

## 8. NotificationItem shape + message map

The existing `NotificationItem` (store) already matches spec §2.2: `id`, `organizationId`, `userId`, `type: string`, `payload: unknown`, `read`, `createdAt`. No change to the interface shape; only the type alias gains methods.

Message derivation (frontend-only, no DB field — spec §2.3):

```ts
function notificationMessage(item: NotificationItem): string {
  const p = item.payload as { type?: string } | null;
  switch (p?.type) {
    case 'ABSENCE_APPROVED':  return 'Your absence request was approved.';
    case 'ABSENCE_REJECTED':  return 'Your absence request was rejected.';
    case 'ABSENCE_REQUESTED': return 'A new absence request was submitted.';
    default: return p?.type ?? 'Notification';
  }
}
```

Navigation map (spec §2.5): `ABSENCE_*` → `/absences`; unknown → no navigation (click only marks read). Row click: `markRead(id)` then, if route exists, `router.navigate([...])` and emit `(navigated)` so the popover closes (FR-NOT-10).

---

## 9. ADR-style decisions

**ADR-1 — Emit in the service layer, not the controller.**
The emit hook lives in `absences.service.ts` after the audit write. Rationale: the notification is a domain consequence of the state transition; placing it in the service keeps it covered by service unit tests and consistent with `time.service.ts` / `swaps.service.ts`. *Rejected:* emitting in the controller — would split the behavior from its transaction context and leave it untested at the service level.

**ADR-2 — Resolve owner via `employee.user`, skip when absent.**
`Employee.user` is optional (`User?`). When an employee has no linked user account, emission is skipped silently rather than throwing. *Rejected:* throwing/erroring the absence flow — a notification failure must never break the absence decision (the 231 existing tests assert absence flows succeed).

**ADR-3 — Persist-before-deliver via explicit service persist + `prePersisted` flag.**
FR-NOT-04 requires the DB row committed before the SSE stream write. The current controller persists *after* delivery and *only* if a client is connected. The service therefore persists explicitly first, then publishes with `prePersisted: true`; the controller's `onEvent` skips `persist()` for flagged events. *Rejected:* relying on the controller's delivery-time persist — fails FR-NOT-04 (write happens after stream write) and drops the row entirely when the recipient is offline. *Rejected:* removing controller persist outright — would break existing `CLOCK_IN`/`SWAP_APPROVED` persistence which legitimately relies on delivery-time persist.

**ADR-4 — Fix `SseService` to listen for named events.**
`SseService` only wires `EventSource.onmessage`, which fires solely for **unnamed** SSE messages. The backend writes `event: ${type}\ndata: ...` (named), so `NOTIFICATION` events never reach `lastEvent` in production today. We add `addEventListener(type, handler)` for each `SseEventType`. *Rejected:* changing the backend to also write a default/unnamed line — pollutes the wire format and risks double-processing on the dashboard consumer. This is a latent bug surfaced by this change and MUST be fixed for FR-NOT-12 to hold.

**ADR-5 — Popover owned by `ShellComponent`, bell stays dumb.**
Matches spec assumption #5 and container/presentational separation. The bell emits `open(MouseEvent)`; the shell owns the `#notifPanel` reference and calls `toggle($event)`. *Rejected:* self-contained bell owning the popover — would couple presentation to the store and `Router`, and duplicate the popover lifecycle into a leaf component.

**ADR-6 — Store stays HTTP-only; shell bridges SSE via `effect`.**
Keeps `NotificationsStore` unit-testable with `HttpTestingController` (AC-NOT-13) and free of an `SseService` dependency. The `effect` bridge in the shell is the single integration point. *Rejected:* injecting `SseService` into the store — harder to test and mixes transport concerns into state.

---

## 10. Data flow

```
Manager clicks Approve
  → POST /absences/:id/approve
  → approveAbsence(): update status + audit + emitNotification()
       → db.notification.create({ ...payload, read:false })   [COMMITTED]
       → eventBus.publish({ type:'NOTIFICATION', targetUserId, prePersisted:true })
  → owner's open SSE stream: shouldDeliver() true → res.write(event: NOTIFICATION)
       → controller onEvent: prePersisted → skip persist()
  → frontend SseService addEventListener('NOTIFICATION') → lastEvent.set(ev)
  → ShellComponent effect → notificationsStore.applySseEvent(ev) → prepend → badge +1
```

Mark-all-read:
```
Popover "Mark all as read" → store.markAllRead()
  → PATCH /notifications/read-all → updateMany → { updated: N }
  → store optimistically sets read:true on all items → unreadCount() = 0 → badge hidden
```

---

## 11. Review workload forecast

| Area | Files | Est. lines (±) |
| --- | --- | --- |
| `absences.service.ts` (inject + 3 emits + helper) | 1 | ~70 |
| `notifications.service.ts` (markAllRead) | 1 | ~12 |
| `notifications.controller.ts` (handler + onEvent guard) | 1 | ~15 |
| `notifications.router.ts` (route) | 1 | ~2 |
| `events.ts` (`prePersisted` field) | 1 | ~1 |
| `server.ts` (wire absences bus) | 1 | ~3 |
| Backend tests (emit ×3, markAllRead, read-all endpoint, persist-before-deliver) | ~3 | ~140 |
| `sse.service.ts` (named-event listeners) | 1 | ~20 |
| `notifications.store.ts` (markAllRead + applySseEvent + types) | 1 | ~45 |
| `notification-list.component.ts` (message map, time, buttons, nav) | 1 | ~70 |
| `shell.component.ts` (remove panel, add bell+popover, effect) | 1 | ~40 |
| Frontend tests (store markAllRead/applySseEvent, list, shell) | ~3 | ~120 |

**Estimated total: ~560 lines changed (production ~280, tests ~280).** This exceeds the 400-line budget. **400-line budget risk: High. Chained PRs recommended: Yes. Decision needed before apply: Yes.**

Recommended split:
- **PR 1 (backend)**: emit on approve/reject/create, `markAllRead`, `PATCH /read-all`, `prePersisted` flag, `SseService` named-event fix + backend tests. Self-contained and independently shippable (~330 lines incl. tests).
- **PR 2 (frontend UX)**: store `markAllRead`/`applySseEvent`, list redesign, shell bell+popover, SSE bridge effect + frontend tests (~230 lines).

PR 1 must land first (PR 2's live-sync depends on the `SseService` fix and the emit behavior).

---

## 12. Risks / assumptions requiring validation

- **`prePersisted` flag (ADR-3)** changes the shared `SseEvent` contract and controller behavior. Verify existing `CLOCK_IN`/`SWAP_APPROVED` events (no flag) still persist on delivery as before.
- **`SseService` named-event fix (ADR-4)** touches a core service consumed by the time-tracking dashboard (`clock.component.ts:794`). Verify dashboard live updates still work (those events are also named, so they likely had the same latent gap; the fix should improve, not break, them — but assert with existing SSE tests).
- **Auto-approved IT absence** emits both create-time `ABSENCE_REQUESTED` (to managers) and no decision event (createAbsence sets APPROVED directly, not via approveAbsence). Confirm this is acceptable UX at verify time (spec assumption #2).
- **`updateMany` and RLS**: confirm `tenantContext`/RLS allows `updateMany` scoped by `userId + organizationId` without per-row checks (existing `markRead` uses `update` by id; `updateMany` is a new query shape on this table).
- **231 backend tests** must stay green; new emit paths add async DB writes inside existing service methods — ensure test fixtures that call approve/reject have a linked `User` or tolerate skipped emission (ADR-2).
