# Design: i18n-localization

## ADR-1 — Package: ngx-translate with standalone pipe API

**Packages**: `@ngx-translate/core@^16` + `@ngx-translate/http-loader@^16`

**Rationale**: Angular 21 / standalone components. ngx-translate v16 introduced `provideTranslateService()` (standalone-friendly provider) and a standalone `TranslatePipe` that can be imported directly into each component's `imports` array — no `NgModule` needed. This is the correct path for an Angular 21 app.

**Configuration in `app.config.ts`**:
```ts
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, '/assets/i18n/', '.json');
}

providers: [
  provideTranslateService({
    defaultLanguage: 'es',
    loader: {
      provide: TranslateLoader,
      useFactory: HttpLoaderFactory,
      deps: [HttpClient],
    },
  }),
]
```

**Per-component usage**:
```ts
import { TranslatePipe } from '@ngx-translate/core';
@Component({ imports: [..., TranslatePipe] })
```

---

## ADR-2 — LanguageService

File: `frontend/src/app/core/i18n/language.service.ts`

```ts
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly current = signal<'es' | 'en'>('es');

  // Derived locale string for DatePipe
  readonly dateLocale = computed(() => this.current() === 'es' ? 'es-ES' : 'en-US');

  init(): void {
    const stored = localStorage.getItem('tempora-lang') as 'es' | 'en' | null;
    const lang = stored ?? 'es';
    this.current.set(lang);
    this.translate.use(lang);
  }

  toggle(): void {
    const next: 'es' | 'en' = this.current() === 'es' ? 'en' : 'es';
    this.current.set(next);
    this.translate.use(next);
    localStorage.setItem('tempora-lang', next);
  }
}
```

Called at bootstrap via `provideAppInitializer(() => inject(LanguageService).init())` in `app.config.ts`.

---

## ADR-3 — Date locale: explicit DatePipe locale binding

Angular's `LOCALE_ID` is a static injection token — it cannot change at runtime. Runtime locale switching for dates is achieved by passing the locale explicitly to `DatePipe`:

```html
{{ entry.date | date:'dd/MM/yyyy':undefined:lang.dateLocale() }}
```

At bootstrap, both locales are registered:
```ts
// app.config.ts (top-level, not in providers)
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEn from '@angular/common/locales/en';
registerLocaleData(localeEs);
registerLocaleData(localeEn);
```

Components that use dates inject `LanguageService` and bind `lang.dateLocale()` where needed. The default Angular locale (`en-US`) is already registered; `es-ES` is added explicitly.

---

## ADR-4 — Translation key namespace structure

```
NAV.*          — sidebar navigation labels, sign out
AUTH.*         — login page: title, subtitle, labels, button, footer
COMMON.*       — shared: Save, Cancel, Delete, Edit, Confirm, Loading, Error, Search, Yes, No, Close, Back
DASHBOARD.*    — stat labels, panel titles, empty states
EMPLOYEES.*    — table headers, form labels, validation, dialog headers, toast messages, badges
TIME.*         — clock-in/out labels, status, entry table headers, correction form, toast messages
ABSENCES.*     — type labels (ABSENCES.TYPES.*), form labels, section titles, decision labels, status labels
TIMESHEET.*    — stat labels, status badges, locked banner, signature section, toast messages
REPORTS.*      — section headers, labels, date range controls
ADMIN.*        — ruleset form labels, section titles
NOTIFICATIONS.* — panel title, empty state, action labels
STATUS.*       — shared API enum display values (PENDING→Pendiente, APPROVED→Aprobado, etc.)
ROLES.*        — ADMIN→Administrador, MANAGER→Responsable, EMPLOYEE→Empleado/a
```

Key naming: `NAMESPACE.SCREAMING_SNAKE_CASE`. Example: `EMPLOYEES.ADD_EMPLOYEE`, `ABSENCES.TYPES.VACACIONES`, `STATUS.PENDING`.

---

## ADR-5 — PrimeNG `[label]` ternary pattern

**Simple 2-branch** — inline pipe in both branches:
```html
[label]="store.isClocking() ? ('TIME.CLOCKING_IN' | translate) : ('TIME.CLOCK_IN' | translate)"
```

**Complex multi-branch** (3+ conditions, or repeated in multiple places) — `computed()` helper signal in the component class:
```ts
readonly dialogHeader = computed(() =>
  this.employee()
    ? this.translate.instant('EMPLOYEES.EDIT_EMPLOYEE')
    : this.translate.instant('EMPLOYEES.ADD_EMPLOYEE')
);
```
Template: `[header]="dialogHeader()"`

Rule of thumb: if the expression exceeds ~60 characters or appears more than once, extract to `computed()`.

---

## ADR-6 — TypeScript toast strings

Two components use `MessageService.add()` with hardcoded strings: `employees.component.ts` and `timesheet-review.component.ts`.

Pattern:
```ts
private readonly translate = inject(TranslateService);

// Usage:
this.messageService.add({
  severity: 'success',
  summary: this.translate.instant('EMPLOYEES.TOAST_UPDATED_SUMMARY'),
  detail:  this.translate.instant('EMPLOYEES.TOAST_UPDATED_DETAIL'),
});
```

`TranslateService.instant()` is synchronous and safe to call after `init()` has run (translation file is loaded before the app renders).

---

## ADR-7 — Absence type labels migration

Current code in `absence-request.component.ts`:
```ts
const ABSENCE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacaciones',
  SICK_LEAVE: 'Incapacidad Temporal (IT)',
  // ... 7 more
};
```

Replace with a `computed()` that reads from `TranslateService`:
```ts
readonly absenceTypeLabel = computed(() => (type: string) =>
  this.translate.instant(`ABSENCES.TYPES.${type}`)
);
```

Template: `{{ absenceTypeLabel()(entry.type) }}`

The 9 canonical Spanish values become the `es.json` entries under `ABSENCES.TYPES.*`.

---

## ADR-8 — API enum status display

Raw values (`PENDING`, `APPROVED`, `REJECTED`, `OPEN`, `CLOSED`, `LATE`, `LIBRANZA`) are currently shown directly in templates as `p-tag [value]="entry.status"` etc.

Replace with translate pipe or helper:
```html
<p-tag [value]="'STATUS.' + entry.status | translate" />
```

`STATUS.*` keys defined in both translation files with human-readable labels.

---

## ADR-9 — Language toggle in shell topbar

Add immediately after the notification bell, before the dark/light toggle:

```html
<p-button
  [label]="lang.current() === 'es' ? 'EN' : 'ES'"
  [text]="true"
  [rounded]="true"
  severity="secondary"
  (onClick)="lang.toggle()"
  [pTooltip]="lang.current() === 'es' ? 'Switch to English' : 'Cambiar a Español'"
  tooltipPosition="bottom"
/>
```

`ShellComponent` injects `LanguageService` as `protected readonly lang`.

---

## File change summary

| File | Change |
|------|--------|
| `frontend/package.json` | Add `@ngx-translate/core`, `@ngx-translate/http-loader` |
| `frontend/src/app/app.config.ts` | `provideTranslateService`, `registerLocaleData`, `LanguageService.init()` in `provideAppInitializer` |
| `frontend/src/app/core/i18n/language.service.ts` | **New** — `LanguageService` |
| `frontend/public/assets/i18n/es.json` | **New** — ~250 canonical Spanish keys |
| `frontend/public/assets/i18n/en.json` | **New** — ~250 English translations |
| `shell.component.ts` | Language toggle button + inject `LanguageService` |
| `login.component.ts` | `TranslatePipe` import + translate all strings |
| `dashboard.component.ts` | `TranslatePipe` + `LanguageService` for dates + translate all strings |
| `employees.component.ts` + 3 sub-components | `TranslatePipe` + `TranslateService.instant()` for toasts + translate all |
| `clock.component.ts` | `TranslatePipe` + translate all strings + computed helpers |
| `absence-request.component.ts` | `TranslatePipe` + remove `ABSENCE_TYPE_LABELS` map + translate all |
| `timesheet-review.component.ts` | `TranslatePipe` + `TranslateService.instant()` for toasts + translate all |
| `timesheet-status.component.ts` | `TranslatePipe` + translate all |
| `cuadrante.component.ts` + grid | `TranslatePipe` + translate all |
| `reports.component.ts` | `TranslatePipe` + translate all |
| `rulesets.component.ts` | `TranslatePipe` + translate all |
| `notification-list.component.ts` + bell | `TranslatePipe` + translate all |
| `public-shell.component.ts` | `TranslatePipe` if any strings |
