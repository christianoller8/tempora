# Tasks: visual-design-overhaul

## T-01 — Configure green primary palette via definePreset
**File**: `frontend/src/app/app.config.ts`

- Import `definePreset` from `@primeuix/themes`
- Create a `TemporaTheme` constant using `definePreset(Aura, { semantic: { primary: { 50..950 green values }, focusRing: { width: '2px', style: 'solid', color: '{primary.color}', offset: '2px' }, formField: { focusRing: { width: '2px', style: 'solid', color: '{primary.color}', offset: '0' } } } })`
- Replace `preset: Aura` with `preset: TemporaTheme` in `providePrimeNG`
- Verify: Angular build passes, primary color in browser is green

---

## T-02 — Add semantic CSS custom properties to styles.scss
**File**: `frontend/src/styles.scss`

- Add `:root { ... }` block with all `--color-role-*`, `--color-status-*`, `--color-stat-*`, and `--chart-color-1..8` variables (light values per design.md ADR-3)
- Add `.app-dark { ... }` block with dark-mode overrides for all the same variables
- Place the block after the existing `/* ─── PrimeNG overrides ───── */` section, before `/* ─── Auth layout ───── */`

---

## T-03 — Add global PrimeNG component polish to styles.scss
**File**: `frontend/src/styles.scss`

- Append a `/* ─── Component polish ───── */` block after the semantic variables block
- Add rules for `.p-card`, `.p-datatable thead th`, `.p-datatable tbody tr`, `.p-tag`, `.p-button` per design.md ADR-7

---

## T-04 — Refactor shell role badge colors to use CSS variables
**File**: `frontend/src/app/core/layout/shell.component.ts`

- Replace the 4 hardcoded `.role-badge--*` color rules with the variable-driven versions from design.md ADR-5
- No template or TypeScript logic changes needed

---

## T-05 — Refactor dashboard stat icon colors to use CSS variables
**File**: `frontend/src/app/features/dashboard/feature/dashboard.component.ts`

- Replace `.stat-icon--green`, `.stat-icon--orange`, `.stat-icon--blue` rules with variable-driven versions (ADR-6)
- Replace `.online-dot` hardcoded color with `var(--color-status-online)` (ADR-6)
- Replace `.my-status-dot.active` and `.my-status-dot.idle` hardcoded colors with variables (ADR-6)

---

## T-06 — Refactor dashboard chart colors to read from CSS variables
**File**: `frontend/src/app/features/dashboard/feature/dashboard.component.ts`

- Inject `ThemeService`
- Add `private readonly chartColors = computed(...)` signal that reads `--chart-color-1..8` from `getComputedStyle(document.documentElement)` and tracks `this.theme.isDark()` for reactivity (ADR-4)
- Update `chartData` computed to use `this.chartColors()` instead of the inline palette array
- Update `chartOptions.plugins.tooltip` background/title/body/border colors to use `getComputedStyle`-read surface/text variables
- Update `chartOptions.scales.x.grid.color`, `scales.x.ticks.color`, `scales.y.ticks.color` to use surface/text variables

  Note: `chartOptions` is currently a plain object — convert to a `computed()` signal so it reacts to theme changes. Update template binding `[options]="chartOptions"` → `[options]="chartOptions()"`.

---

## T-07 — Verify build and visual regression check
- Run `ng build` (or `npm run build` from `frontend/`) — must complete with zero errors/warnings
- Run backend test suite — all 275 tests must pass
- Manual smoke: load app in browser, confirm green primary in buttons/inputs/nav, confirm theme toggle works, confirm dark mode looks correct
