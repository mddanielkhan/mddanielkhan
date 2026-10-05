-- Re-applied after every migration by the migrate job (idempotent).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO peerlink_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO peerlink_app;
-- Append-only tables: the runtime role may only read and append.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM peerlink_app;
REVOKE UPDATE, TRUNCATE ON reputation_events FROM peerlink_app;
-- Drizzle's migration bookkeeping is owner-only.
REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM peerlink_app;
