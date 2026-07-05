-- ============================================================================
--  Least-privilege database role for Atlas.
--
--  By default docker-compose runs the app as the `atlas` role, which (being the
--  POSTGRES_USER) is a cluster SUPERUSER. This script creates a separate,
--  non-superuser login for the application to connect as, so a stolen app
--  credential can't touch other databases, roles, or cluster settings.
--
--  It intentionally KEEPS create/DDL rights on the `public` schema, because the
--  app applies EF Core migrations on startup (it needs to create/alter its own
--  tables). For an even tighter posture, run migrations separately as a
--  privileged role and grant the runtime role only DML — see the note at the end.
--
--  Run as the superuser, then point the app's connection string at atlas_app:
--    docker compose exec db psql -U atlas -d atlas -f /path/to/this.sql
--    ConnectionStrings__Postgres = Host=db;...;Username=atlas_app;Password=<strong>
-- ============================================================================

-- 1. A non-privileged login role (change the password / use a secret).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

-- 2. Connect + work within this database's public schema only.
GRANT CONNECT ON DATABASE atlas TO atlas_app;
GRANT USAGE, CREATE ON SCHEMA public TO atlas_app;

-- 3. Full DML on existing objects (covers an already-migrated database).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO atlas_app;
GRANT USAGE, SELECT, UPDATE          ON ALL SEQUENCES IN SCHEMA public TO atlas_app;

-- 4. And on everything the app creates later (so migrations keep working).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO atlas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO atlas_app;

-- ----------------------------------------------------------------------------
--  Tighter alternative (optional): if you run migrations out-of-band as the
--  superuser (or a dedicated owner role) rather than on app startup, drop
--  CREATE from step 2 so the runtime role can only read/write rows, never
--  change the schema:
--    REVOKE CREATE ON SCHEMA public FROM atlas_app;
--  (Do NOT do this while the app still migrates on boot — startup would fail.)
-- ----------------------------------------------------------------------------
