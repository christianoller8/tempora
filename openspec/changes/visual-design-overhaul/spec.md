# Spec: visual-design-overhaul

## FR-VDO-01 — Green primary palette

**Given** the app is loaded in light mode  
**Then** all PrimeNG primary-colored elements (filled buttons, active nav links, focus rings, checkboxes checked state, tag severity="success", input focus border) display a green tone derived from the green-600 (#16a34a) anchor

**Given** the app is loaded in dark mode  
**Then** primary elements display a lighter green (green-400 / #4ade80) for sufficient contrast on dark surfaces, consistent with PrimeNG dark-mode token behavior

---

## FR-VDO-02 — CSS custom properties for semantic colors

**Given** any component renders role badges, status indicators, or semantic severity colors  
**Then** those colors are driven by CSS custom properties defined in `styles.scss`, not hardcoded hex values

Semantic variables required:
- `--color-role-admin` / `--color-role-admin-bg` / `--color-role-admin-border`
- `--color-role-manager` / `--color-role-manager-bg` / `--color-role-manager-border`
- `--color-role-employee` / `--color-role-employee-bg` / `--color-role-employee-border`
- `--color-status-online` (active/clocked-in green dot)
- `--color-status-idle` (neutral surface color)
- `--color-stat-green`, `--color-stat-orange`, `--color-stat-blue` (dashboard stat icons)

All variables defined on `:root` with dark-mode overrides on `.app-dark`.

---

## FR-VDO-03 — Shell role badges use CSS variables

**Given** the shell renders a role badge for ADMIN, MANAGER, or EMPLOYEE  
**Then** the badge background, text, and border come from the corresponding `--color-role-*` variables  
**And** no hardcoded hex color remains in `shell.component.ts` for badge styling

---

## FR-VDO-04 — Dashboard stat icons use CSS variables

**Given** the dashboard renders stat icon rows  
**Then** `.stat-icon--green`, `.stat-icon--orange`, `.stat-icon--blue` reference `--color-stat-*` variables  
**And** no hardcoded hex for stat icon colors remains in `dashboard.component.ts`

---

## FR-VDO-05 — Dashboard chart palette uses CSS variables

**Given** the dashboard renders the weekly hours bar chart  
**Then** the chart's `backgroundColor` and `borderColor` arrays are read from CSS custom properties at render time (via `getComputedStyle`)  
**And** the chart tooltip and scale colors also reference CSS variables  
**And** the chart palette uses colors consistent with the new green-primary identity

---

## FR-VDO-06 — Card and panel visual refinement

**Given** any card or panel is rendered (dashboard stat cards, dashboard panels, PrimeNG `<p-card>`)  
**Then** border radius is 10–12px  
**And** there is a subtle box shadow (soft, not harsh)  
**And** the border is `1px solid var(--p-surface-border)` (already correct in most components — must be consistent)

---

## FR-VDO-07 — Form field focus ring

**Given** any input, select, textarea, or date picker receives focus  
**Then** the focus indicator is a green ring (matches primary color) with a 2px offset  
**And** the ring is visible in both light and dark mode

---

## FR-VDO-08 — Dark mode consistency

**Given** dark mode is active (`.app-dark` on `<html>`)  
**Then** all semantic color variables resolve to dark-appropriate values  
**And** green accent is still recognizable but not harsh on dark surfaces  
**And** the chart tooltip uses `var(--p-surface-card)` / `var(--p-surface-border)` as background/border  
**And** chart scale text uses `var(--p-text-color-secondary)` or equivalent muted token

---

## FR-VDO-09 — No regressions

**Given** the visual overhaul is applied  
**Then** the Angular build produces no errors or warnings  
**And** all 275 backend tests continue to pass (no backend changes)  
**And** all existing functionality (navigation, auth, time tracking, absences, employees, reports, notifications) works correctly  
**And** the theme toggle (light ↔ dark) continues to function

---

## Non-functional requirements

- All new CSS must use custom properties — no hardcoded hex values introduced
- All semantic variable names must follow the `--color-*` naming convention defined in FR-VDO-02
- PrimeNG component APIs must not be bypassed (no `::ng-deep` hacks on component internals unless strictly necessary and documented)
