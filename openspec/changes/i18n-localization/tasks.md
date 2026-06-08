# Tasks: i18n-localization

---

## T-01 — Install packages + configure app.config.ts + create LanguageService
**Files**: `frontend/package.json`, `frontend/src/app/app.config.ts`, `frontend/src/app/core/i18n/language.service.ts`

- `npm install @ngx-translate/core @ngx-translate/http-loader` (in `frontend/`)
- Create `frontend/src/app/core/i18n/language.service.ts` per design.md ADR-2
- In `app.config.ts`:
  - Import `registerLocaleData`, `localeEs`, `localeEn` — call both at module level (outside providers)
  - Add `provideTranslateService({ defaultLanguage: 'es', loader: { provide: TranslateLoader, useFactory: HttpLoaderFactory, deps: [HttpClient] } })`
  - Add `provideAppInitializer(() => inject(LanguageService).init())` (before the existing auth initializer)
- Verify: `ng build` passes, `TranslateService` can be injected

---

## T-02 — Author translation files: es.json (canonical) + en.json
**Files**: `frontend/public/assets/i18n/es.json`, `frontend/public/assets/i18n/en.json`

Write all ~250 keys under the namespaces defined in ADR-4. Cover every string that will be replaced in T-03 through T-13 **before** starting component migration. Both files must be complete and consistent (same keys, same structure).

Key groups:
- `NAV.*` — all sidebar nav labels (per role) + sign out + brand subtitle
- `AUTH.*` — login page strings
- `COMMON.*` — Save, Cancel, Delete, Edit, Confirm, Close, Back, Loading, Error, Search, Yes, No, Retry, Soon, Actions, Required field, etc.
- `DASHBOARD.*` — stat labels, panel titles, empty states, chart labels
- `EMPLOYEES.*` — table headers, form section labels, field labels/placeholders, validation messages, dialog headers, toast summaries/details, status display, action buttons
- `TIME.*` — clock status labels, timer display labels, entry table headers, correction form labels, toast messages, live dashboard labels
- `ABSENCES.*` — `TYPES.*` (9 canonical Spanish values), form labels, section titles, decision labels, balance labels, status badges, empty states
- `TIMESHEET.*` — stat labels, status display, locked banner, signature section, toast messages, period labels
- `REPORTS.*` — section headers, labels, export button, date range labels
- `ADMIN.*` — ruleset form labels, section titles, explanatory text
- `NOTIFICATIONS.*` — panel title, empty state, mark-read label, time-ago labels
- `STATUS.*` — PENDING, APPROVED, REJECTED, OPEN, CLOSED, LATE, LOCKED, SIGNED, LIBRANZA (display values in both languages)
- `ROLES.*` — ADMIN, MANAGER, EMPLOYEE display labels
- `TOPBAR.*` — dark/light mode tooltips, language toggle tooltip

---

## T-03 — Shell: language toggle + translate nav labels
**File**: `frontend/src/app/core/layout/shell.component.ts`

- Inject `LanguageService` as `protected readonly lang`
- Add language toggle `p-button` in topbar between notification bell and dark/light toggle (per design.md ADR-9)
- Import `TranslatePipe` in component imports
- Replace all nav label strings in `navItems()` computed with translate keys (`NAV.*`)
- Replace `Sign out` label and tooltip with translate keys
- Replace dark/light mode tooltips with `TOPBAR.*` translate keys
- Replace brand subtitle `'Healthcare'` if user-visible (keep brand name `'Tempora'` as-is — it's a proper noun)
- Update `orgName()` if it returns a hardcoded string

---

## T-04 — Auth: login component
**File**: `frontend/src/app/features/auth/feature/login.component.ts`

- Import `TranslatePipe`
- Replace: page title, subtitle, EMAIL ADDRESS label, PASSWORD label, Sign in button label, footer text, any error messages or validation strings

---

## T-05 — Admin: rulesets component
**File**: `frontend/src/app/features/admin/feature/rulesets.component.ts`

- Import `TranslatePipe`
- Replace all visible strings: section titles, form field labels, button labels, explanatory text, empty states

---

## T-06 — Reports: reports + export-dialog components
**Files**: `frontend/src/app/features/reports/feature/reports.component.ts`, `frontend/src/app/features/reports/ui/export-dialog.component.ts`

- Import `TranslatePipe` in both
- Replace all visible strings in both components

---

## T-07 — Notifications: list + bell components
**Files**: `frontend/src/app/features/notifications/feature/notification-list.component.ts`, `frontend/src/app/features/notifications/ui/notification-bell.component.ts`

- Import `TranslatePipe` in both
- Replace panel title, empty state message, mark-as-read labels, any time display strings

---

## T-08 — Timesheet: review + status + confirmation-badge
**Files**: `frontend/src/app/features/timesheet/feature/timesheet-review.component.ts`, `frontend/src/app/features/timesheet/feature/timesheet-status.component.ts`, `frontend/src/app/features/timesheet/ui/confirmation-badge.component.ts`

- Import `TranslatePipe` + inject `LanguageService` (for date locale in review component)
- `timesheet-review.component.ts`: inject `TranslateService` for toast strings; replace `MONTH_NAMES` array with locale-aware `DatePipe` formatting (e.g. `date | date:'LLLL':undefined:lang.dateLocale()`) rather than translate keys; replace all other strings; pass `lang.dateLocale()` to any date pipes
- `timesheet-status.component.ts`: replace all visible strings including status badges, table headers, empty states
- `confirmation-badge.component.ts`: replace any display strings

---

## T-09 — Absences: request + approval + balance
**Files**: `frontend/src/app/features/absences/feature/absence-request.component.ts`, `frontend/src/app/features/absences/feature/absence-approval.component.ts`, `frontend/src/app/features/absences/feature/absence-balance.component.ts`

- `absence-request.component.ts`:
  - Remove `ABSENCE_TYPE_LABELS` constant
  - Add `absenceTypeLabel` computed helper per design.md ADR-7
  - Import `TranslatePipe` + inject `TranslateService` + inject `LanguageService`
  - Replace all strings including decision buttons (Confirmar aprobación/rechazo → translate keys), form labels, date pipes
- `absence-approval.component.ts`: import `TranslatePipe`, replace all strings
- `absence-balance.component.ts`: import `TranslatePipe`, replace all strings

---

## T-10 — Dashboard
**File**: `frontend/src/app/features/dashboard/feature/dashboard.component.ts`

- Import `TranslatePipe` + inject `LanguageService` (for date locale in `dash-subtitle`)
- Replace all stat labels, panel titles, empty state strings, tag values for entry status
- API enum display values (OPEN/CLOSED tags) → `'STATUS.' + value | translate` pattern (ADR-8)
- Pass `lang.dateLocale()` to the date pipe on `dash-subtitle` date display
- Chart tooltip labels (inside `chartOptions` computed) use `TranslateService.instant()`

---

## T-11 — Shifts: cuadrante + grid + swap-request + swap-approval
**Files**: `frontend/src/app/features/shifts/feature/cuadrante.component.ts`, `frontend/src/app/features/shifts/ui/cuadrante-grid.component.ts`, `frontend/src/app/features/shifts/feature/swap-request.component.ts`, `frontend/src/app/features/shifts/feature/swap-approval.component.ts`

- Import `TranslatePipe` in all four
- Inject `LanguageService` where date pipes are used; pass `lang.dateLocale()`
- Replace all visible strings, column headers, button labels, empty states, status tags

---

## T-12 — Time Tracking: clock + clock-widget + live-dashboard
**Files**: `frontend/src/app/features/time-tracking/feature/clock.component.ts`, `frontend/src/app/features/time-tracking/ui/clock-widget.component.ts`, `frontend/src/app/features/time-tracking/feature/live-dashboard.component.ts`

- Import `TranslatePipe` in all three
- `clock.component.ts`: complex PrimeNG `[label]` ternaries → extract to `computed()` helper signals per ADR-5; inject `LanguageService` for date locale; replace all strings
- `clock-widget.component.ts`: replace any visible label strings
- `live-dashboard.component.ts`: replace all strings including table headers, status labels, empty states

---

## T-13 — Employees: container + 3 sub-components
**Files**: `frontend/src/app/features/employees/feature/employees.component.ts`, `frontend/src/app/features/employees/ui/employee-table.component.ts`, `frontend/src/app/features/employees/ui/employee-form.component.ts`, `frontend/src/app/features/employees/ui/employee-detail.component.ts`

- `employees.component.ts`: inject `TranslateService` for all `messageService.add()` toast calls; replace all template strings; import `TranslatePipe`
- `employee-table.component.ts`: import `TranslatePipe`; replace all table headers, action labels, empty state, status badges; API enum display values → `STATUS.*` pattern
- `employee-form.component.ts`: import `TranslatePipe`; replace all form labels, placeholders, section headers, validation messages, dialog header; complex PrimeNG `[label]` ternaries → `computed()` helpers
- `employee-detail.component.ts`: import `TranslatePipe`; replace all field labels, section headers

---

## T-14 — Build verify + smoke check
- Run `npx ng build --configuration=production` from `frontend/` — must be clean
- Run `npx tsc --noEmit` — zero errors
- Start dev server, open app in browser — confirm Spanish is default, toggle switches to English, reload preserves selection
- Confirm dark/light toggle and language toggle coexist in topbar
- Confirm date formats: Spanish shows `dd/MM/yyyy`, English shows `MM/dd/yyyy`
