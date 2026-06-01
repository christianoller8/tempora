-- Run once on first container start via docker-entrypoint-initdb.d
-- Executed as the POSTGRES_USER (tempora_owner / superuser).

CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()

-- Application role: NO superuser, NO BYPASSRLS. RLS applies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tempora_app') THEN
    CREATE ROLE tempora_app LOGIN PASSWORD 'app_devpassword';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE tempora TO tempora_app;
GRANT USAGE ON SCHEMA public TO tempora_app;
-- Table-level grants are applied by the RLS migration after Prisma creates the tables.
