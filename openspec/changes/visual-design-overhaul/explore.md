# Exploration: visual-design-overhaul

## Current State

### Theme architecture
- **PrimeNG v21.1.8** + **@primeuix/themes v2.0.3**
- **Preset**: `Aura` from `@primeuix/themes/aura`, configured in `frontend/src/app/app.config.ts`
- **Primary palette**: `emerald` (Aura default) — needs to change to `green`
- **Dark mode selector**: `.app-dark` class on `<html>`, toggled by `ThemeService`
- **Surface palette (light)**: `slate` — clean neutral, fine to keep
- **Surface palette (dark)**: `zinc` — fine to keep
- **Font**: Inter (Google Fonts, loaded in `index.html`), already in use globally

### Style files
- `frontend/src/styles.scss` — global reset, typography helpers, scrollbar, PrimeNG overrides, auth layout, notifications panel
- `frontend/src/app/app.scss` — effectively empty (1 line)
- No per-component `.scss` files; all component styles are inline in Angular `styles: [...]`

### PrimeNG token system
The Aura preset exposes semantic CSS variables at runtime via its token system:
- `--p-primary-{50..950}` — primary palette shades
- `--p-primary-color`, `--p-primary-contrast-color`, `--p-primary-hover-color`
- `--p-surface-{0,50..950}`, `--p-surface-card`, `--p-surface-border`, `--p-surface-ground`, etc.
- `--p-text-color`, `--p-text-color-secondary`
- Form fields, overlays, navigation items — all tokenized

### Shell component (sidebar + topbar)
File: `frontend/src/app/core/layout/shell.component.ts`
- Layout: `260px` sidebar + `1fr` main area in a CSS grid
- Sidebar already uses `var(--p-primary-color)` for brand icon background, active nav link
- Topbar height: `64px`, uses `var(--p-surface-card)` background
- **Hardcoded role badge colors**: `#ef4444` (admin/red), `#f97316` (manager/orange), `#38bdf8` (employee/sky) — not using CSS variables

### Dashboard component
File: `frontend/src/app/features/dashboard/feature/dashboard.component.ts`
- Cards/panels: `border-radius: 12px`, `border: 1px solid var(--p-surface-border)` — good pattern
- **Hardcoded stat icon colors**: `#22c55e` (green), `#f97316` (orange), `#38bdf8` (blue)
- **Online/status dots**: `#22c55e` hardcoded
- **Chart tooltip colors**: hardcoded `rgba(17,17,20,0.95)`, `#e2e8f0`, `#94a3b8`
- **Chart scale colors**: hardcoded `rgba(255,255,255,0.06)`, `#94a3b8`, `#d1d5db`
- **Chart palette**: 8 hardcoded `rgba` values (indigo/violet/blue/emerald/amber/red/pink/teal)

### Other features inspected
- Most feature components follow the same pattern: CSS variables for primary/surface, but occasional hardcoded hex values for semantic colors (status, severity indicators)

## What definePreset enables
`definePreset(Aura, {...})` lets us:
- Swap the primary palette (emerald → green) in one call
- Adjust global tokens: `borderRadius`, `focusRing`, `formField` behavior
- Keep the surface palette (slate/zinc) unchanged
- All PrimeNG component CSS variables update automatically — no component-level changes needed for the theme

## Key findings
1. **Minimal surface area** for the theme change: only `app.config.ts` needs to change for the primary color switch. PrimeNG components inherit everything.
2. **Semantic color variables** are missing: hardcoded status/severity colors in shell and dashboard need to move to CSS custom properties defined in `styles.scss`.
3. **Chart colors** are hardcoded JavaScript arrays — they'll need to read CSS variable values at runtime (via `getComputedStyle`) or be defined as a consistent palette in a shared utility.
4. **No component SCSS files** — all styling is in Angular inline `styles: [...]`. Overrides must go in `styles.scss` (global) where they can cascade.
5. The overall component structure is already clean and close to the target design; the work is mostly color/token changes, not layout restructuring.
