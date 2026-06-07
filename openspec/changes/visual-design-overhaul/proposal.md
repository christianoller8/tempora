# Proposal: visual-design-overhaul

## Intent
Replace Tempora's default Aura/emerald theme with a custom green-primary identity that is professional, clean, and appropriate for the Spanish private healthcare sector. Both light and dark modes must be polished. No new UI libraries — PrimeNG only.

## Problem
The app currently uses the out-of-the-box Aura preset with its default emerald palette. While functional, it has no distinctive identity. Additionally, several components use hardcoded hex colors for semantic states (role badges, status indicators, chart elements), which breaks theme consistency and makes future changes fragile.

## Proposed solution
Three coordinated changes:

1. **Primary palette swap** — use `definePreset(Aura, { semantic: { primary: green } })` in `app.config.ts`. This updates every PrimeNG component (buttons, inputs, focus rings, active states, tags, etc.) in one change.

2. **Semantic CSS custom properties** — define a set of design-token variables in `styles.scss` for colors that PrimeNG doesn't own: role badge colors (admin/manager/employee), status indicator colors (online/active/idle), and chart colors. Components reference these variables instead of hardcoded hex values.

3. **Global component polish** — add CSS overrides in `styles.scss` for visual refinement: card/panel border radius, table row styling, button hierarchy, focus ring appearance, and any spacing tweaks needed to reach the target aesthetic.

## Scope

### In scope
- `app.config.ts`: `definePreset` with green primary, adjusted global tokens (border radius, focus ring, form field)
- `styles.scss`: semantic color variables + global PrimeNG component overrides
- `shell.component.ts`: role badge classes updated to use new CSS variables
- `dashboard.component.ts`: stat icon classes + chart palette updated to use CSS variables

### Out of scope
- No layout restructuring (sidebar width, topbar height are already correct)
- No new components
- No changes to feature business logic
- No new npm packages

## Success criteria
- Primary color is green (#16a34a / green-600) in both light and dark mode
- All PrimeNG interactive elements (buttons, inputs, checkboxes, focus rings) show green accent
- Role badges use themed CSS variables, not hardcoded hex
- Dashboard stat icons and chart palette use CSS variables
- Angular build is clean, all 275 backend tests keep passing
- Dark mode is visually consistent — not just a color inversion

## Risk
Low. `definePreset` is the officially supported PrimeNG customization path. No component APIs are touched. The hardcoded-to-variable migration is mechanical and testable by inspection.
