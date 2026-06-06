# Spec: Notification Center

**Change:** notification-center
**Status:** draft
**Based on:** proposal.md

---

## 1. Scope

This spec covers what MUST be true after the change is applied. It does not describe implementation.

### In scope

- Backend: persist notification events on absence approve, reject, and create (new); new `PATCH /notifications/read-all` endpoint
- Frontend: topbar bell with `<p-popover>`; mark-all-read; SSE live sync; removal of sidebar notifications button and below-topbar panel

### Out of scope

- Push notifications (browser, mobile, email)
- Notification preferences or settings
- Notifications for shifts, time entries, swaps, or any non-absence event
- Pagination beyond the existing 50-row server cap

---

## 2. Data Contracts

### 2.1 Notification payload shape (canonical)

```ts
type AbsenceNotificationPayload =
  | { type: 'ABSENCE_APPROVED';  absenceId: string; employeeId: string; decidedAt: string }
  | { type: 'ABSENCE_REJECTED';  absenceId: string; employeeId: string; decidedAt: string }
  | { type: 'ABSENCE_REQUESTED'; absenceId: string; employeeId: string };
```

`decidedAt` is ISO-8601. It is present on `ABSENCE_APPROVED` and `ABSENCE_REJECTED` and absent on `ABSENCE_REQUESTED`.

### 2.2 `NotificationItem` (frontend interface — extends current)

```ts
export interface NotificationItem {
  id: string;
  organizationId: string;
  userId: string;
  type: 'ABSENCE_APPROVED' | 'ABSENCE_REJECTED' | 'ABSENCE_REQUESTED' | string;
  payload: AbsenceNotificationPayload | unknown;
  read: boolean;
  createdAt: string;  // ISO-8601
}
```

The `type` field on `NotificationItem` widens to `string` to remain forward-compatible. Frontend message generation derives human-readable text from `payload.type`; no message field is stored in the DB.

### 2.3 Human-readable message derivation (frontend only)

| `payload.type`        | Display text                            |
| --------------------- | --------------------------------------- |
| `ABSENCE_APPROVED`    | "Your absence request was approved."    |
| `ABSENCE_REJECTED`    | "Your absence request was rejected."    |
| `ABSENCE_REQUESTED`   | "A new absence request was submitted."  |
| *(unknown)*           | `payload.type` value (raw fallback)     |

### 2.4 New endpoint

**`PATCH /notifications/read-all`**
- Auth: required (same auth guard as existing notification routes)
- Body: none
- Response `200`: `{ updated: number }` — count of rows flipped from unread to read
- Scope: affects only the authenticated user's notifications within their organization
- Idempotent: calling it when no unread notifications exist returns `{ updated: 0 }` with status `200`

### 2.5 Associated route per notification type

| `payload.type`        | Navigation target                            |
| --------------------- | -------------------------------------------- |
| `ABSENCE_APPROVED`    | `/absences`                                  |
| `ABSENCE_REJECTED`    | `/absences`                                  |
| `ABSENCE_REQUESTED`   | `/absences` (only reachable by MANAGER/ADMIN) |
| *(unknown)*           | none (click marks read, no navigation)       |

---

## 3. Functional Requirements

### Backend

**FR-NOT-01 — Approve emits notification**
After `approveAbsence` completes its state transition and audit write, a persisted `NOTIFICATION` SSE event MUST be emitted to the absence owner (the employee who created the absence). The event payload MUST match the `ABSENCE_APPROVED` shape in §2.1.

**FR-NOT-02 — Reject emits notification**
After `rejectAbsence` completes its state transition and audit write, a persisted `NOTIFICATION` SSE event MUST be emitted to the absence owner. The event payload MUST match the `ABSENCE_REJECTED` shape in §2.1.

**FR-NOT-03 — Create absence emits notification to managers**
After `createAbsence` persists the absence, a persisted `NOTIFICATION` SSE event MUST be emitted to every user with role `MANAGER` or `ADMIN` in the same organization. The event payload MUST match the `ABSENCE_REQUESTED` shape in §2.1.

**FR-NOT-04 — Persistence before SSE delivery**
The `Notification` DB row MUST be committed before the SSE event is written to any connected client. Fire-and-forget emission that writes to the SSE stream before the DB commit is not acceptable.

**FR-NOT-05 — Mark-all-read endpoint**
`PATCH /notifications/read-all` MUST exist on the notifications router, guarded by the same auth middleware as `GET /notifications`. It MUST set `read = true` on all unread `Notification` rows belonging to the caller's `userId` within their `organizationId`.

### Frontend

**FR-NOT-06 — Sidebar notifications removed**
`ShellComponent` MUST NOT render the sidebar `<button>` with class `nav-link` whose click handler calls `toggleNotifications()`, and MUST NOT render the `@if (showNotifications()) { <app-notification-list> }` block below the topbar. The `showNotifications` signal and `toggleNotifications()` method MUST be removed from the class.

**FR-NOT-07 — Bell in topbar**
The topbar `<header class="topbar">` MUST include `<app-notification-bell>` with `[count]="notificationsStore.unreadCount()"` placed between the theme-toggle button and the user block. The bell MUST show the unread badge when `unreadCount > 0`.

**FR-NOT-08 — Popover anchored to bell**
Clicking the bell MUST open a PrimeNG `<p-popover>` anchored directly below the bell button. The popover MUST contain a scrollable notification list with `max-height` of `420px`. Each row MUST show: a type icon, the human-readable message text derived from `payload.type` (§2.3), a relative timestamp, and a "mark read" button (visible on unread items). The popover MUST NOT be a side panel or a route change.

**FR-NOT-09 — Mark-all-read in popover**
A "Mark all as read" button MUST appear at the top of the popover. It MUST call `notificationsStore.markAllRead()`. The button MUST be hidden (or disabled) when `unreadCount === 0`.

**FR-NOT-10 — Row click navigates and marks read**
Clicking a notification row (not the "mark read" button specifically) MUST call `markRead(id)` and, if the notification type has an associated route (§2.5), navigate to that route. The popover MUST close after navigation.

**FR-NOT-11 — Popover responsive width**
The popover MUST have a width of `380px` on viewports wider than `480px`. On viewports `≤ 480px` the width MUST be `calc(100vw - 2rem)`.

**FR-NOT-12 — SSE live sync**
`NotificationsStore` MUST subscribe to the existing SSE stream. On receiving a `NOTIFICATION` event whose `targetUserId` matches the current user, the new notification MUST be prepended to the `notifications` signal without a full reload. On receiving a `NOTIFICATION_READ` event, the matching item's `read` flag MUST be set to `true` in the signal.

**FR-NOT-13 — markAllRead store method**
`NotificationsStore` MUST expose a `markAllRead(): Promise<void>` method. This method MUST call `PATCH /notifications/read-all` and on success set `read = true` on all items in the `notifications` signal optimistically (or after confirmation from the response).

**FR-NOT-14 — Load on popover open**
When the popover opens, `notificationsStore.loadNotifications()` MUST be called to refresh the list. This ensures stale data is not shown after the popover has been closed for a period.

---

## 4. Acceptance Criteria

**AC-NOT-01** — After `approveAbsence(absenceId)` is called, a row exists in the `Notification` table with `userId = absence.employee.userId`, `type = 'NOTIFICATION'`, `payload.type = 'ABSENCE_APPROVED'`, `payload.absenceId = absenceId`, and `read = false`.

**AC-NOT-02** — After `rejectAbsence(absenceId)` is called, a row exists in the `Notification` table with `userId = absence.employee.userId`, `type = 'NOTIFICATION'`, `payload.type = 'ABSENCE_REJECTED'`, `payload.absenceId = absenceId`, and `read = false`.

**AC-NOT-03** — After `createAbsence(...)` is called, one `Notification` row exists for each MANAGER/ADMIN user in the same org, all with `payload.type = 'ABSENCE_REQUESTED'` and `read = false`. EMPLOYEE users have no new row.

**AC-NOT-04** — In integration: the `Notification` row inserted by an absence approval is queryable from the DB before the SSE `data:` line is written to the response stream. (Verified by intercepting the stream write after DB commit.)

**AC-NOT-05** — `PATCH /notifications/read-all` returns HTTP `200` with body `{ updated: N }` where `N` is the number of previously-unread notifications for that user. A subsequent `GET /notifications` returns all items with `read = true` for that user.

**AC-NOT-06** — `ShellComponent` template does not contain the string `showNotifications` or the `<app-notification-list>` tag (confirmed by snapshot or template source check). The `showNotifications` signal is not declared in the class.

**AC-NOT-07** — `<app-notification-bell>` renders inside `.topbar`. When `unreadCount > 0`, the badge element is present in the DOM with the correct count.

**AC-NOT-08** — Clicking the bell button triggers `<p-popover>` show logic; the popover element is present in the DOM and positioned below the bell. No full-page navigation occurs.

**AC-NOT-09** — Each rendered notification row contains: an icon element (class or `pi` icon), a text node matching the message in §2.3, a relative time string (e.g. "2 min ago"), and a "mark read" button for unread items.

**AC-NOT-10** — Clicking "Mark all as read" results in `markAllRead()` being called; `unreadCount()` returns `0` and no badge element is visible.

**AC-NOT-11** — At `viewport-width > 480px`, the popover host element's computed `width` is `≤ 380px`. At `viewport-width ≤ 480px`, the popover width equals `viewport-width - 32px` (2rem at 16px base).

**AC-NOT-12** — An SSE `NOTIFICATION` event delivered to the frontend without a page refresh causes the notification to appear at the top of the popover list and increments `unreadCount()` by 1.

**AC-NOT-13** — `NotificationsStore.markAllRead()` issues a `PATCH` request to `/notifications/read-all`. (Verifiable via `HttpTestingController` in a unit test.)

**AC-NOT-14** — Opening the popover calls `loadNotifications()` before the list is rendered; if the list was previously empty and the server returns items, those items appear in the popover.

---

## 5. Constraints

- **Angular conventions**: standalone components, `ChangeDetectionStrategy.OnPush`, signals, `input()` / `output()` functions, native control flow (`@if`, `@for`). No `NgModules`, no `ngClass` / `ngStyle`.
- **Accessibility**: popover MUST meet WCAG AA. Bell `aria-label` updates with unread count (existing behavior preserved). Popover must be keyboard-dismissible (Escape) and trap focus while open, per PrimeNG `<p-popover>` defaults.
- **Existing SSE infrastructure**: `eventBus`, `sseHub`, `persist()` are used as-is. No new SSE infrastructure is introduced.
- **No DB migration**: the `Notification` model already exists. Only service/controller/router additions are required on the backend.
- **TypeScript strict mode**: no `any`. The `NotificationsStore` exported type alias MUST be updated to include `markAllRead(): Promise<void>`.
- **Test coverage**: all new backend service methods and the new endpoint MUST have unit/integration tests. The existing 231 backend tests MUST continue to pass.

---

## 6. Non-Requirements (explicitly excluded)

- No message field stored in DB; all display text is derived client-side.
- No read receipts or delivery receipts beyond what the existing `read` boolean provides.
- No grouping or deduplication of notifications.
- No notification sound or browser-level notification API.
- No infinite scroll; the existing 50-row server cap applies.

---

## 7. Open Questions / Spec Assumptions

| # | Assumption made | Rationale |
|---|-----------------|-----------|
| 1 | `createAbsence` notification targets ALL MANAGER/ADMIN in the org, not just the direct manager of the employee. The proposal says "all users with role MANAGER or ADMIN"; this spec follows that literally. | Proposal §scope; no hierarchy model exists in the codebase |
| 2 | Notification persist on `createAbsence` is a new behavior; the proposal mentions approve/reject only in §approach but §FR-NOT-03 adds it. This spec treats it as in-scope. | Instruction text for this phase explicitly lists FR-NOT-03 |
| 3 | `payload.decidedAt` is omitted on `ABSENCE_REQUESTED` (no decision has been made). | Logical — the field has no value at request time |
| 4 | SSE `targetUserId` matching is already handled by `sseHub.shouldDeliver()`; the store subscription only needs to prepend/update state. | Confirmed by reading `notifications.controller.ts` lines 44-48 |
| 5 | The popover is implemented inside `ShellComponent` (or a thin wrapper component it hosts), not inside `NotificationBellComponent` itself — the bell emits `open` and the parent controls the popover. | `NotificationBellComponent` already exposes `open` output; keeping bell dumb preserves separation |
