-- Additive enum extension (DB-level Prisma enum "AbsenceType").
-- Postgres requires ADD VALUE outside a transaction in older versions; Prisma
-- migrate runs these idempotently. IF NOT EXISTS guards re-runs.
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'ASUNTOS_PROPIOS';
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'PERMISO_NO_RETRIBUIDO';
ALTER TYPE "AbsenceType" ADD VALUE IF NOT EXISTS 'MATERNIDAD_PATERNIDAD';

-- Additive nullable column. No existing rows modified.
ALTER TABLE "absences" ADD COLUMN IF NOT EXISTS "decisionComment" TEXT;
