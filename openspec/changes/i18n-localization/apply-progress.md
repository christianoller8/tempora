# Apply Progress: i18n-localization

## PR 3 Status: COMPLETE
## PR 2 Status: COMPLETE
## PR 1 Status: COMPLETE

Build: `ng build --configuration=production` — clean, zero errors.

## Completed tasks

- [x] T-01 — Install @ngx-translate/core + @ngx-translate/http-loader; create LanguageService; configure app.config.ts with provideTranslateService + provideTranslateHttpLoader + LanguageService.init(); register localeEs + localeEn
- [x] T-02 — Author es.json (~250 keys, canonical Spanish) and en.json (~250 keys, English translations) under 13 namespaces: NAV, TOPBAR, AUTH, COMMON, STATUS, ROLES, DASHBOARD, EMPLOYEES, TIME, ABSENCES, TIMESHEET, SHIFTS, REPORTS, ADMIN, NOTIFICATIONS
- [x] T-03 — Shell: inject LanguageService; add language toggle button in topbar; replace all nav label strings with `labelKey | translate` pattern; translate sign-out, brand subtitle, coming-soon badge, theme tooltips

## Files changed (PR 1)

- `package.json` (root) — moved overrides to devDependencies to fix Angular package hoisting after primeng was hoisted by ngx-translate install
- `frontend/package.json` — added @ngx-translate/core, @ngx-translate/http-loader
- `frontend/src/app/app.config.ts` — provideTranslateService, provideTranslateHttpLoader, registerLocaleData, LanguageService.init()
- `frontend/src/app/core/i18n/language.service.ts` — NEW: LanguageService with current signal, dateLocale computed, toggle(), init()
- `frontend/public/assets/i18n/es.json` — NEW: ~250 canonical Spanish keys
- `frontend/public/assets/i18n/en.json` — NEW: ~250 English translation keys
- `frontend/src/app/core/layout/shell.component.ts` — language toggle in topbar + all strings translated

## PR 2 completed tasks

- [x] T-04 — Login (TranslatePipe + translate keys: title, subtitle, labels, button, footer)
- [x] T-05 — Admin / Rulesets (TranslatePipe + TranslateService; all form labels, buttons, loading states)
- [x] T-06 — Reports + export-dialog (TranslatePipe + TranslateService; labels, buttons, employee options)
- [x] T-07 — Notifications bell + list (TranslatePipe; key-based message + relative-time helpers)
- [x] T-08 — Timesheet review + status + confirmation-badge (MONTH_NAMES → Intl.DateTimeFormat; LanguageService; TranslateService for toasts)
- [x] T-09 — Absences request + approval + balance (ABSENCE_TYPE_LABELS removed; 'ABSENCES.TYPES.' + type | translate; all template strings; TooltipModule added)
## PR 3 completed tasks

- [x] T-10 — Dashboard (TranslatePipe + LanguageService + TranslateService; all stat labels, panel titles, empty states, badge interpolations, date locale)
- [x] T-11 — Shifts: cuadrante + grid + swap-request + swap-approval (TranslatePipe; all headings, form labels, table headers, button ternaries)
- [x] T-12 — Time Tracking: clock + clock-widget + live-dashboard (TranslatePipe + LanguageService; ternary clock-in/out labels, location strings, entry table headers)
- [x] T-13 — Employees: container + 3 sub-components (TranslatePipe + TranslateService for toasts; table headers, form labels, status tags, dialog headers)
- [x] T-14 — Build: `ng build --configuration=production` clean, zero TypeScript errors

19 new keys added to both translation files:
- `EMPLOYEES.TABLE_NIF/CONTRACT/HOURS_WEEK/HIRE_DATE`
- `TIME.LOCATION_REQUESTING/UNAVAILABLE/IDLE/GPS_LOGGED/FORCE_CLOCK_OUT/OPEN_SESSION_CONFLICT/LIVE_TEAM`
- `SHIFTS.SWAP_FROM_LABEL/TO_LABEL/REASON_LABEL/SELECT_YOURS/SWAP_OPEN/YOUR_REQUESTS/RULE_VIOLATION/SUBMITTING/REQUEST_SWAP`
