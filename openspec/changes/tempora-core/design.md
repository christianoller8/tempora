# Technical Design: Tempora Core

**Change:** tempora-core
**Date:** 2026-05-31
**Status:** design
**Depends on:** `proposal.md` (architecture decisions ADR-1..ADR-10)
**Audience:** Implementers. This document is the HOW at the construction level — exact wiring, schema, interfaces, and patterns. It does not re-argue the ADRs; it builds on them.

---

## 1. Monorepo Wiring

### 1.1 Root `package.json`

```json
{
  "name": "tempora",
  "version": "1.0.0",
  "private": true,
  "packageManager": "npm@11.13.0",
  "workspaces": [
    "packages/shared",
    "backend",
    "frontend"
  ],
  "scripts": {
    "build:shared": "npm run build -w @tempora/shared",
    "dev:backend": "npm run dev -w backend",
    "dev:frontend": "npm run start -w frontend",
    "db:up": "docker compose up -d postgres",
    "db:migrate": "npm run prisma:migrate -w backend",
    "prepare": "npm run build:shared"
  },
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

Notes:
- `packages/shared` is listed FIRST so a clean `npm install` symlinks it before the consumers resolve it.
- `@tempora/shared` is the package name; both consumers import from `@tempora/shared` (and subpaths) rather than relative paths.
- The root `prepare` hook builds `shared` once after install so the backend's `ts-node` and the frontend's esbuild both find emitted `dist/`.

### 1.2 How `packages/shared` is referenced

Both consumers add a workspace dependency:

```jsonc
// backend/package.json and frontend/package.json
"dependencies": {
  "@tempora/shared": "*"
}
```

npm workspaces creates `node_modules/@tempora/shared` as a symlink to `packages/shared`. Resolution then differs per consumer:

- **Backend (ts-node, CommonJS):** resolves `@tempora/shared` through the package `main`/`exports` to the emitted CommonJS `dist/index.js` + `dist/index.d.ts`. No special config; standard Node resolution. During active development you may point `ts-node` at source via a `tsconfig` path alias (see below) to avoid rebuilding on every change.
- **Frontend (Angular `@angular/build` / esbuild):** esbuild follows `exports` → the ESM (`module`) entry. esbuild bundles it directly; no Angular library build needed because `shared` contains only framework-agnostic Zod schemas, types, and constants (no Angular decorators, no `@Injectable`).

To let both run against TypeScript source during dev (no rebuild loop), add a path alias in each consumer's `tsconfig`:

```jsonc
// backend/tsconfig.json and frontend/tsconfig.json -> compilerOptions
"paths": {
  "@tempora/shared": ["../packages/shared/src/index.ts"],
  "@tempora/shared/*": ["../packages/shared/src/*"]
}
```

For production builds, remove/ignore the alias and consume the emitted `dist/` via `exports`. The alias is a dev convenience; the package `exports` is the contract.

### 1.3 `packages/shared/tsconfig.json`

Emits dual output so a CJS backend and an esbuild frontend can both consume it. We emit one base (CJS) build plus a `.d.ts`, and a thin ESM mirror.

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ES2022"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

`module: NodeNext` lets us ship both `.cjs` and `.mjs` outputs driven by the `exports` map. Build with `tsc` (the simplest path); if dual emit proves noisy, swap the build script to `tsup --format cjs,esm --dts` without changing the public `exports` contract.

### 1.4 `packages/shared/package.json`

```json
{
  "name": "@tempora/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./schemas": {
      "types": "./dist/schemas/index.d.ts",
      "import": "./dist/schemas/index.js",
      "require": "./dist/schemas/index.cjs"
    },
    "./constants": {
      "types": "./dist/constants/index.d.ts",
      "import": "./dist/constants/index.js",
      "require": "./dist/constants/index.cjs"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts src/schemas/index.ts src/constants/index.ts --format cjs,esm --dts --clean",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0"
  }
}
```

`zod` is a runtime `dependency` of `shared` (not a peer) so both consumers pull the exact same Zod version — eliminating the "two Zod copies" `instanceof` failure.

---

## 2. Prisma Schema Design

Full `backend/prisma/schema.prisma`. PostgreSQL-native types throughout. All IDs are `@db.Uuid` generated by `gen_random_uuid()` (pgcrypto). Timestamps are `@db.Timestamptz(6)`. Hours/decimals use `@db.Decimal`.

```prisma
// backend/prisma/schema.prisma
// -----------------------------------------------------------------------------
// MULTI-TENANCY: every tenant-owned model carries organizationId @db.Uuid.
// RLS policies (see design §8) enforce organizationId = current_setting('app.current_org').
// IMMUTABILITY: TimeEntry and AuditLog are INSERT-ONLY. They intentionally have
//   NO @updatedAt and participate in NO cascade deletes. DB privileges (design §8)
//   revoke UPDATE/DELETE for the app role on these tables.
// INDEXING: composite indexes always lead with organizationId.
// -----------------------------------------------------------------------------

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

// ----------------------------- ENUMS -----------------------------

enum Role {
  ADMIN
  MANAGER
  EMPLOYEE
}

enum EmployeeCategory {
  MEDICO
  ENFERMERO
  TCAE
  FISIOTERAPEUTA
  TERAPEUTA_OCUPACIONAL
  PSICOLOGO
  TRABAJADOR_SOCIAL
  CELADOR
  ADMINISTRATIVO
  COCINERO
  AUXILIAR_SERVICIOS
}

enum ContractType {
  INDEFINIDO
  TEMPORAL
  INTERINIDAD
  OBRA_Y_SERVICIO
  TIEMPO_PARCIAL
}

enum ShiftType {
  MANANA
  TARDE
  NOCHE
  GUARDIA
  RETEN
  REFUERZO
  LIBRANZA
}

enum ScheduleStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum AbsenceType {
  VACACIONES
  IT            // incapacidad temporal (special-category health data)
  PERMISO_RETRIBUIDO
  AUSENCIA_INJUSTIFICADA
  LACTANCIA
  REDUCCION_JORNADA
}

enum EntryStatus {
  OPEN          // clocked in, not yet clocked out
  CLOSED        // clock-in + clock-out recorded
}

enum CorrectionStatus {
  PENDING
  APPROVED
  REJECTED
}

enum SwapStatus {
  REQUESTED
  APPROVED
  REJECTED
  CANCELLED
}

enum AbsenceStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum RuleViolation {
  MIN_REST_12H
  MAX_DAILY_9H
  MAX_ANNUAL_OT_80H
  WEEKLY_REST_1_5_DAYS
  CATEGORY_COVERAGE
  SHIFT_OVERLAP
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  READ          // special-category access logging (GDPR Art. 9)
  APPROVE
  REJECT
  PUBLISH
  LOGIN
  LOGOUT
}

// ----------------------------- ORGANIZATION TREE -----------------------------

model Organization {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  cif       String?  // Spanish tax ID
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)

  centers           Center[]
  departments       Department[]
  users             User[]
  employees         Employee[]
  workingCalendars  WorkingCalendar[]
  ruleSets          RuleSet[]
  shiftTemplates    ShiftTemplate[]
  rotationPatterns  RotationPattern[]
  schedules         ShiftSchedule[]
  assignments       ShiftAssignment[]
  swaps             CambioTurno[]
  timeEntries       TimeEntry[]
  timeCorrections   TimeCorrection[]
  absences          Absence[]
  auditLogs         AuditLog[]

  @@map("organizations")
}

model Center {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  address        String?
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  organization      Organization @relation(fields: [organizationId], references: [id])
  departments       Department[]
  primaryEmployees  Employee[]   @relation("PrimaryCenter")
  schedules         ShiftSchedule[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("centers")
}

model Department {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @db.Uuid
  centerId       String   @db.Uuid
  name           String   // "Planta 2", "UCI", "Consultas Externas"
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  center       Center       @relation(fields: [centerId], references: [id])
  schedules    ShiftSchedule[]
  assignments  ShiftAssignment[]

  @@unique([centerId, name])
  @@index([organizationId])
  @@index([organizationId, centerId])
  @@map("departments")
}

// ----------------------------- IAM -----------------------------

model User {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @db.Uuid
  email          String
  passwordHash   String                       // argon2id
  role           Role     @default(EMPLOYEE)
  isActive       Boolean  @default(true)
  employeeId     String?  @unique @db.Uuid     // null for admins without an HR record
  lastLoginAt    DateTime? @db.Timestamptz(6)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  employee     Employee?    @relation(fields: [employeeId], references: [id])

  @@unique([organizationId, email])
  @@index([organizationId])
  @@index([organizationId, role])
  @@map("users")
}

// Append-only revocation list. Checked on refresh and sensitive ops.
// jti is the access/refresh token id. Cleanup job purges rows past expiresAt.
model TokenBlocklist {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jti       String   @unique
  reason    String   // "logout" | "role_change" | "termination"
  expiresAt DateTime @db.Timestamptz(6)   // = original token exp; safe to purge after
  createdAt DateTime @default(now()) @db.Timestamptz(6)

  @@index([expiresAt])
  @@map("token_blocklist")
}

// ----------------------------- EMPLOYEES -----------------------------

model Employee {
  id                     String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId         String           @db.Uuid
  firstName              String
  lastName               String
  nif                    String?          // Spanish national ID
  category               EmployeeCategory
  contractType           ContractType
  contractedHoursPerWeek Decimal          @db.Decimal(5, 2)   // legally significant for part-time
  primaryCenterId        String           @db.Uuid
  workingCalendarId      String?          @db.Uuid
  hireDate               DateTime         @db.Date
  terminationDate        DateTime?        @db.Date
  isActive               Boolean          @default(true)
  createdAt              DateTime         @default(now()) @db.Timestamptz(6)
  updatedAt              DateTime         @updatedAt @db.Timestamptz(6)

  organization     Organization     @relation(fields: [organizationId], references: [id])
  primaryCenter    Center           @relation("PrimaryCenter", fields: [primaryCenterId], references: [id])
  workingCalendar  WorkingCalendar? @relation(fields: [workingCalendarId], references: [id])
  user             User?
  assignments      ShiftAssignment[]
  timeEntries      TimeEntry[]
  absences         Absence[]

  @@index([organizationId])
  @@index([organizationId, primaryCenterId])
  @@index([organizationId, category])
  @@map("employees")
}

model WorkingCalendar {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId  String   @db.Uuid
  name            String
  year            Int
  annualHours     Decimal  @db.Decimal(7, 2)
  holidays        Json     // array of ISO dates + labels (festivos)
  createdAt       DateTime @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  employees    Employee[]

  @@unique([organizationId, name, year])
  @@index([organizationId])
  @@map("working_calendars")
}

// ----------------------------- RULES -----------------------------

// Per-organization convenio configuration consumed by the Rules Engine (§6).
model RuleSet {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId     String   @db.Uuid
  name               String
  isDefault          Boolean  @default(false)
  minRestHours       Decimal  @db.Decimal(4, 2) @default(12.00)
  maxDailyHours      Decimal  @db.Decimal(4, 2) @default(9.00)
  maxAnnualOvertime  Decimal  @db.Decimal(6, 2) @default(80.00)
  weeklyRestDays     Decimal  @db.Decimal(3, 2) @default(1.50)
  params             Json     // extension bag for convenio-specific knobs
  createdAt          DateTime @default(now()) @db.Timestamptz(6)
  updatedAt          DateTime @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("rule_sets")
}

// ----------------------------- SHIFTS -----------------------------

model ShiftTemplate {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId       String    @db.Uuid
  name                 String
  shiftType            ShiftType
  startTime            String    // "07:00" local wall-clock; date supplied by assignment
  endTime              String    // "15:00"; if < startTime the shift crosses midnight
  crossesMidnight      Boolean   @default(false)
  breakMinutes         Int       @default(0)
  categoryRequirements Json      // { "ENFERMERO": 2, "TCAE": 3 }
  createdAt            DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt            DateTime  @updatedAt @db.Timestamptz(6)

  organization Organization      @relation(fields: [organizationId], references: [id])
  assignments  ShiftAssignment[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("shift_templates")
}

model RotationPattern {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  cycleLength    Int      // days in the cycle (e.g., 7 for 5-on-2-off)
  cycle          Json     // ordered array of { day, shiftTemplateId | "LIBRANZA" }
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("rotation_patterns")
}

// The cuadrante: a center/department monthly schedule, draft -> published.
model ShiftSchedule {
  id             String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String         @db.Uuid
  centerId       String         @db.Uuid
  departmentId   String?        @db.Uuid
  year           Int
  month          Int            // 1-12
  status         ScheduleStatus @default(DRAFT)
  publishedAt    DateTime?      @db.Timestamptz(6)
  publishedBy    String?        @db.Uuid   // userId
  createdAt      DateTime       @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime       @updatedAt @db.Timestamptz(6)

  organization Organization      @relation(fields: [organizationId], references: [id])
  center       Center            @relation(fields: [centerId], references: [id])
  department   Department?       @relation(fields: [departmentId], references: [id])
  assignments  ShiftAssignment[]

  @@unique([organizationId, centerId, departmentId, year, month])
  @@index([organizationId])
  @@index([organizationId, centerId, status])
  @@map("shift_schedules")
}

model ShiftAssignment {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId  String   @db.Uuid
  scheduleId      String   @db.Uuid
  employeeId      String   @db.Uuid
  shiftTemplateId String   @db.Uuid
  departmentId    String?  @db.Uuid
  date            DateTime @db.Date
  createdAt       DateTime @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @db.Timestamptz(6)

  organization  Organization  @relation(fields: [organizationId], references: [id])
  schedule      ShiftSchedule @relation(fields: [scheduleId], references: [id])
  employee      Employee      @relation(fields: [employeeId], references: [id])
  shiftTemplate ShiftTemplate @relation(fields: [shiftTemplateId], references: [id])
  department    Department?   @relation(fields: [departmentId], references: [id])

  requestedSwaps CambioTurno[] @relation("RequesterAssignment")
  targetedSwaps  CambioTurno[] @relation("TargetAssignment")

  @@unique([employeeId, date, shiftTemplateId])
  @@index([organizationId])
  @@index([organizationId, scheduleId])
  @@index([organizationId, employeeId, date])
  @@map("shift_assignments")
}

// Swap request (cambio de turno) between two assignments.
model CambioTurno {
  id                    String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId        String     @db.Uuid
  requesterAssignmentId String     @db.Uuid
  targetAssignmentId    String?    @db.Uuid   // null = open swap / coverage request
  status                SwapStatus @default(REQUESTED)
  reason                String?
  approverId            String?    @db.Uuid   // userId
  decidedAt             DateTime?  @db.Timestamptz(6)
  createdAt             DateTime   @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime   @updatedAt @db.Timestamptz(6)

  organization        Organization    @relation(fields: [organizationId], references: [id])
  requesterAssignment ShiftAssignment @relation("RequesterAssignment", fields: [requesterAssignmentId], references: [id])
  targetAssignment    ShiftAssignment? @relation("TargetAssignment", fields: [targetAssignmentId], references: [id])

  @@index([organizationId])
  @@index([organizationId, status])
  @@map("cambios_turno")
}

// ----------------------------- TIME TRACKING -----------------------------

// IMMUTABLE / INSERT-ONLY. No @updatedAt. No cascade. App role has INSERT only.
// Corrections never mutate this row; they create a linked TimeCorrection.
model TimeEntry {
  id             String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String      @db.Uuid
  employeeId     String      @db.Uuid
  clockIn        DateTime    @db.Timestamptz(6)   // server-authoritative
  clockOut       DateTime?   @db.Timestamptz(6)   // set by a SEPARATE insert? No:
  // NOTE: clock-out is the one allowed transition. To preserve append-only semantics,
  // clock-out is modeled as a paired entry strategy: clockIn row is created OPEN; the
  // clock-out writes a new immutable row referencing pairedEntryId and flips a
  // read-model. See design §note. For MVP we permit a single controlled UPDATE of
  // clockOut guarded at the DB by a trigger that allows the OPEN->CLOSED transition
  // ONLY when clockOut was previously NULL. All other UPDATE/DELETE are revoked.
  status         EntryStatus @default(OPEN)
  source         String      @default("web")      // web | kiosk | api
  capturedAtClient DateTime? @db.Timestamptz(6)   // reserved for P6 offline reconciliation
  createdAt      DateTime    @default(now()) @db.Timestamptz(6)

  organization Organization     @relation(fields: [organizationId], references: [id])
  employee     Employee         @relation(fields: [employeeId], references: [id])
  corrections  TimeCorrection[]

  @@index([organizationId])
  @@index([organizationId, employeeId, clockIn])
  @@index([organizationId, status])
  @@map("time_entries")
}

// A correction PROPOSES new values for an existing TimeEntry. Manager-approved.
// On approval, the corrected values are projected into reporting; the original
// TimeEntry row is NEVER overwritten — the correction is the record of change.
model TimeCorrection {
  id              String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId  String           @db.Uuid
  timeEntryId     String           @db.Uuid
  requestedById   String           @db.Uuid   // userId
  proposedClockIn  DateTime?       @db.Timestamptz(6)
  proposedClockOut DateTime?       @db.Timestamptz(6)
  justification   String
  status          CorrectionStatus @default(PENDING)
  approverId      String?          @db.Uuid
  decidedAt       DateTime?        @db.Timestamptz(6)
  createdAt       DateTime         @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime         @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  timeEntry    TimeEntry    @relation(fields: [timeEntryId], references: [id])

  @@index([organizationId])
  @@index([organizationId, timeEntryId])
  @@index([organizationId, status])
  @@map("time_corrections")
}

// ----------------------------- ABSENCES -----------------------------

model Absence {
  id             String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String        @db.Uuid
  employeeId     String        @db.Uuid
  type           AbsenceType
  startDate      DateTime      @db.Date
  endDate        DateTime      @db.Date
  status         AbsenceStatus @default(PENDING)
  // Special-category (GDPR Art. 9) — encrypted at app layer. Reads MUST be audited.
  causeEncrypted Bytes?
  approverId     String?       @db.Uuid
  decidedAt      DateTime?     @db.Timestamptz(6)
  createdAt      DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime      @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  employee     Employee     @relation(fields: [employeeId], references: [id])

  @@index([organizationId])
  @@index([organizationId, employeeId, startDate])
  @@index([organizationId, type, status])
  @@map("absences")
}

// ----------------------------- AUDIT -----------------------------

// APPEND-ONLY. No @updatedAt. No cascade. App role has INSERT only (no UPDATE/DELETE).
// `before`/`after` are JSON snapshots of the entity state. For action=READ on
// special-category data, `before`/`after` are null and `entityType`/`entityId`
// identify what was accessed (GDPR access log).
model AuditLog {
  id             String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String      @db.Uuid
  actorUserId    String?     @db.Uuid   // null for system actions
  action         AuditAction
  entityType     String      // "TimeEntry" | "Absence" | "Employee" | ...
  entityId       String?     @db.Uuid
  before         Json?       // entity snapshot pre-change (null for CREATE/READ)
  after          Json?       // entity snapshot post-change (null for DELETE/READ)
  ip             String?
  userAgent      String?
  createdAt      DateTime    @default(now()) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([organizationId, entityType, entityId])
  @@index([organizationId, action, createdAt])
  @@index([organizationId, actorUserId, createdAt])
  @@map("audit_logs")
}
```

**Immutability note (TimeEntry clock-out):** Append-only and "I need to set clock-out later" are in tension. The chosen approach: the `clockIn` row is created `OPEN`; clock-out performs the single permitted transition `OPEN → CLOSED` setting `clockOut`, guarded by a DB trigger that allows the write ONLY when `clockOut IS NULL` and `status = OPEN`. Any subsequent change must go through `TimeCorrection`. This keeps one row per work session (clean for reporting) while making the record effectively write-once after closure. The trigger is created in the RLS/privileges migration (§8).

---

## 3. Backend Architecture

### 3.1 Directory layout

```
backend/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    app.ts                      // express app assembly (no listen)
    server.ts                   // http.createServer + listen + graceful shutdown
    config/
      env.ts                    // zod-validated process.env -> typed config
    db/
      prisma.ts                 // PrismaClient singleton
      tenant.ts                 // withTenant() tx wrapper (SET app.current_org)
    middleware/
      auth.ts                   // verifyAccessToken -> req.user
      tenant-context.ts         // opens tenant tx, attaches req.db
      validate.ts               // zod body/query/params validation
      error.ts                  // central error handler -> error envelope
      audit.ts                  // post-handler audit emitter helper
      require-role.ts           // RBAC guard
    db-context.ts               // AsyncLocalStorage carrying req.db + req.user
    modules/
      iam/
        iam.router.ts
        iam.controller.ts
        iam.service.ts          // login/refresh/logout, jwt issue/verify, blocklist
        password.ts             // argon2 hash/verify
        jwt.ts                  // sign/verify access+refresh, jti, claims
      organization/
        organization.router.ts
        organization.controller.ts
        organization.service.ts // orgs, centers, departments CRUD
      employees/
        employees.router.ts
        employees.controller.ts
        employees.service.ts
        working-calendar.service.ts
      shifts/
        shifts.router.ts
        shifts.controller.ts
        templates.service.ts
        rotations.service.ts
        schedules.service.ts    // cuadrante draft/publish
        assignments.service.ts
        swaps.service.ts
      time-tracking/
        time.router.ts
        time.controller.ts
        time.service.ts         // clock-in/out, corrections, overtime calc
      absences/
        absences.router.ts
        absences.controller.ts
        absences.service.ts
        crypto.ts               // encrypt/decrypt special-category cause
      rules/
        rule-engine.ts          // PURE domain service — no express/prisma imports
        rules/                  // individual rule implementations
          min-rest.ts
          max-daily.ts
          max-annual-ot.ts
          weekly-rest.ts
        index.ts
      reporting/
        reporting.router.ts
        reporting.controller.ts
        reporting.service.ts    // read projections
        exporters/
          pdf.ts
          xlsx.ts
      notifications/
        notifications.router.ts // GET /notifications/stream (SSE)
        notifications.controller.ts
        notifications.service.ts
    sse/
      event-bus.ts              // per-org EventEmitter registry
      sse-hub.ts                // client registry, fan-out, keep-alive
      events.ts                 // event type definitions
    audit/
      audit-writer.ts           // AuditWriter service (INSERT-only)
    types/
      express.d.ts              // Request augmentation (req.user, req.db)
    utils/
      async-handler.ts          // wraps async controllers -> next(err)
  tsconfig.json
  nodemon.json
  package.json
```

### 3.2 Tenant-context Prisma wrapper

The core safety mechanism. Every tenant query runs inside a transaction that first sets `app.current_org`, so RLS policies (§8) scope all reads/writes. Outside this wrapper, RLS returns zero rows (fail-closed).

```typescript
// src/db/tenant.ts
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

// A transactional client scoped to one organization for the duration of the tx.
export type TenantClient = Prisma.TransactionClient;

export async function withTenant<T>(
  organizationId: string,
  fn: (tx: TenantClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config(setting, value, is_local=true) -> scoped to THIS transaction only.
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}::text, true)`;
    return fn(tx);
  });
}
```

The `tenant-context` middleware opens this wrapper per request and exposes the scoped client. Because Express middleware cannot easily hold an open transaction across the whole request without keeping the tx open for the controller's lifetime, we use `AsyncLocalStorage` so the controller/service layer reads `req.db` (the scoped `tx`) transparently:

```typescript
// src/db-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantClient } from './db/tenant';
import type { AuthUser } from './types/auth';

interface RequestContext {
  db: TenantClient;
  user: AuthUser;
}
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getDb(): TenantClient {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('No tenant context — query attempted outside withTenant');
  return ctx.db;
}
export function getUser(): AuthUser {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('No auth context');
  return ctx.user;
}
```

```typescript
// src/middleware/tenant-context.ts
import type { RequestHandler } from 'express';
import { withTenant } from '../db/tenant';
import { requestContext } from '../db-context';

export const tenantContext: RequestHandler = (req, res, next) => {
  const user = req.user; // set by auth middleware
  withTenant(user.organizationId, (db) =>
    new Promise<void>((resolve, reject) => {
      // Run the remainder of the request chain inside the ALS store AND inside the tx.
      requestContext.run({ db, user }, () => {
        res.on('finish', resolve);
        res.on('close', resolve);
        // hand control to the next handler; the tx stays open until res finishes.
        next((err?: unknown) => (err ? reject(err) : undefined));
      });
    }),
  ).catch(next);
};
```

Design tradeoff documented: holding the transaction open for the request lifetime is acceptable for this back-office workload (short requests, modest concurrency). If long requests appear (large report exports), those endpoints opt out of `tenantContext` and instead call `withTenant` per query batch. This is noted so implementers do not wrap streaming exports in a single long-lived tx.

### 3.3 Auth middleware

```typescript
// src/types/auth.ts
export interface AuthUser {
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  employeeId?: string;
  jti: string;
}
```

```typescript
// src/middleware/auth.ts
import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../modules/iam/jwt';
import { isBlocklisted } from '../modules/iam/iam.service';
import { ApiError } from '../middleware/error';

export const authenticate: RequestHandler = async (req, _res, next) => {
  // Regular API calls: Authorization: Bearer <token>
  // SSE connections: EventSource sends cookies (withCredentials: true); read from
  // access_token httpOnly cookie. Cookie-based path is intentional — EventSource
  // cannot set the Authorization header.
  const header = req.header('authorization');
  const rawToken = header?.startsWith('Bearer ')
    ? header.slice(7)
    : (req.cookies as Record<string, string | undefined>)['access_token'];

  if (!rawToken) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
  }
  try {
    const claims = verifyAccessToken(rawToken); // throws on bad/expired
    // Access tokens are short-lived; blocklist is checked here only for high-risk
    // routes via requireFreshAuth(). Refresh always checks the blocklist.
    req.user = {
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role,
      employeeId: claims.emp,
      jti: claims.jti,
    };
    next();
  } catch {
    next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired access token'));
  }
};
```

`req.user` is declared via module augmentation in `src/types/express.d.ts`:

```typescript
declare global {
  namespace Express {
    interface Request {
      user: import('./auth').AuthUser;
    }
  }
}
export {};
```

### 3.4 Request lifecycle (middleware stack order)

```
cors
  → express.json (+ cookie-parser for refresh cookie)
    → authenticate            (verify JWT → req.user)      [skipped on /auth/login, /auth/refresh]
      → tenantContext         (open tenant tx + ALS store)  [skipped on auth + health]
        → requireRole(...)    (per-route RBAC guard)
          → validate(schema)  (zod parse body/query/params)
            → controller      (calls service via getDb())
              → audit emit     (controller/service writes audit rows in-tx)
  → errorHandler              (catch-all → { code, message, details? })
```

Public routes (`/auth/login`, `/auth/refresh`, `/healthz`) mount before `authenticate`. The SSE route (`/notifications/stream`) runs `authenticate` but NOT `tenantContext` (it holds a long-lived connection and reads org from `req.user` directly).

### 3.5 Express 5 app setup (structure)

```typescript
// src/app.ts  — structure only
import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { authenticate } from './middleware/auth';
import { tenantContext } from './middleware/tenant-context';
import { iamRouter } from './modules/iam/iam.router';
import { organizationRouter } from './modules/organization/organization.router';
import { employeesRouter } from './modules/employees/employees.router';
import { shiftsRouter } from './modules/shifts/shifts.router';
import { timeRouter } from './modules/time-tracking/time.router';
import { absencesRouter } from './modules/absences/absences.router';
import { reportingRouter } from './modules/reporting/reporting.router';
import { notificationsRouter } from './modules/notifications/notifications.router';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Public
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', iamRouter); // login/refresh/logout are public; /me uses authenticate inside

  // Authenticated + tenant-scoped
  app.use('/notifications', authenticate, notificationsRouter); // SSE: no tenantContext
  app.use(authenticate, tenantContext); // gate for everything below
  app.use('/organizations', organizationRouter);
  app.use('/employees', employeesRouter);
  app.use('/shifts', shiftsRouter);
  app.use('/time-entries', timeRouter);
  app.use('/time-corrections', timeRouter);
  app.use('/absences', absencesRouter);
  app.use('/reports', reportingRouter);

  app.use(errorHandler); // Express 5 forwards async rejections here
  return app;
}
```

```typescript
// src/server.ts — structure only
import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { sseHub } from './sse/sse-hub';

const server = http.createServer(createApp());
server.listen(env.PORT);

async function shutdown() {
  sseHub.closeAll();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

Express 5 note: async route handlers that reject are automatically routed to `errorHandler`, so the `async-handler` wrapper is optional but kept for clarity and pre-5 parity.

---

## 4. `packages/shared` Design

### 4.1 Directory structure

```
packages/shared/src/
  index.ts                 // re-exports schemas, types, constants
  schemas/
    index.ts
    common.schema.ts       // pagination, error envelope, id, timestamps
    auth.schema.ts
    organization.schema.ts
    employee.schema.ts
    shift.schema.ts
    time-entry.schema.ts
    absence.schema.ts
    rule.schema.ts
  types/
    index.ts               // z.infer types + non-schema domain types
  constants/
    index.ts
    roles.ts
    permissions.ts
    enums.ts               // mirror of Prisma enums as const arrays for z.enum
    error-codes.ts
```

### 4.2 Key Zod schemas (to define, not implement here)

- **common.schema.ts**: `PaginationQuerySchema` (`page`, `pageSize`), `PaginatedResultSchema<T>` factory, `ErrorEnvelopeSchema` (`{ code, message, details? }`), `UuidSchema`, `IsoDateSchema`, `IsoDateTimeSchema`.
- **auth.schema.ts**: `LoginRequestSchema`, `LoginResponseSchema` (access token + user summary), `RefreshResponseSchema`, `MeResponseSchema`.
- **organization.schema.ts**: `CreateOrganizationSchema`, `CreateCenterSchema`, `CreateDepartmentSchema`, update variants (`.partial()`).
- **employee.schema.ts**: `CreateEmployeeSchema`, `UpdateEmployeeSchema`, `EmployeeResponseSchema`, `WorkingCalendarSchema`.
- **shift.schema.ts**: `ShiftTemplateSchema`, `RotationPatternSchema`, `CreateScheduleSchema`, `PublishScheduleSchema`, `ShiftAssignmentSchema`, `CreateSwapSchema`, `ApproveSwapSchema`.
- **time-entry.schema.ts**: `ClockInSchema`, `ClockOutSchema`, `TimeEntryResponseSchema`, `CreateCorrectionSchema`, `ApproveCorrectionSchema`, `OvertimeQuerySchema`.
- **absence.schema.ts**: `CreateAbsenceSchema`, `ApproveAbsenceSchema`, `AbsenceBalanceQuerySchema`.
- **rule.schema.ts**: `RuleSetSchema`, `RuleCheckResultSchema` (shared with the rules engine output, §6).

### 4.3 Type inference convention

```typescript
// schemas/auth.schema.ts
import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// types/index.ts
import type { z } from 'zod';
import type { LoginRequestSchema } from '../schemas/auth.schema';
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
```

The schema is the single source of truth; types are always `z.infer`'d — never hand-written duplicates. Backend imports `LoginRequestSchema` for `validate()`; frontend imports `LoginRequest` for typed forms and `LoginRequestSchema` for client-side pre-validation.

### 4.4 Role & permission constants

```typescript
// constants/roles.ts
export const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type RoleName = (typeof ROLES)[number];

// constants/permissions.ts
export const PERMISSIONS = {
  'employees:write': ['ADMIN'],
  'employees:read': ['ADMIN', 'MANAGER'],
  'shifts:write': ['ADMIN', 'MANAGER'],
  'shifts:publish': ['ADMIN', 'MANAGER'],
  'time:approve': ['ADMIN', 'MANAGER'],
  'time:clock-self': ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  'swaps:request': ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  'swaps:approve': ['ADMIN', 'MANAGER'],
  'absences:approve': ['ADMIN', 'MANAGER'],
  'reports:export': ['ADMIN', 'MANAGER'],
  'centers:manage': ['ADMIN'],
} as const satisfies Record<string, readonly RoleName[]>;

export type Permission = keyof typeof PERMISSIONS;
```

Both ends import `PERMISSIONS`: the backend's `requireRole`/`requirePermission` guard checks `req.user.role`, the frontend's `roleGuard` and template `*can` checks read the same map — one authority, no drift. Manager center-scoping (manager acts only on its own center) is enforced in the service layer, not the permission map (which is role-coarse).

---

## 5. Frontend Architecture

### 5.1 `src/app/` tree

```
src/app/
  app.ts                       // root shell component (OnPush)
  app.routes.ts                // top-level public vs authenticated shells
  app.config.ts                // providers: HttpClient, interceptors, router
  core/
    auth/
      auth.store.ts            // AuthStore (SignalStore): session, user, tokens-in-memory
      auth.service.ts          // login/refresh/logout HTTP calls
      auth.guard.ts            // canActivate: authenticated?
      role.guard.ts            // canActivate: role/permission check
      auth.interceptor.ts      // attach access token; 401 -> silent refresh
    http/
      api.service.ts           // base HTTP wrapper (typed get/post/patch/delete)
      api-error.ts             // maps error envelope -> typed AppError
      api.tokens.ts            // API_BASE_URL InjectionToken
    sse/
      sse.service.ts           // EventSource wrapper -> signals/observables
    layout/
      shell.component.ts       // authenticated shell: nav + <router-outlet>
      public-shell.component.ts
  shared/
    ui/                        // PrimeNG wrapper components (see 5.2)
    pipes/
    directives/
      has-permission.directive.ts  // structural: render if role allows
  features/
    auth/
      feature/login.component.ts
    employees/
      data-access/employees.store.ts
      data-access/employees.api.ts
      feature/employees-list.component.ts   // smart container
      feature/employee-form.component.ts
      ui/employee-table.component.ts         // presentational (wraps p-table)
    shifts/
      data-access/{schedules.store.ts, shifts.api.ts}
      feature/cuadrante.component.ts
      ui/{cuadrante-grid.component.ts, shift-cell.component.ts}
    time-tracking/
      data-access/time.store.ts
      feature/{clock.component.ts, live-dashboard.component.ts}
      ui/clock-widget.component.ts
    absences/
      data-access/absences.store.ts
      feature/...
      ui/...
    reports/
      data-access/reports.api.ts
      feature/reports.component.ts
    admin/
      feature/{organizations.component.ts, rulesets.component.ts}
```

Folder roles:
- **core/auth** — singletons: the session store, interceptors, guards. Tokens live in memory in `AuthStore` (access token); the refresh token is the httpOnly cookie (never touched by JS).
- **core/http** — `ApiService` is the only place `HttpClient` is called directly; feature APIs build on it for consistent error envelopes and base URL.
- **shared/ui** — thin PrimeNG wrappers (see below) so the app depends on our API, not PrimeNG's, easing future restyling/replacement.
- **features/\*/data-access** — SignalStore + a typed API service per feature.
- **features/\*/feature** — smart containers: inject the store, orchestrate, pass signals down.
- **features/\*/ui** — presentational, `input()`/`output()` only, no store injection.

### 5.2 PrimeNG wrappers (what to wrap and why)

Wrap to (a) centralize theming/a11y, (b) decouple from PrimeNG APIs, (c) inject domain defaults:
- `DataTableComponent` (wraps `p-table`) — preconfigured paginator, CSV/XLSX export hooks, frozen first column for cuadrante.
- `DatePickerComponent` (wraps `p-datepicker`) — Spanish locale, `dd/MM/yyyy`, week starts Monday.
- `DialogComponent`, `ToastService` (wraps `p-toast` + `MessageService`), `ConfirmService`.
- `SelectComponent` (wraps `p-select`) — consistent error display tied to Reactive Forms control state.

### 5.3 SignalStore pattern (EmployeesStore)

```typescript
// features/employees/data-access/employees.store.ts
import { computed, inject } from '@angular/core';
import {
  signalStore, withState, withComputed, withMethods, withHooks, patchState,
} from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import type { Employee, CreateEmployee } from '@tempora/shared';
import { EmployeesApi } from './employees.api';

type EmployeesState = { loading: boolean; error: string | null; selectedId: string | null };

export const EmployeesStore = signalStore(
  { providedIn: 'root' },
  withState<EmployeesState>({ loading: false, error: null, selectedId: null }),
  withEntities<Employee>(),
  withComputed(({ entities, selectedId }) => ({
    selected: computed(() => entities().find((e) => e.id === selectedId()) ?? null),
    count: computed(() => entities().length),
  })),
  withMethods((store, api = inject(EmployeesApi)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.list().pipe(
            tapResponse({
              next: (rows) => patchState(store, setAllEntities(rows), { loading: false }),
              error: (e: Error) => patchState(store, { loading: false, error: e.message }),
            }),
          ),
        ),
      ),
    ),
    async create(dto: CreateEmployee): Promise<void> {
      patchState(store, { loading: true });
      const created = await firstValueFrom(api.create(dto));
      patchState(store, setEntity(created), { loading: false });
    },
    select(id: string): void { patchState(store, { selectedId: id }); },
  })),
  withHooks({ onInit: (store) => store.load() }),
);
```

The store depends only on `EmployeesApi` (which depends on `core/http/ApiService`). Smart containers inject `EmployeesStore` and read its signals; presentational `ui/` components receive plain `input()`s.

### 5.4 Auth interceptor (attach JWT + silent refresh on 401)

```typescript
// core/auth/auth.interceptor.ts
import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const token = auth.accessToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Do not loop on the refresh endpoint itself.
      if (err.status === 401 && !req.url.includes('/auth/refresh')) {
        return auth.refresh().pipe( // calls POST /auth/refresh (cookie auto-sent), updates AuthStore
          switchMap((newToken) =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })),
          ),
          catchError((refreshErr) => {
            auth.logoutLocal(); // clear session, redirect handled by guard
            return throwError(() => refreshErr);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
```

`AuthStore.refresh()` deduplicates concurrent refreshes (a single in-flight `shareReplay`d request) so a burst of 401s triggers one refresh. The access token is kept only in `AuthStore` memory; on full reload the app calls `/auth/refresh` once at bootstrap to re-hydrate from the httpOnly cookie.

### 5.5 Route structure

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./core/layout/public-shell.component').then((m) => m.PublicShellComponent),
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/feature/login.component').then((m) => m.LoginComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/time-tracking/feature/live-dashboard.component').then((m) => m.LiveDashboardComponent) },
      {
        path: 'employees',
        canActivate: [roleGuard(['ADMIN', 'MANAGER'])],
        loadChildren: () => import('./features/employees/employees.routes').then((m) => m.routes),
      },
      {
        path: 'shifts',
        canActivate: [roleGuard(['ADMIN', 'MANAGER', 'EMPLOYEE'])],
        loadChildren: () => import('./features/shifts/shifts.routes').then((m) => m.routes),
      },
      { path: 'time-tracking', loadChildren: () => import('./features/time-tracking/time.routes').then((m) => m.routes) },
      { path: 'absences', loadChildren: () => import('./features/absences/absences.routes').then((m) => m.routes) },
      { path: 'reports', canActivate: [roleGuard(['ADMIN', 'MANAGER'])], loadChildren: () => import('./features/reports/reports.routes').then((m) => m.routes) },
      { path: 'admin', canActivate: [roleGuard(['ADMIN'])], loadChildren: () => import('./features/admin/admin.routes').then((m) => m.routes) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

`roleGuard(roles: RoleName[])` is a factory returning a `CanActivateFn` that reads `AuthStore.role()` and checks membership. Tenant scoping needs no guard (the JWT/RLS handles it); manager center-scope is enforced server-side.

### 5.6 SSE client service

```typescript
// core/sse/sse.service.ts
import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { API_BASE_URL } from '../http/api.tokens';
import type { SseEvent } from '@tempora/shared';

@Injectable({ providedIn: 'root' })
export class SseService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private source: EventSource | null = null;

  readonly connected = signal(false);
  readonly lastEvent = signal<SseEvent | null>(null);

  connect(): void {
    if (this.source) return;
    // withCredentials: true → browser sends the access_token httpOnly cookie automatically.
    // No token in the URL (avoids server logs / Referer header exposure).
    // CORS on the backend must have credentials: true + explicit origin (not '*').
    this.source = new EventSource(`${this.baseUrl}/notifications/stream`, { withCredentials: true });
    this.source.onopen = () => this.connected.set(true);
    this.source.onerror = () => this.connected.set(false); // browser auto-reconnects
    this.source.onmessage = (e) => this.lastEvent.set(JSON.parse(e.data) as SseEvent);
    this.destroyRef.onDestroy(() => this.disconnect());
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
    this.connected.set(false);
  }
}
```

**SSE auth — cookie + CORS:** On login and token refresh, the backend sets two httpOnly cookies: `refresh_token` (7 d) and `access_token` (15 min, same lifetime as the JWT in the Authorization response). `EventSource` is instantiated with `{ withCredentials: true }` so the browser sends the `access_token` cookie on every SSE connection and reconnect. The `authenticate` middleware reads from `Authorization: Bearer` first (regular requests) and falls back to the `access_token` cookie (SSE). CORS is configured with `credentials: true` and an explicit `CORS_ORIGIN` — never `*`. `SameSite=Lax` is required (not `Strict`) so the cookie is sent on cross-origin SSE connections (e.g., SPA on port 4200 → API on port 3000 in dev). Feature stores subscribe by `effect()`ing on `sse.lastEvent()` and reacting to relevant event `type`s.

---

## 6. Rules Engine Design

Pure TypeScript domain service. No Express, no Prisma, no I/O. Inputs are plain data; the caller (service layer) fetches context from the DB and passes it in.

```typescript
// modules/rules/types.ts  (RuleCheckResult shared with packages/shared)
import type { RuleViolation } from '@tempora/shared';

export type RuleSeverity = 'block' | 'warn';

export interface RuleCheckResult {
  type: RuleSeverity;
  code: RuleViolation;     // 'MIN_REST_12H' | 'MAX_DAILY_9H' | ...
  message: string;         // human-readable, Spanish UI copy resolved at presentation
  meta?: Record<string, unknown>; // e.g. { actualRestHours: 9.5, requiredRestHours: 12 }
}

export interface RuleSetConfig {
  minRestHours: number;
  maxDailyHours: number;
  maxAnnualOvertime: number;
  weeklyRestDays: number;
  params: Record<string, unknown>;
}

// Context assembled by the calling service before invoking the engine.
export interface RuleContext {
  organizationId: string;
  employeeId: string;
  // The operation under evaluation:
  candidate:
    | { kind: 'assignment'; date: string; startsAt: string; endsAt: string }
    | { kind: 'timeEntry'; clockIn: string; clockOut?: string };
  // Surrounding facts the rules need (pre-fetched, no I/O inside the engine):
  recentAssignments: Array<{ date: string; startsAt: string; endsAt: string }>;
  weekAssignments: Array<{ date: string; restDay: boolean }>;
  annualOvertimeHours: number;
}

export interface Rule {
  code: RuleViolation;
  evaluate(ctx: RuleContext, cfg: RuleSetConfig): RuleCheckResult | null;
}

export interface RuleEngine {
  check(context: RuleContext, ruleSet: RuleSetConfig): RuleCheckResult[];
}
```

```typescript
// modules/rules/index.ts — structure only
import type { Rule, RuleEngine } from './types';
import { minRest12h } from './rules/min-rest';
import { maxDaily9h } from './rules/max-daily';
import { maxAnnualOt80h } from './rules/max-annual-ot';
import { weeklyRest } from './rules/weekly-rest';

const REGISTRY: Rule[] = [minRest12h, maxDaily9h, maxAnnualOt80h, weeklyRest];

export const ruleEngine: RuleEngine = {
  check(context, ruleSet) {
    return REGISTRY
      .map((rule) => rule.evaluate(context, ruleSet))
      .filter((r): r is NonNullable<typeof r> => r !== null);
  },
};
```

Rules to implement (each is one pure function returning `RuleCheckResult | null`):
- `MIN_REST_12H` (`block`): gap between consecutive shift end and next start `< minRestHours`.
- `MAX_DAILY_9H` (`warn`/`block` per config): effective worked hours in a day `> maxDailyHours`.
- `MAX_ANNUAL_OT_80H` (`block`): `annualOvertimeHours + candidateOvertime > maxAnnualOvertime`.
- `WEEKLY_REST_1_5_DAYS` (`warn`): consecutive rest in the rolling 7-day window `< weeklyRestDays`.

Callers: `assignments.service.ts` invokes `check()` before persisting an assignment; `time.service.ts` invokes it on clock-out for overtime/daily-cap. `block` results abort the operation with a `422 RULE_VIOLATION`; `warn` results are returned in the response payload (`{ data, warnings: RuleCheckResult[] }`) and surfaced in the UI but do not block.

---

## 7. Audit Log Design

```typescript
// audit/audit-writer.ts
import type { TenantClient } from '../db/tenant';
import type { AuthUser } from '../types/auth';

export interface AuditEvent {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'APPROVE' | 'REJECT' | 'PUBLISH' | 'LOGIN' | 'LOGOUT';
  entityType: string;
  entityId?: string;
  before?: unknown;   // JSON snapshot pre-change
  after?: unknown;    // JSON snapshot post-change
}

export interface AuditWriter {
  // Writes WITHIN the caller's tenant transaction so the audit row commits
  // atomically with the business mutation. INSERT-only (no update/delete).
  write(db: TenantClient, actor: AuthUser, event: AuditEvent, req?: { ip?: string; userAgent?: string }): Promise<void>;
}
```

The writer is invoked inside the same tenant `tx` as the mutation it records, guaranteeing the audit row and the business change commit or roll back together. Because the app DB role has INSERT-only privileges on `audit_logs` (and `time_entries`), an attempt to mutate audit rows fails at the database, not just in code.

**Triggers for an audit write:**
- Every `TimeEntry` insert (clock-in) and the controlled clock-out transition → `CREATE`.
- Every `TimeCorrection` create/approve/reject → `CREATE`/`APPROVE`/`REJECT`.
- Every `Absence` mutation (create/approve/reject/cancel) → corresponding action.
- Every `Employee` create/update/deactivate → `CREATE`/`UPDATE`/`DELETE`.
- Every special-category read (decrypting `Absence.causeEncrypted`, IT cause) → `READ` with `before`/`after` null and `entityType="Absence"`, `entityId` set.
- Auth `LOGIN`/`LOGOUT`.

**GDPR special-category reads** use the SAME `audit_logs` table with `action: 'READ'`. Reasoning: one append-only, RLS-protected, never-purged store is simpler to prove to an inspector than two. A partial index (`WHERE action = 'READ'`) gives fast access-log queries without a separate table. `before`/`after` are `Json?` snapshots; for `READ` they are null (we log that access occurred, not the data read, minimizing duplication of sensitive content in the audit trail).

---

## 8. PostgreSQL RLS Setup

RLS is applied via a raw-SQL migration run after `prisma migrate` creates the tables (Prisma does not manage policies). Two DB roles: `tempora_app` (the application connects as this; RLS-enforced, INSERT-only on immutable tables) and `tempora_owner`/superuser (migrations + the audited super-admin bypass).

### 8.1 Policies (core tenant tables)

```sql
-- migration: enable RLS + per-tenant policy on every tenant-owned table.
-- Example for one table; repeat for centers, departments, employees,
-- shift_templates, rotation_patterns, shift_schedules, shift_assignments,
-- cambios_turno, time_entries, time_corrections, absences, audit_logs,
-- working_calendars, rule_sets, users.

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;  -- applies even to table owner

CREATE POLICY tenant_isolation ON employees
  USING (organization_id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- current_setting(..., true) returns NULL when unset -> comparison is NULL ->
-- row excluded. Fail-closed: no tenant context = zero rows.
```

### 8.2 Immutability privileges (TimeEntry + AuditLog)

```sql
-- App role: INSERT-only on append-only tables. The clock-out transition is
-- the ONLY permitted UPDATE on time_entries, enforced by a trigger, not GRANT.
GRANT INSERT, SELECT ON time_entries TO tempora_app;
GRANT INSERT, SELECT ON audit_logs  TO tempora_app;
REVOKE UPDATE, DELETE ON audit_logs FROM tempora_app;

-- Controlled clock-out: allow UPDATE only when closing an OPEN entry.
CREATE OR REPLACE FUNCTION enforce_timeentry_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'time_entries are append-only';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.clock_out IS NOT NULL OR OLD.status <> 'OPEN'
       OR NEW.clock_in <> OLD.clock_in OR NEW.employee_id <> OLD.employee_id THEN
      RAISE EXCEPTION 'time_entries: only the OPEN->CLOSED clock-out transition is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_timeentry_immutable
  BEFORE UPDATE OR DELETE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_timeentry_immutability();
```

### 8.3 Setting `app.current_org` (Prisma pattern)

Done by `withTenant` (§3.2) via `set_config('app.current_org', $org, true)` — the `true` makes it transaction-local, so it cannot leak across pooled connections. All tenant queries flow through this wrapper.

### 8.4 Super-admin bypass

Cross-tenant operations (platform admin, support tooling) connect with a role that has `BYPASSRLS`, used through a separate, explicitly-audited code path:

```sql
ALTER ROLE tempora_owner BYPASSRLS;  -- migrations + audited admin tooling only
```

Application requests NEVER use this role. Any bypass operation must write an `AuditLog` row with `actorUserId` of the platform admin and a justification in `after`. The standard `tempora_app` role does not have `BYPASSRLS`; `FORCE ROW LEVEL SECURITY` ensures even table-owner connections are policy-checked unless they hold `BYPASSRLS`.

---

## 9. SSE Implementation

### 9.1 In-process event bus

```typescript
// sse/event-bus.ts
import { EventEmitter } from 'node:events';

// One EventEmitter per organization. Lazily created, removed when no listeners.
class OrgEventBus {
  private readonly emitters = new Map<string, EventEmitter>();

  for(orgId: string): EventEmitter {
    let e = this.emitters.get(orgId);
    if (!e) { e = new EventEmitter(); e.setMaxListeners(0); this.emitters.set(orgId, e); }
    return e;
  }
  publish(orgId: string, event: SseEvent): void {
    this.emitters.get(orgId)?.emit('event', event);
  }
}
export const eventBus = new OrgEventBus();
```

Service-layer code (e.g., `schedules.service.ts` after publish) calls `eventBus.publish(orgId, { type: 'SHIFT_PUBLISHED', ... })`. Designed so that swapping the in-process bus for Redis pub/sub later is a single-module change (same `publish`/`for` surface).

### 9.2 SSE endpoint handler (Express 5)

```typescript
// modules/notifications/notifications.controller.ts — structure
import type { Request, Response } from 'express';
import { eventBus } from '../../sse/event-bus';
import { sseHub } from '../../sse/sse-hub';

export function stream(req: Request, res: Response): void {
  const { organizationId, userId, role } = req.user;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering
  });
  res.write(': connected\n\n');

  const client = sseHub.register(organizationId, userId, role, res);

  const onEvent = (event: SseEvent) => {
    if (sseHub.shouldDeliver(client, event)) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
  };
  eventBus.for(organizationId).on('event', onEvent);

  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    eventBus.for(organizationId).off('event', onEvent);
    sseHub.unregister(client);
  });
}
```

`sseHub` maintains the client registry (per org → set of clients) and `shouldDeliver` applies targeting: org-wide events vs user-targeted (`event.targetUserId === client.userId`) vs role-targeted (`event.targetRole === client.role`). `closeAll()` is called on graceful shutdown.

### 9.3 Event types

```typescript
// sse/events.ts (mirrored in packages/shared for the client)
export type SseEventType =
  | 'SHIFT_PUBLISHED'
  | 'SWAP_REQUESTED'
  | 'SWAP_APPROVED'
  | 'CLOCK_IN'
  | 'CLOCK_OUT'
  | 'NOTIFICATION_READ';

export interface SseEvent {
  type: SseEventType;
  organizationId: string;
  targetUserId?: string;   // user-targeted delivery
  targetRole?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'; // role-targeted (e.g., live dashboard)
  payload: unknown;
  emittedAt: string;       // ISO timestamp
}
```

Targeting matrix: `SHIFT_PUBLISHED` → role `EMPLOYEE` + `MANAGER` of the center; `SWAP_REQUESTED`/`SWAP_APPROVED` → `targetUserId`; `CLOCK_IN`/`CLOCK_OUT` → role `MANAGER`/`ADMIN` (live dashboard); `NOTIFICATION_READ` → `targetUserId` (multi-tab sync).

---

## 10. Development Environment

### 10.1 `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:17
    container_name: tempora-postgres
    environment:
      POSTGRES_DB: tempora
      POSTGRES_USER: tempora_owner       # superuser/owner: migrations + BYPASSRLS
      POSTGRES_PASSWORD: ${DB_OWNER_PASSWORD:-devpassword}
    ports:
      - '5432:5432'
    volumes:
      - tempora-pgdata:/var/lib/postgresql/data
      - ./backend/prisma/init:/docker-entrypoint-initdb.d  # creates app role + extensions
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U tempora_owner -d tempora']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  tempora-pgdata:
```

`backend/prisma/init/01-init.sql` (run once on first container start):

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
-- Application role: NO superuser, NO BYPASSRLS. RLS applies.
CREATE ROLE tempora_app LOGIN PASSWORD 'app_devpassword';
GRANT CONNECT ON DATABASE tempora TO tempora_app;
GRANT USAGE ON SCHEMA public TO tempora_app;
-- Table grants are applied by the RLS migration after Prisma creates tables.
```

`DATABASE_URL` for migrations uses `tempora_owner`; the runtime app `DATABASE_URL` uses `tempora_app`.

### 10.2 `backend/tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": false,
    "baseUrl": ".",
    "paths": {
      "@tempora/shared": ["../packages/shared/src/index.ts"],
      "@tempora/shared/*": ["../packages/shared/src/*"]
    }
  },
  "include": ["src/**/*.ts", "prisma/seed.ts"],
  "exclude": ["node_modules", "dist"]
}
```

The `paths` alias lets dev (`ts-node`) read `shared` source directly; production `tsc` build + `tsconfig-paths`/a post-build rewrite resolves to the published package. (If alias resolution at runtime is undesirable, drop the alias and depend on the built `@tempora/shared` `dist` — slower dev loop but zero runtime path magic.)

### 10.3 Backend dev script

```jsonc
// backend/package.json (additions)
"scripts": {
  "dev": "nodemon",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/server.js",
  "prisma:migrate": "prisma migrate dev",
  "prisma:generate": "prisma generate",
  "db:seed": "ts-node prisma/seed.ts",
  "test": "vitest run"
}
```

```jsonc
// backend/nodemon.json
{
  "watch": ["src", "../packages/shared/src"],
  "ext": "ts,json,prisma",
  "ignore": ["dist", "**/*.test.ts"],
  "exec": "ts-node -r tsconfig-paths/register src/server.ts"
}
```

Watching `../packages/shared/src` means schema/type edits restart the backend without a separate build step. New backend deps to add: `@prisma/client`, `prisma`, `zod`, `jsonwebtoken`, `argon2`, `cookie-parser`, `tsconfig-paths`, `vitest`, `@tempora/shared`.

### 10.4 Environment variables

| Variable | Scope | Description |
|---|---|---|
| `DATABASE_URL` | backend (runtime) | `postgresql://tempora_app:...@localhost:5432/tempora` — RLS-enforced app role |
| `DIRECT_DATABASE_URL` | backend (migrations) | `postgresql://tempora_owner:...@localhost:5432/tempora` — owner role for `prisma migrate` |
| `PORT` | backend | HTTP listen port (e.g., `3000`) |
| `NODE_ENV` | backend | `development` \| `production` |
| `JWT_ACCESS_SECRET` | backend | HMAC secret for 15-min access tokens |
| `JWT_REFRESH_SECRET` | backend | HMAC secret for 7-day refresh tokens (separate key) |
| `JWT_ACCESS_TTL` | backend | e.g., `15m` |
| `JWT_REFRESH_TTL` | backend | e.g., `7d` |
| `REFRESH_COOKIE_NAME` | backend | name of httpOnly refresh cookie |
| `COOKIE_SECURE` | backend | `true` in prod (Secure flag) |
| `COOKIE_SAMESITE` | backend | `lax` (required for SSE cross-origin; `strict` blocks SSE reconnects from the SPA) |
| `CORS_ORIGIN` | backend | allowed SPA origin (e.g., `http://localhost:4200`) |
| `FIELD_ENCRYPTION_KEY` | backend | 32-byte key (base64) for special-category field encryption (AES-256-GCM) |
| `DB_OWNER_PASSWORD` | docker/compose | owner role password (dev) |
| `API_BASE_URL` | frontend | base URL for `ApiService` + SSE (e.g., `http://localhost:3000`) |

`config/env.ts` validates these with a Zod schema at boot and exports a typed, frozen `env` — the app fails fast on a missing/invalid variable rather than at first use.

---

## Design Validation Against Success Criteria

- **No type drift** — single Zod source in `@tempora/shared`, `z.infer` everywhere (§1, §4).
- **RLS proven / fail-closed** — transaction-local `set_config` + `FORCE ROW LEVEL SECURITY` + `current_setting(...,true)` NULL exclusion (§8).
- **Auth/blocklist** — short access + httpOnly refresh + `TokenBlocklist` checked on refresh; silent-refresh interceptor (§3.3, §5.4).
- **Immutability + audit** — INSERT-only grants + trigger on `time_entries`/`audit_logs`; audit written in-tx with the mutation (§7, §8.2).
- **Cuadrante publish + swaps** — `ShiftSchedule` status machine + `CambioTurno` + SSE events (§2, §9).
- **Org-specific rule blocking** — per-org `RuleSet` feeds the pure `RuleEngine`; `block` aborts with 422 (§6).
- **Special-category access logged** — every decrypt of `Absence.causeEncrypted` writes an `action: 'READ'` audit row (§7).

---

## Open Items for `sdd-tasks`

- Concrete Zod schema bodies (signatures listed in §4.2; implementation is task work).
- Per-rule arithmetic for overnight shifts and break deductions (§6 rules).
- PDF/XLSX exporter library choice (e.g., `pdfkit` + `exceljs`) — deferred to reporting tasks (P5).
- Seed data shape for local dev (`prisma/seed.ts`).
- Refresh-flow CSRF token mechanism details (double-submit vs header token).
