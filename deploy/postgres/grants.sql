-- ═══════════════════════════════════════════════════════════════════════════
-- Least-privilege database roles (run ONCE as a superuser, before first deploy).
--
--   shikor_owner : owns the schema, runs migrations. Used only by the migrate job.
--   shikor_app   : runtime role for the web app and worker. DML only — no DDL,
--                  and NO UPDATE/DELETE/TRUNCATE on the audit log. Because it is
--                  not the table owner it also cannot disable the append-only
--                  triggers. A compromised web tier therefore cannot rewrite history.
--
-- Usage:
--   psql "$ADMIN_URL" -v owner_pw="'...'" -v app_pw="'...'" -f deploy/postgres/grants.sql
-- Then re-run the GRANT section after every migration (the migrate job does this).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shikor_owner') THEN
    CREATE ROLE shikor_owner LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shikor_app') THEN
    CREATE ROLE shikor_app LOGIN;
  END IF;
END $$;

ALTER ROLE shikor_owner PASSWORD :owner_pw;
ALTER ROLE shikor_app PASSWORD :app_pw;
ALTER ROLE shikor_app SET statement_timeout = '15s';
ALTER ROLE shikor_app SET idle_in_transaction_session_timeout = '30s';

SELECT 'CREATE DATABASE shikor OWNER shikor_owner'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'shikor')\gexec

\connect shikor
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO shikor_owner;
GRANT USAGE ON SCHEMA public TO shikor_app;
