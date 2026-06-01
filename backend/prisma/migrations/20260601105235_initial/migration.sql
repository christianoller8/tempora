-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('MEDICO', 'ENFERMERO', 'TCAE', 'FISIOTERAPEUTA', 'TERAPEUTA_OCUPACIONAL', 'PSICOLOGO', 'TRABAJADOR_SOCIAL', 'CELADOR', 'ADMINISTRATIVO', 'COCINERO', 'AUXILIAR_SERVICIOS');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('INDEFINIDO', 'TEMPORAL', 'INTERINIDAD', 'OBRA_Y_SERVICIO', 'TIEMPO_PARCIAL');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MANANA', 'TARDE', 'NOCHE', 'GUARDIA', 'RETEN', 'REFUERZO', 'LIBRANZA');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('VACACIONES', 'IT', 'PERMISO_RETRIBUIDO', 'AUSENCIA_INJUSTIFICADA', 'LACTANCIA', 'REDUCCION_JORNADA');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleViolation" AS ENUM ('MIN_REST_12H', 'MAX_DAILY_9H', 'MAX_ANNUAL_OT_80H', 'WEEKLY_REST_1_5_DAYS', 'CATEGORY_COVERAGE', 'SHIFT_OVERLAP');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'READ', 'APPROVE', 'REJECT', 'PUBLISH', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "cif" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "centerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "employeeId" UUID,
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_blocklist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jti" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nif" TEXT,
    "category" "EmployeeCategory" NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "contractedHoursPerWeek" DECIMAL(5,2) NOT NULL,
    "primaryCenterId" UUID NOT NULL,
    "workingCalendarId" UUID,
    "hireDate" DATE NOT NULL,
    "terminationDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_calendars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annualHours" DECIMAL(7,2) NOT NULL,
    "holidays" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "working_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "minRestHours" DECIMAL(4,2) NOT NULL DEFAULT 12.00,
    "maxDailyHours" DECIMAL(4,2) NOT NULL DEFAULT 9.00,
    "maxAnnualOvertime" DECIMAL(6,2) NOT NULL DEFAULT 80.00,
    "weeklyRestDays" DECIMAL(3,2) NOT NULL DEFAULT 1.50,
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "categoryRequirements" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotation_patterns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cycleLength" INTEGER NOT NULL,
    "cycle" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rotation_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "centerId" UUID NOT NULL,
    "departmentId" UUID,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "publishedBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "shiftTemplateId" UUID NOT NULL,
    "departmentId" UUID,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cambios_turno" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "requesterAssignmentId" UUID NOT NULL,
    "targetAssignmentId" UUID,
    "status" "SwapStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "approverId" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cambios_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "clockIn" TIMESTAMPTZ(6) NOT NULL,
    "clockOut" TIMESTAMPTZ(6),
    "status" "EntryStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'web',
    "capturedAtClient" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_corrections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "timeEntryId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "proposedClockIn" TIMESTAMPTZ(6),
    "proposedClockOut" TIMESTAMPTZ(6),
    "justification" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "time_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "causeEncrypted" BYTEA,
    "approverId" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "centers_organizationId_idx" ON "centers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "centers_organizationId_name_key" ON "centers"("organizationId", "name");

-- CreateIndex
CREATE INDEX "departments_organizationId_idx" ON "departments"("organizationId");

-- CreateIndex
CREATE INDEX "departments_organizationId_centerId_idx" ON "departments"("organizationId", "centerId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_centerId_name_key" ON "departments"("centerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_organizationId_role_idx" ON "users"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_organizationId_email_key" ON "users"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "token_blocklist_jti_key" ON "token_blocklist"("jti");

-- CreateIndex
CREATE INDEX "token_blocklist_expiresAt_idx" ON "token_blocklist"("expiresAt");

-- CreateIndex
CREATE INDEX "employees_organizationId_idx" ON "employees"("organizationId");

-- CreateIndex
CREATE INDEX "employees_organizationId_primaryCenterId_idx" ON "employees"("organizationId", "primaryCenterId");

-- CreateIndex
CREATE INDEX "employees_organizationId_category_idx" ON "employees"("organizationId", "category");

-- CreateIndex
CREATE INDEX "working_calendars_organizationId_idx" ON "working_calendars"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "working_calendars_organizationId_name_year_key" ON "working_calendars"("organizationId", "name", "year");

-- CreateIndex
CREATE INDEX "rule_sets_organizationId_idx" ON "rule_sets"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "rule_sets_organizationId_name_key" ON "rule_sets"("organizationId", "name");

-- CreateIndex
CREATE INDEX "shift_templates_organizationId_idx" ON "shift_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_organizationId_name_key" ON "shift_templates"("organizationId", "name");

-- CreateIndex
CREATE INDEX "rotation_patterns_organizationId_idx" ON "rotation_patterns"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "rotation_patterns_organizationId_name_key" ON "rotation_patterns"("organizationId", "name");

-- CreateIndex
CREATE INDEX "shift_schedules_organizationId_idx" ON "shift_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "shift_schedules_organizationId_centerId_status_idx" ON "shift_schedules"("organizationId", "centerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shift_schedules_organizationId_centerId_departmentId_year_m_key" ON "shift_schedules"("organizationId", "centerId", "departmentId", "year", "month");

-- CreateIndex
CREATE INDEX "shift_assignments_organizationId_idx" ON "shift_assignments"("organizationId");

-- CreateIndex
CREATE INDEX "shift_assignments_organizationId_scheduleId_idx" ON "shift_assignments"("organizationId", "scheduleId");

-- CreateIndex
CREATE INDEX "shift_assignments_organizationId_employeeId_date_idx" ON "shift_assignments"("organizationId", "employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_employeeId_date_shiftTemplateId_key" ON "shift_assignments"("employeeId", "date", "shiftTemplateId");

-- CreateIndex
CREATE INDEX "cambios_turno_organizationId_idx" ON "cambios_turno"("organizationId");

-- CreateIndex
CREATE INDEX "cambios_turno_organizationId_status_idx" ON "cambios_turno"("organizationId", "status");

-- CreateIndex
CREATE INDEX "time_entries_organizationId_idx" ON "time_entries"("organizationId");

-- CreateIndex
CREATE INDEX "time_entries_organizationId_employeeId_clockIn_idx" ON "time_entries"("organizationId", "employeeId", "clockIn");

-- CreateIndex
CREATE INDEX "time_entries_organizationId_status_idx" ON "time_entries"("organizationId", "status");

-- CreateIndex
CREATE INDEX "time_corrections_organizationId_idx" ON "time_corrections"("organizationId");

-- CreateIndex
CREATE INDEX "time_corrections_organizationId_timeEntryId_idx" ON "time_corrections"("organizationId", "timeEntryId");

-- CreateIndex
CREATE INDEX "time_corrections_organizationId_status_idx" ON "time_corrections"("organizationId", "status");

-- CreateIndex
CREATE INDEX "absences_organizationId_idx" ON "absences"("organizationId");

-- CreateIndex
CREATE INDEX "absences_organizationId_employeeId_startDate_idx" ON "absences"("organizationId", "employeeId", "startDate");

-- CreateIndex
CREATE INDEX "absences_organizationId_type_status_idx" ON "absences"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_entityType_entityId_idx" ON "audit_logs"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_action_createdAt_idx" ON "audit_logs"("organizationId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_actorUserId_createdAt_idx" ON "audit_logs"("organizationId", "actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "centers" ADD CONSTRAINT "centers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_primaryCenterId_fkey" FOREIGN KEY ("primaryCenterId") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_workingCalendarId_fkey" FOREIGN KEY ("workingCalendarId") REFERENCES "working_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_calendars" ADD CONSTRAINT "working_calendars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotation_patterns" ADD CONSTRAINT "rotation_patterns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "shift_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_requesterAssignmentId_fkey" FOREIGN KEY ("requesterAssignmentId") REFERENCES "shift_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_targetAssignmentId_fkey" FOREIGN KEY ("targetAssignmentId") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_corrections" ADD CONSTRAINT "time_corrections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_corrections" ADD CONSTRAINT "time_corrections_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
