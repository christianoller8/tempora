# Design: visual-design-overhaul

## ADR-1 — Primary palette via definePreset, not CSS variable override

**Decision**: Use `definePreset(Aura, { semantic: { primary: { 50: ..., 600: ..., ... } } })` in `app.config.ts`.

**Rationale**: PrimeNG v21's token system generates component CSS variables from the preset at bootstrap. Overriding `--p-primary-color` in CSS after the fact is fragile — it only patches the single computed variable, not the full palette (hover, active, contrast, highlight backgrounds). `definePreset` is the authoritative path and updates all 10+ derived tokens in one call.

**Green palette values** (Tailwind green, already in Aura's primitive tokens):
```ts
{
  50:  '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',  // anchor — primary.color in light mode
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
}
```

Light mode: `primary.color = {primary.600}` → `#16a34a`  
Dark mode: `primary.color = {primary.400}` → `#4ade80` (Aura default dark behavior, no override needed)

---

## ADR-2 — Global token overrides in definePreset

Beyond the primary palette, configure these semantic tokens:

```ts
semantic: {
  primary: { /* green palette above */ },
  focusRing: {
    width: '2px',
    style: 'solid',
    color: '{primary.color}',
    offset: '2px',
    shadow: 'none',
  },
  formField: {
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.color}',
      offset: '0',
      shadow: 'none',
    },
  },
}
```

Border radius uses Aura's defaults (`md: 6px`, `lg: 8px`, `xl: 12px`) — no change needed; components that render cards at 12px already use `border-radius: 12px` inline, which matches `{border.radius.xl}`.

---

## ADR-3 — Semantic CSS custom properties in styles.scss

Define all non-PrimeNG semantic colors as CSS custom properties on `:root` (light) and `.app-dark` (dark):

```scss
:root {
  /* Role badges */
  --color-role-admin:          #ef4444;
  --color-role-admin-bg:       color-mix(in srgb, #ef4444 14%, transparent);
  --color-role-admin-border:   color-mix(in srgb, #ef4444 30%, transparent);

  --color-role-manager:        #f97316;
  --color-role-manager-bg:     color-mix(in srgb, #f97316 14%, transparent);
  --color-role-manager-border: color-mix(in srgb, #f97316 30%, transparent);

  --color-role-employee:       #0ea5e9;
  --color-role-employee-bg:    color-mix(in srgb, #0ea5e9 14%, transparent);
  --color-role-employee-border:color-mix(in srgb, #0ea5e9 30%, transparent);

  /* Status indicators */
  --color-status-online:  #22c55e;
  --color-status-idle:    var(--p-surface-400);

  /* Dashboard stat icons (secondary palette) */
  --color-stat-green:  #22c55e;
  --color-stat-orange: #f97316;
  --color-stat-blue:   #0ea5e9;

  /* Chart */
  --chart-color-1: #16a34a;
  --chart-color-2: #0ea5e9;
  --chart-color-3: #8b5cf6;
  --chart-color-4: #f97316;
  --chart-color-5: #ec4899;
  --chart-color-6: #14b8a6;
  --chart-color-7: #f59e0b;
  --chart-color-8: #6366f1;
}

.app-dark {
  /* Role badges — same hues, consistent opacity on dark surfaces */
  --color-role-admin:          #f87171;
  --color-role-admin-bg:       color-mix(in srgb, #f87171 16%, transparent);
  --color-role-admin-border:   color-mix(in srgb, #f87171 28%, transparent);

  --color-role-manager:        #fb923c;
  --color-role-manager-bg:     color-mix(in srgb, #fb923c 16%, transparent);
  --color-role-manager-border: color-mix(in srgb, #fb923c 28%, transparent);

  --color-role-employee:       #38bdf8;
  --color-role-employee-bg:    color-mix(in srgb, #38bdf8 16%, transparent);
  --color-role-employee-border:color-mix(in srgb, #38bdf8 28%, transparent);

  /* Status */
  --color-status-online:  #4ade80;
  --color-status-idle:    var(--p-surface-600);

  /* Stat icons */
  --color-stat-green:  #4ade80;
  --color-stat-orange: #fb923c;
  --color-stat-blue:   #38bdf8;

  /* Chart — same palette; dark surfaces naturally make them pop */
  --chart-color-1: #4ade80;
  --chart-color-2: #38bdf8;
  --chart-color-3: #a78bfa;
  --chart-color-4: #fb923c;
  --chart-color-5: #f472b6;
  --chart-color-6: #2dd4bf;
  --chart-color-7: #fbbf24;
  --chart-color-8: #818cf8;
}
```

---

## ADR-4 — Chart colors read from CSS variables at runtime

**Problem**: Chart.js `backgroundColor` arrays are JavaScript values, not CSS. They can't read CSS variables directly.

**Solution**: Add a `chartColors()` computed signal in `DashboardComponent` that reads the current 8 chart color variables via `getComputedStyle(document.documentElement)` at signal evaluation time. The chart data computed depends on it, so it re-runs when `isDark` changes.

```ts
private readonly theme = inject(ThemeService);

private readonly chartColors = computed(() => {
  this.theme.isDark(); // track signal for reactivity
  const s = getComputedStyle(document.documentElement);
  return Array.from({ length: 8 }, (_, i) =>
    s.getPropertyValue(`--chart-color-${i + 1}`).trim()
  );
});
```

`chartData` then uses `this.chartColors()` instead of the inline palette array.  
Chart tooltip and scale colors use PrimeNG surface/text variables read the same way.

---

## ADR-5 — Shell role badge refactor

Replace the 4 hardcoded `.role-badge--*` color rules with variable-driven ones:

```scss
.role-badge--admin    { background: var(--color-role-admin-bg);    color: var(--color-role-admin);    border-color: var(--color-role-admin-border); }
.role-badge--manager  { background: var(--color-role-manager-bg);  color: var(--color-role-manager);  border-color: var(--color-role-manager-border); }
.role-badge--employee { background: var(--color-role-employee-bg); color: var(--color-role-employee); border-color: var(--color-role-employee-border); }
.role-badge--unknown  { background: color-mix(in srgb, var(--p-surface-400) 18%, transparent); color: var(--p-surface-400); border-color: color-mix(in srgb, var(--p-surface-400) 35%, transparent); }
```

---

## ADR-6 — Dashboard stat icon refactor

Replace the 3 hardcoded `.stat-icon--*` color rules:

```scss
.stat-icon--green  { background: color-mix(in srgb, var(--color-stat-green)  15%, transparent); color: var(--color-stat-green); }
.stat-icon--orange { background: color-mix(in srgb, var(--color-stat-orange) 15%, transparent); color: var(--color-stat-orange); }
.stat-icon--blue   { background: color-mix(in srgb, var(--color-stat-blue)   15%, transparent); color: var(--color-stat-blue); }
```

And the online/status dot:
```scss
.online-dot { background: var(--color-status-online); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-status-online) 30%, transparent); }
.my-status-dot.active { background: var(--color-status-online); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-status-online) 25%, transparent); }
.my-status-dot.idle   { background: var(--color-status-idle); }
```

---

## ADR-7 — Global PrimeNG component polish in styles.scss

Add targeted overrides after the existing `/* ─── PrimeNG overrides ───── */` block:

```scss
/* Cards */
.p-card { border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06); }

/* DataTable */
.p-datatable .p-datatable-thead > tr > th { font-weight: 600; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.04em; }
.p-datatable .p-datatable-tbody > tr { transition: background 0.15s; }

/* Tags / chips */
.p-tag { font-weight: 600; letter-spacing: 0.02em; }

/* Buttons — ensure primary is solid green */
.p-button:not(.p-button-text):not(.p-button-outlined):not([severity]) { font-weight: 600; }
```

No `::ng-deep` usage — these are global structural overrides that PrimeNG exposes at the `.p-*` class level.

---

## File change summary

| File | Change |
|------|--------|
| `frontend/src/app/app.config.ts` | Add `definePreset` import + configure green primary + focus ring |
| `frontend/src/styles.scss` | Add semantic CSS variables block + PrimeNG component polish |
| `frontend/src/app/core/layout/shell.component.ts` | Role badge classes → use CSS variables |
| `frontend/src/app/features/dashboard/feature/dashboard.component.ts` | Stat icon classes + `chartColors` computed + `chartData` refactor |
