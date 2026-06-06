# Proposal: Notification Center

## Intent

Notifications are half-built and disconnected. The backend persists SSE events as `Notification` rows and exposes `GET /notifications` + `PATCH /:id/read`, but **absence approve/reject emit no event**, so nothing ever reaches a user. The UI has an unused `NotificationBellComponent`; the live bell is a **sidebar nav button** toggling a full-width panel below the topbar — not the compact topbar popover the user wants. Goal: wire real notifications end-to-end and deliver the required topbar popover UX.

## Scope

### In Scope
- Emit SSE/persisted notifications on `approveAbsence` / `rejectAbsence` (target the absence owner's user).
- Add mark-all-read: `PATCH /notifications/read-all` + service method + store `markAllRead()`.
- Move the bell into the topbar (next to theme toggle); render `NotificationBellComponent` with unread badge.
- Replace the side panel with a PrimeNG `<p-popover>` anchored under the bell (max ~380px, full-width on mobile).
- Popover hosts the list with mark-as-read and mark-all-read; remove the sidebar nav notifications button + `showNotifications` panel.
- Wire live SSE updates into `NotificationsStore` (append on `NOTIFICATION`, sync on `NOTIFICATION_READ`).

### Out of Scope
- New notification types beyond absence approve/reject (swaps, shifts deferred).
- Push/email/desktop notifications.
- Pagination/infinite scroll beyond existing 50-row cap.
- Notification preferences/settings.

## Capabilities

### New Capabilities
- `notification-center`: end-to-end user notifications — absence-decision triggers, topbar bell popover, unread badge, mark-read / mark-all-read, live SSE sync.

### Modified Capabilities
- `absences`: approve/reject now emit a user-targeted notification event (behavioral addition, no status-machine change).

## Approach

Backend: in `approveAbsence`/`rejectAbsence`, after the audit write, emit an `SseEvent` (type `NOTIFICATION`, `targetUserId` = absence owner's userId) via `eventBus`; existing `persist()` stores it. Add `markAllRead` service + `PATCH /notifications/read-all` route. Frontend: render existing `NotificationBellComponent` in the topbar with a `<p-popover>`; reuse `NotificationListComponent` inside it; add `markAllRead()` to the store and an SSE subscription updating state live. Delete the sidebar notifications button and the below-topbar panel.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/.../absences/absences.service.ts` | Modified | Emit notification event on approve/reject |
| `backend/.../notifications/notifications.service.ts` | Modified | Add `markAllRead` |
| `backend/.../notifications/notifications.{controller,router}.ts` | Modified | `PATCH /notifications/read-all` |
| `frontend/.../core/layout/shell.component.ts` | Modified | Bell + popover in topbar; remove side panel |
| `frontend/.../notifications/ui/notification-bell.component.ts` | Modified | Wire into topbar (currently unused) |
| `frontend/.../notifications/data-access/notifications.store.ts` | Modified | `markAllRead` + SSE live sync |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 231 backend tests break | Med | Add tests for new emit/endpoint; assert existing absence flows unchanged |
| Absence has no direct userId (only employeeId) | Med | Resolve owner user via `employee.user` before emit |
| Popover focus/ARIA regressions | Low | Keep bell aria-label + popover keyboard/focus per WCAG AA |

## Rollback Plan

Revert the commit(s). Backend emit and `read-all` route are additive; removing them restores prior behavior. Frontend: restore the sidebar button + `showNotifications` panel block. No migration — `Notification` model already exists.

## Dependencies

- Existing SSE infra (`eventBus`, `sseHub`, `persist`) and `Notification` model — all present.

## Success Criteria

- [ ] Approving/rejecting an absence creates a notification for the requesting employee.
- [ ] Bell sits in the topbar next to the theme toggle with a live unread badge.
- [ ] Clicking the bell opens a `<p-popover>` (~380px, full-width on mobile) with the list.
- [ ] Mark-as-read and mark-all-read work and update the badge live.
- [ ] All 231 backend tests still pass; new behavior covered by tests.
