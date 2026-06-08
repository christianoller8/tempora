# Proposal: i18n-localization

## Intent

Add full runtime internationalization to the Tempora frontend. Spanish is the canonical language and the default. English is the second language. A topbar toggle lets the user switch at runtime; the choice persists in localStorage.

## Problem

All UI text is currently hardcoded English strings in component templates — with one inconsistency: the absences feature already has 9 Spanish absence-type labels hardcoded. The app serves Spanish healthcare organizations whose staff expect a Spanish UI. There is no translation infrastructure at all.

## Proposed solution

Install **ngx-translate** (`@ngx-translate/core` + `@ngx-translate/http-loader`) and migrate all 26 components to use the `translate` pipe and `TranslateService.instant()`. Translation files live in `assets/i18n/es.json` (canonical) and `assets/i18n/en.json`.

### Three-layer work

1. **Infrastructure** — install packages, configure `HttpLoaderFactory` in `app.config.ts`, add `provideTranslation()` setup, create translation file skeletons, add language toggle to `shell.component.ts` topbar.

2. **Translation file authoring** — write all ~250 keys in `es.json` first (canonical Spanish), then write `en.json` translations. Keys are namespaced by feature: `NAV.*`, `AUTH.*`, `DASHBOARD.*`, `EMPLOYEES.*`, `TIME.*`, `ABSENCES.*`, `TIMESHEET.*`, `REPORTS.*`, `ADMIN.*`, `NOTIFICATIONS.*`, `COMMON.*`.

3. **Component migration** — replace every hardcoded string with `{{ 'KEY' | translate }}` in templates and `this.translate.instant('KEY')` in TypeScript. PrimeNG `[label]` ternaries use inline pipe; complex multi-branch cases use a helper `computed()` signal.

## Scope

### In scope
- `frontend/package.json` — add `@ngx-translate/core`, `@ngx-translate/http-loader`
- `frontend/src/app/app.config.ts` — configure `TranslateModule.forRoot()` with `HttpLoaderFactory`
- `frontend/public/assets/i18n/es.json` — canonical Spanish (~250 keys)
- `frontend/public/assets/i18n/en.json` — English translations (~250 keys)
- `shell.component.ts` — language toggle button in topbar, `LanguageService`
- All 26 feature/UI components — `translate` pipe migration
- `absence-request.component.ts` — resolve Spanish baseline, move `ABSENCE_TYPE_LABELS` to translation keys
- Date locale: `LOCALE_ID` set to `es-ES` by default; `DatePipe` picks up locale automatically

### Out of scope
- Backend changes (none)
- PrimeNG built-in date picker locale (separate concern)
- Pluralization beyond what ngx-translate's `{count, plural, ...}` ICU handles
- RTL support

## Canonical language decision

`es.json` is the source of truth. English strings were written first historically (by convention), but `es.json` defines the canonical values. `en.json` is derived from `es.json`. This means:
- The absences feature's existing Spanish strings become the `es.json` canonical values for absence types
- All other strings are authored in Spanish first, then translated to English

## Success criteria
- Default language is Spanish on first load
- Language toggle in topbar switches all UI text instantly
- Selected language persists across page refreshes (localStorage `tempora-lang`)
- Zero hardcoded user-facing strings remain in any template or TS component file
- `DatePipe` renders dates as `dd/MM/yyyy` in Spanish locale, `MM/dd/yyyy` in English
- Angular build clean, 275 backend tests pass

## Risk
Medium. The scope is large (~250 keys, 26 components) but mechanical. The main risk is missed strings — a systematic component-by-component approach mitigates this. The absences Spanish baseline is a known quantity and easy to resolve with the canonical-Spanish decision already made.
