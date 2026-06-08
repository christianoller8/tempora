# Exploration: i18n-localization

## Current State

Zero i18n infrastructure. No `@ngx-translate/core`, no Angular `$localize`, no `assets/i18n/` directory, no `TranslateModule`. All 26 components use **100% inline templates** — no external `.html` files.

## Feature routes and component files

| Route | Key components |
|---|---|
| `/auth/login` | `login.component.ts` |
| `/dashboard` | `dashboard.component.ts` (dual ADMIN/EMPLOYEE view) |
| `/employees` | `employees.component.ts` + 3 UI sub-components |
| `/shifts` | `cuadrante.component.ts` + `cuadrante-grid.component.ts` |
| `/time-tracking` | `clock.component.ts` |
| `/absences` | `absence-request.component.ts` |
| `/timesheet` | `timesheet-review.component.ts` |
| `/timesheet-status` | `timesheet-status.component.ts` |
| `/reports` | `reports.component.ts` |
| `/admin` | `rulesets.component.ts` |
| Shell + Notifications | `shell.component.ts`, `notification-list.component.ts`, `notification-bell.component.ts` |

## String count estimates by feature

| Feature | Estimated keys |
|---|---|
| Shell (nav + topbar) | ~20 |
| Login | ~8 |
| Dashboard (admin + employee views) | ~35 |
| Employees (4 components) | ~45 |
| Time Tracking | ~30 |
| Absences | ~40 |
| Timesheet | ~20 |
| Timesheet Status | ~15 |
| Reports | ~15 |
| Admin / Rulesets | ~12 |
| Notifications | ~10 |
| **Total** | **~250** |

## Critical finding: mixed-language baseline

`absence-request.component.ts` already has hardcoded Spanish strings: a `ABSENCE_TYPE_LABELS` map with 9 Spanish entries (`Vacaciones`, `Incapacidad Temporal (IT)`, `Permiso Retribuido`, etc.) and mixed Spanish form labels (`Comentario (opcional)`, `Confirmar aprobación`). This is inconsistent with the English-language UI everywhere else. The i18n migration must resolve this: canonical source language = English; Spanish translations derived from these existing strings.

## PrimeNG binding pattern — complexity driver

All PrimeNG components use `[label]="..."` dynamic attribute binding. Translation pipe must be applied inside ternary expressions:
- Before: `[label]="store.isClocking() ? 'Clocking in…' : 'Clock In'"`
- After: `[label]="store.isClocking() ? ('TIME.CLOCKING_IN' | translate) : ('TIME.CLOCK_IN' | translate)"`

For complex multi-branch expressions, helper `computed()` signals are cleaner than inline pipe chains.

## Toast messages in TypeScript

`messageService.add({ summary: 'Updated', detail: 'Employee updated.' })` calls exist in TS files. These require `TranslateService.instant()` injection into every smart container that shows toasts (employees, timesheet-review, etc.).

## ngx-translate: NOT installed

Neither `frontend/package.json` nor the monorepo root references `@ngx-translate/core`.

## Recommended approach: ngx-translate

Angular's built-in `$localize` requires a separate build per locale — incompatible with runtime language switching. ngx-translate's `translate` pipe works cleanly in all binding patterns and `TranslateService.instant()` covers TS-side strings.

## Recommended migration order (lowest → highest risk)

1. Infrastructure (package install, HttpLoader, `app.config.ts`, translation file skeletons)
2. Login (~8 keys, isolated)
3. Shell (nav labels + topbar — validates ternary pattern)
4. Admin / Rulesets (~12 keys)
5. Reports (~15 keys)
6. Timesheet / Timesheet Status (~35 combined)
7. Notifications (~10 keys)
8. Absences (~40 keys — highest risk due to Spanish baseline)
9. Dashboard (~35 keys — dual-role template complexity)
10. Time Tracking (~30 keys — complex PrimeNG ternaries)
11. Employees (~45 keys — 4 components, toast messages in TS)

## Risks

1. Mixed Spanish/English in absences must be resolved before keying
2. PrimeNG `[label]` ternaries add verbosity — may need helper signals in complex cases
3. Toast strings in TS require `TranslateService.instant()` in every container
4. `MONTH_NAMES` array in timesheet — replace with locale-aware `DatePipe` rather than translate keys
5. Raw API enum display values (`PENDING`, `APPROVED`, `OPEN`, `CLOSED`) need mapping to translate keys
