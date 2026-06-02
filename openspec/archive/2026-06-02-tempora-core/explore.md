# SDD Exploration — Tempora

**Change:** tempora-core
**Date:** 2026-05-31
**Status:** complete

---

## Current Codebase State

### Frontend (`frontend/`)
- Angular 21.2, standalone components (no NgModules), strict TypeScript 5.9
- `bootstrapApplication` entry point — no HTTP client, no auth, no interceptors configured
- `app.routes.ts` is empty (`Routes = []`) — placeholder only
- `app.ts` has a single `signal('frontend')` — no domain code
- Testing: Vitest 4 via `@angular/build:unit-test`, TestBed configured
- Build: `@angular/build:application` (esbuild), SCSS, `OnPush` not yet set on root component
- No state management library installed (no NgRx, no Signals Store package)
- Prettier configured: single quotes, 100 char width, Angular HTML parser
- Conventions enforced (CLAUDE.md): standalone, `inject()`, `input()`/`output()`, native control flow, no `ngClass`/`ngStyle`, `computed()` for derived state, Reactive Forms

### Backend (`backend/`)
- `package.json` only — **NO `src/`**, NO `tsconfig.json`, NO entry point
- Dependencies: Express 5.2.1, cors, dotenv
- DevDependencies: ts-node, nodemon, TypeScript 6.0.3, @types/express, @types/node
- `"type": "commonjs"` — decision point (CommonJS vs ESM)
- No ORM, no database driver, no auth library, no test runner

### Missing from Both
- No OpenAPI/Swagger spec, no shared types package
- No monorepo tooling (no Turborepo/Nx)
- No Docker/compose, no env example files

---

## Domain Analysis

### Core Bounded Contexts

#### 1. Identity & Access Management (IAM)
- Roles: `admin`, `manager` (responsable de turno/unidad), `employee` (trabajador)
- Role hierarchy: admin > manager > employee; manager scope is CENTER-scoped, not global
- Permissions matrix:

| Action                        | Admin | Manager (own center) | Employee |
|-------------------------------|-------|----------------------|----------|
| Create/edit employees         | YES   | NO                   | NO       |
| Create/edit shifts            | YES   | YES                  | NO       |
| Approve time entries          | YES   | YES                  | NO       |
| View own schedule             | YES   | YES                  | YES      |
| Request shift swap            | YES   | YES                  | YES      |
| Export reports                | YES   | YES                  | NO       |
| Manage centers                | YES   | NO                   | NO       |

#### 2. Organizational Structure
- `Organization` (empresa/grupo empresarial) — top tenant
- `Center` (centro sanitario) — physical facility (e.g., "Residencia El Pinar")
- `Department` / `Unit` — e.g., "Planta 2", "UCI", "Consultas Externas"
- An `Employee` has one primary `Center` but can be assigned shifts at other centers

#### 3. Employee Management
- Categories in Spanish healthcare/socio-healthcare:
  - Médico/a, Enfermero/a, TCAE (Técnico en Cuidados Auxiliares de Enfermería)
  - Fisioterapeuta, Terapeuta Ocupacional, Psicólogo/a, Trabajador/a Social
  - Celador/a, Personal Administrativo, Cocinero/a, Auxiliar de Servicios
- Contract types: indefinido, temporal, interinidad, obra y servicio, tiempo parcial
- Part-time contracts: must track `contractedHoursPerWeek` vs actual — legally significant
- `workingCalendar`: assigned annual calendar (festivos, jornada anual pactada)

#### 4. Shift Management (Turno)
- Shift types common in Spanish healthcare:
  - `mañana` (07:00–15:00), `tarde` (15:00–23:00), `noche` (23:00–07:00)
  - `guardia` / `retén` (on-call — 12h or 24h)
  - `refuerzo` (reinforcement), `libranza` (scheduled day off)
  - Weekend patterns
- `ShiftTemplate`: reusable shift definition (name, start, end, category requirements)
- `ShiftAssignment`: employee + template + date + unit (concrete assignment)
- `RotationPattern`: recurring cycle (e.g., 5-on-2-off, or 3-shift nursing rotation)
- `ShiftSchedule` (cuadrante): published monthly schedule for a center/unit
- `CambioTurno`: swap request — employee A requests swap with B; manager approves

#### 5. Time Tracking (Control Horario)
- `TimeEntry`: clock-in (`fichaje entrada`) + clock-out (`fichaje salida`) per employee per day
- Legal basis: Real Decreto-ley 8/2019, Art. 34.9 ET — **mandatory** since May 2019
- 2026 reform: digital-only, unalterable records, remote Labor Inspection access
- `TimeCorrection`: request to correct an entry with justification (manager-approved)
- `OvertimeEntry`: hours beyond scheduled shift — tracked separately
- Approval workflow: draft → submitted → approved / rejected
- **Audit trail: every change must be immutable — append-only, never mutate**

#### 6. Absence & Leave (Ausencias)
- `vacaciones` (annual leave)
- `IT` — incapacidad temporal (sick leave, subdivided by cause)
- `permiso retribuido` (paid leave: wedding, bereavement — Art. 37 ET)
- `ausencia injustificada`
- `lactancia`, `reducción de jornada` (parental provisions)

#### 7. Reporting & Compliance
- Monthly hours report per employee (payroll input)
- Overtime summary, absenteeism report, shift coverage gaps report
- Export formats: PDF, XLSX (required by HR departments)
- Data retention: **4 years minimum** (RD-ley 8/2019)

---

## Regulatory Constraints (Spanish Law)

| Constraint | Source | Impact |
|---|---|---|
| Daily rest: min 12h between shifts | Art. 34.3 ET | Shift validator MUST flag violations |
| Weekly rest: min 1.5 consecutive days | Art. 37.1 ET | Schedule generator must enforce |
| Max 9h effective work/day | Art. 34.3 ET | Overtime tracking mandatory beyond this |
| Max 80h overtime/year | Art. 35.2 ET | Running counter per employee/year |
| Registro de jornada: mandatory daily in/out | Art. 34.9 ET + RD-ley 8/2019 | Core feature — tamper-evident log |
| Records retention: 4 years | RD-ley 8/2019 | Soft-delete only; audit table never purged |
| 2026 reform: digital-only, unalterable, inspector remote access | New RD (2026) | Append-only design mandatory from day one |
| Workweek reducing to 37.5h | Pending law (Dec 2025) | Hours calculation must be configurable per org |
| GDPR / LOPD-GDD | EU 2016/679 + LO 3/2018 | Health data = special category; consent, DPO, access logs |
| Collective agreements (Convenios) | Sector-specific (CEAPS, ACRA, etc.) | Rules engine must be configurable per organization |

**Key insight**: rules must be parameterizable per organization — different clients operate under different convenios.

---

## Architecture Approaches Evaluated

### API Design

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| REST + shared types | Proven, OpenAPI-able, future mobile-friendly | Manual type sync risk | **Recommended** |
| tRPC | Zero type drift | Angular client immature; monorepo required | Reject |
| OpenAPI-first + codegen | Best for compliance docs | Slow iteration; three things to maintain | Later option |

**Decision: REST with a `packages/shared` Zod-schema package** inside an npm workspaces monorepo.

### Authentication

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| JWT (stateless) | Simple; no DB lookup per request | Revocation needs blocklist | **Recommended** |
| Session + Redis | Easy revocation | Stateful; Redis infrastructure | Future option |
| OAuth2/OIDC | SSO, AD/LDAP integration | Overkill for most private clinics | Enterprise add-on |

**Decision: JWT with short-lived access tokens (15 min) + httpOnly refresh token cookies (7 days) + blocklist table for revocation.**

### Real-time

| Option | Verdict |
|---|---|
| Polling | Wasteful |
| **SSE (Server-Sent Events)** | **Recommended** — all identified use cases are server→client only |
| WebSockets | Overkill |

Use cases: shift swap notifications, schedule publication, live clock-in dashboard.

### Tenancy

**Decision: Multi-tenant, shared database, `organization_id` on every table + PostgreSQL Row Level Security (RLS).**
- Pragmatic for SaaS targeting many private clinics/residencias
- RLS provides database-level safety net against application query bugs

### Database (Not Installed Yet)

| Option | Verdict |
|---|---|
| PostgreSQL + Prisma | **Recommended** — type-safe, migrations, RLS support, ecosystem maturity |
| PostgreSQL + Drizzle | Compelling but too new for a regulated domain |
| PostgreSQL + raw `pg` | Full control but verbose type mapping |

### Frontend State Management

| Option | Verdict |
|---|---|
| Angular Signals (built-in) | Good for simple feature state |
| **`@ngrx/signals`** | **Recommended** — structured, officially part of Angular ecosystem, built on Signals |
| NgRx classic | Too much boilerplate for this scale |

---

## Frontend Architecture

### Feature Structure (Screaming Architecture by Domain)

```
src/
  app/
    core/                   ← singleton services, interceptors, guards
      auth/
      http/
    shared/                 ← reusable presentational components, pipes, directives
      ui/
      pipes/
    features/               ← lazy-loaded feature shells
      shifts/
        data-access/        ← services, state, API calls
        feature/            ← smart container components
        ui/                 ← dumb presentational components
      time-tracking/
      employees/
      reports/
      admin/
```

Each feature follows the **container-presentational pattern** (as enforced by project conventions).

### Form Strategy
- Reactive Forms throughout (enforced by CLAUDE.md)
- `FormArray` for multi-row schedule grids (cuadrante)
- Angular 14+ typed forms (`FormGroup<T>`) with strict TypeScript
- Complex validation: shift conflict detection runs server-side (not just client-side)

---

## Open Decisions for Proposal Phase

1. **Monorepo structure** — npm workspaces with `packages/shared` (recommended, no Turborepo initially)
2. **Database** — PostgreSQL confirmed; Prisma ORM (decision above)
3. **CommonJS vs ESM** — Resolve before writing backend code (recommend staying CommonJS with ts-node for stability)
4. **UI component library** — Must choose before building feature components (Angular Material, PrimeNG, or custom)
5. **Multi-center manager scope** — Data model must support it from day one
6. **Collective agreement rules engine** — Configurable per organization from day one

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Health data = GDPR special category (time records tied to sick leave) | CRITICAL | Encrypt sensitive fields; DPO likely required; access log every query |
| 2026 control horario reform: digital-only, unalterable records | HIGH | Append-only audit log from day one; no UPDATE on time entries |
| Collective agreement variability across clients | HIGH | Configurable rules engine per organization |
| Shift conflict detection complexity (12h rest, max hours, category minimums) | HIGH | Dedicated domain service; server-side enforcement |
| Backend `src/` completely missing | HIGH | Must be designed and scaffolded upfront |
| `"type": "commonjs"` conflicts with modern ESM ecosystem | MEDIUM | Decide early — recommend staying CommonJS with ts-node |
| No shared types package — type drift risk | MEDIUM | Create `packages/shared` before first endpoint |
| No UI component library decided | MEDIUM | Choose before building feature components |
| Offline support (nurses in poor connectivity areas) | LOW-MEDIUM | Service Worker + IndexedDB; implement post-MVP |
| Multi-center managers scope | MEDIUM | Model from day one — not a retrofit |
| Part-time contract tracking (contracted vs actual hours) | MEDIUM | `contractedHoursPerWeek` on Employee; deviation report required |
