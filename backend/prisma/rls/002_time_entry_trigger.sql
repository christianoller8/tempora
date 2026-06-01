-- 002_time_entry_trigger.sql
-- Enforces append-only semantics on time_entries at the database level.
--
-- Permitted operations:
--   INSERT              clock-in (any new entry)
--   UPDATE OPEN→CLOSED  clock-out: sets "clockOut" + status = 'CLOSED'
--
-- Forbidden:
--   DELETE                                         always rejected
--   UPDATE on a closed entry                       always rejected
--   UPDATE that mutates identity fields            always rejected
--   UPDATE that does not produce a closed entry    always rejected
--
-- Any correction after closure must go through time_corrections.
-- Idempotent: safe to re-run (CREATE OR REPLACE FUNCTION + CREATE OR REPLACE TRIGGER).

CREATE OR REPLACE FUNCTION enforce_timeentry_immutability()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- DELETE is never allowed.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'time_entries are append-only: DELETE is not allowed';
  END IF;

  -- From here TG_OP = 'UPDATE' (INSERT is not in the trigger definition).

  -- Reject if the entry is already closed.
  IF OLD."clockOut" IS NOT NULL OR OLD.status <> 'OPEN' THEN
    RAISE EXCEPTION
      'time_entries: entry % is already closed; no further updates are allowed',
      OLD.id;
  END IF;

  -- Reject mutations to identity / immutable fields.
  IF NEW."clockIn"        <> OLD."clockIn"        OR
     NEW."employeeId"     <> OLD."employeeId"      OR
     NEW."organizationId" <> OLD."organizationId"  OR
     NEW.source           <> OLD.source            OR
     NEW."createdAt"      <> OLD."createdAt" THEN
    RAISE EXCEPTION
      'time_entries: immutable fields (clockIn, employeeId, organizationId, source, createdAt) cannot be changed';
  END IF;

  -- The only valid outcome is the OPEN → CLOSED clock-out transition.
  IF NEW."clockOut" IS NULL OR NEW.status <> 'CLOSED' THEN
    RAISE EXCEPTION
      'time_entries: UPDATE must set clockOut and transition status to CLOSED';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_timeentry_immutable
  BEFORE UPDATE OR DELETE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_timeentry_immutability();
