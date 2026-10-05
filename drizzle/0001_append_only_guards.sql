-- Append-only guards (defence in depth, independent of DB role grants).
-- The audit log and the reputation ledger must never be rewritten. Corrections
-- are made with new, reversing rows — never by UPDATE/DELETE.
CREATE OR REPLACE FUNCTION peerlink_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only (% rejected)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION peerlink_reject_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION peerlink_reject_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reputation_events_append_only ON reputation_events;
--> statement-breakpoint
CREATE TRIGGER reputation_events_append_only BEFORE UPDATE ON reputation_events
  FOR EACH ROW EXECUTE FUNCTION peerlink_reject_mutation();
