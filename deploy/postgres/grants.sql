-- ═══════════════════════════════════════════════════════════════════════════
-- Least-privilege database roles (run ONCE as a superuser, before first deploy).
--
--   peerlink_owner : owns the schema, runs migrations. Used only by the migrate job.
--   peerlink_app   : runtime role for the web app and worker. DML only — no DDL,
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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'peerlink_owner') THEN
    CREATE ROLE peerlink_owner LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'peerlink_app') THEN
    CREATE ROLE peerlink_app LOGIN;
  END IF;
END $$;

ALTER ROLE peerlink_owner PASSWORD :owner_pw;
ALTER ROLE peerlink_app PASSWORD :app_pw;
ALTER ROLE peerlink_app SET statement_timeout = '15s';
ALTER ROLE peerlink_app SET idle_in_transaction_session_timeout = '30s';

SELECT 'CREATE DATABASE peerlink OWNER peerlink_owner'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'peerlink')\gexec

\connect peerlink
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO peerlink_owner;
GRANT USAGE ON SCHEMA public TO peerlink_app;
