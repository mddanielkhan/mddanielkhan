-- Re-applied after every migration by the migrate job (idempotent).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shikor_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shikor_app;
-- Append-only tables: the runtime role may only read and append.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM shikor_app;
REVOKE UPDATE, TRUNCATE ON reputation_events FROM shikor_app;
-- Drizzle's migration bookkeeping is owner-only.
REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM shikor_app;
