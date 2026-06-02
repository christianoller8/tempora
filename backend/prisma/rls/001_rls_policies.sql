-- 001_rls_policies.sql
-- Applied after prisma migrate dev creates the tables.
-- Idempotent: safe to re-run.
--
-- Roles:
--   tempora_owner  superuser / migration role (BYPASSRLS)
--   tempora_app    application runtime role   (RLS enforced, no BYPASSRLS)
--
-- Note: Prisma preserves camelCase column names — use "organizationId", not organization_id.

-- ─────────────────────────────────────────────────────────────────
-- 1. TABLE GRANTS
-- ─────────────────────────────────────────────────────────────────

-- Organization root (orgs created by owner; app reads and updates its own)
GRANT SELECT, INSERT, UPDATE         ON organizations     TO tempora_app;

-- Org tree
GRANT SELECT, INSERT, UPDATE, DELETE ON centers           TO tempora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON departments       TO tempora_app;

-- IAM (users soft-deactivated via isActive; token_blocklist allows DELETE for expiry cleanup)
GRANT SELECT, INSERT, UPDATE         ON users             TO tempora_app;
GRANT SELECT, INSERT, DELETE         ON token_blocklist   TO tempora_app;

-- Workforce (soft-deactivated via isActive / terminationDate; no hard delete)
GRANT SELECT, INSERT, UPDATE         ON employees         TO tempora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON working_calendars TO tempora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON rule_sets         TO tempora_app;

-- Shifts
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_templates   TO tempora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON rotation_patterns TO tempora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_schedules   TO tempora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_assignments TO tempora_app;
GRANT SELECT, INSERT, UPDATE         ON cambios_turno     TO tempora_app;

-- Time tracking
-- time_entries: UPDATE granted; trigger in 002 enforces OPEN→CLOSED only.
GRANT SELECT, INSERT, UPDATE         ON time_entries      TO tempora_app;
GRANT SELECT, INSERT, UPDATE         ON time_corrections  TO tempora_app;

-- Absences
GRANT SELECT, INSERT, UPDATE         ON absences          TO tempora_app;

-- Audit log: append-only — INSERT + SELECT only, no UPDATE/DELETE ever.
GRANT SELECT, INSERT                 ON audit_logs        TO tempora_app;

-- Notifications
GRANT SELECT, INSERT, UPDATE         ON notifications     TO tempora_app;

-- ─────────────────────────────────────────────────────────────────
-- 2. ROW-LEVEL SECURITY — tenant isolation
-- ─────────────────────────────────────────────────────────────────
-- current_setting('app.current_org', true) returns NULL when the session
-- parameter is not set. A NULL comparison is NULL → row excluded.
-- Fail-closed: no tenant context = zero rows visible / writable.
--
-- Idempotent pattern: DROP POLICY IF EXISTS + CREATE POLICY.

-- organizations (id IS the tenant root — no organizationId column)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING      ("id" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("id" = current_setting('app.current_org', true)::uuid);

-- centers
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON centers;
CREATE POLICY tenant_isolation ON centers
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON departments;
CREATE POLICY tenant_isolation ON departments
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON employees;
CREATE POLICY tenant_isolation ON employees
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- working_calendars
ALTER TABLE working_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_calendars FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON working_calendars;
CREATE POLICY tenant_isolation ON working_calendars
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- rule_sets
ALTER TABLE rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_sets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rule_sets;
CREATE POLICY tenant_isolation ON rule_sets
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- shift_templates
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shift_templates;
CREATE POLICY tenant_isolation ON shift_templates
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- rotation_patterns
ALTER TABLE rotation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_patterns FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rotation_patterns;
CREATE POLICY tenant_isolation ON rotation_patterns
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- shift_schedules
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_schedules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shift_schedules;
CREATE POLICY tenant_isolation ON shift_schedules
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- shift_assignments
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shift_assignments;
CREATE POLICY tenant_isolation ON shift_assignments
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- cambios_turno
ALTER TABLE cambios_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE cambios_turno FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON cambios_turno;
CREATE POLICY tenant_isolation ON cambios_turno
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON time_entries;
CREATE POLICY tenant_isolation ON time_entries
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- time_corrections
ALTER TABLE time_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_corrections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON time_corrections;
CREATE POLICY tenant_isolation ON time_corrections
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- absences
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON absences;
CREATE POLICY tenant_isolation ON absences
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  USING      ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- ─────────────────────────────────────────────────────────────────
-- 3. SUPER-ADMIN BYPASS
-- ─────────────────────────────────────────────────────────────────
-- tempora_owner is a superuser (implicit BYPASSRLS) but we make it explicit.
-- Application requests NEVER connect as tempora_owner.
ALTER ROLE tempora_owner BYPASSRLS;
