# Spec: i18n-localization

## FR-I18N-01 — Default language is Spanish

**Given** a user opens the app for the first time (no `tempora-lang` in localStorage)  
**Then** the UI renders entirely in Spanish  
**And** the language toggle in the topbar shows "EN" (indicating the alternative language)

---

## FR-I18N-02 — Language toggle in topbar

**Given** the user is authenticated and the shell is visible  
**Then** a language toggle button appears in the topbar between the notification bell and the dark/light mode toggle  
**And** it displays "EN" when the current language is Spanish, "ES" when the current language is English  
**And** clicking it switches the entire UI to the other language instantly without a page reload  
**And** the selected language is saved to `localStorage` under the key `tempora-lang`

---

## FR-I18N-03 — Language persists across reloads

**Given** the user has selected English  
**When** they reload the page  
**Then** the UI loads in English  
**And** the topbar toggle shows "ES"

---

## FR-I18N-04 — Translation files

**Given** the app is built  
**Then** `public/assets/i18n/es.json` exists and contains all ~250 canonical Spanish keys  
**And** `public/assets/i18n/en.json` exists and contains the same ~250 keys translated to English  
**And** both files are organised under the following namespaces:  
  `NAV`, `AUTH`, `COMMON`, `DASHBOARD`, `EMPLOYEES`, `TIME`, `ABSENCES`, `TIMESHEET`, `REPORTS`, `ADMIN`, `NOTIFICATIONS`

---

## FR-I18N-05 — Zero hardcoded user-facing strings

**Given** any component template or TypeScript component file is inspected  
**Then** no user-facing string literal appears outside of a translate pipe or `TranslateService.instant()` call  
**And** this applies to: button labels, nav items, page titles, table headers, empty state messages, toast summaries and details, dialog headers, form field labels, placeholders, validation messages, tooltip text, badge text, confirmation messages

---

## FR-I18N-06 — Navigation labels translated

**Given** the user is logged in as ADMIN and the language is Spanish  
**Then** the sidebar shows: `Panel de control`, `Turnos`, `Control horario`, `Ausencias`, `Mi ficha horaria`, `Estado fichas`, `Empleados`, `Documentos`, `Informes`, `Configuración`, `Cerrar sesión`

**Given** the language is switched to English  
**Then** the sidebar shows: `Dashboard`, `Shifts`, `Time Tracking`, `Absences`, `My Timesheet`, `Timesheet Status`, `Employees`, `Documents`, `Reports`, `Settings`, `Sign out`

---

## FR-I18N-07 — Absence type labels use translation keys

**Given** any absence type is displayed (request form, table, status badge)  
**Then** the label comes from the translation file under `ABSENCES.TYPES.*` keys  
**And** the 9 canonical Spanish values match the existing hardcoded strings exactly:  
  `Vacaciones`, `Incapacidad Temporal (IT)`, `Permiso Retribuido`, `Permiso No Retribuido`, `Maternidad/Paternidad`, `Lactancia`, `Reducción de Jornada`, `Baja por Accidente`, `Otras`

---

## FR-I18N-08 — Date format follows locale

**Given** the active language is Spanish  
**Then** all `DatePipe` formatted dates render as `dd/MM/yyyy` (e.g. `07/06/2026`)

**Given** the active language is English  
**Then** all `DatePipe` formatted dates render as `MM/dd/yyyy` (e.g. `06/07/2026`)

Implementation note: achieved via `LOCALE_ID` signal + `DatePipe` locale input binding, not by translating date strings.

---

## FR-I18N-09 — API enum values displayed in user language

**Given** a status value is rendered (`PENDING`, `APPROVED`, `REJECTED`, `OPEN`, `CLOSED`, `LATE`, etc.)  
**Then** it is displayed as a translated human-readable label (e.g. `Pendiente`, `Aprobado`, `Rechazado` in Spanish)  
**And** the raw API enum value is never shown to the end user

---

## FR-I18N-10 — Toast notifications translated

**Given** any operation completes (save, delete, clock-in, clock-out, approval, rejection)  
**Then** the toast summary and detail text appear in the currently active language

---

## FR-I18N-11 — LanguageService

**Given** any component needs to read or change the active language  
**Then** it injects `LanguageService` (a singleton service in `core/i18n/`)  
**And** `LanguageService` exposes:
  - `current` — a `Signal<'es' | 'en'>` with the active language
  - `toggle()` — switches between `es` and `en`, updates TranslateService, persists to localStorage
  - `init()` — called at bootstrap, reads localStorage or defaults to `'es'`

---

## FR-I18N-12 — No regressions

**Given** the i18n migration is applied  
**Then** the Angular build produces no errors or warnings  
**And** all 275 backend tests continue to pass  
**And** all existing functionality works correctly in both languages  
**And** the dark/light mode toggle continues to work independently of the language toggle  
**And** authentication, navigation, and all CRUD operations function identically in both languages

---

## Non-functional requirements

- Translation keys use SCREAMING_SNAKE_CASE within their namespace: `NAV.DASHBOARD`, `COMMON.SAVE`, `EMPLOYEES.ADD_EMPLOYEE`
- No key may appear in a component without a corresponding entry in both `es.json` and `en.json`
- `TranslateModule` must be provided globally (via `app.config.ts`) — individual components must NOT import `TranslateModule` directly
- The `translate` pipe must be available to all standalone components without per-component imports
