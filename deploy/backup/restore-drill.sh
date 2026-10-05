#!/usr/bin/env bash
# Monthly restore drill — turns "we have backups" into "we can recover".
# Restores the newest backup into a SCRATCH database, verifies row counts and the
# audit hash chain, and prints the time it took (your real RTO).
#   AGE_KEY_FILE=~/.config/shikor/backup.key SCRATCH_URL=postgres://...@localhost/shikor_restore_test \
#   bash deploy/backup/restore-drill.sh /path/to/shikor-*.dump.age
set -euo pipefail
FILE="${1:?pass the .dump.age file to restore}"
: "${AGE_KEY_FILE:?}" "${SCRATCH_URL:?}"
case "$SCRATCH_URL" in *prod*|*/shikor) echo "Refusing: SCRATCH_URL looks like production"; exit 1;; esac
START=$(date +%s)
age -d -i "$AGE_KEY_FILE" "$FILE" | pg_restore --clean --if-exists --no-owner --dbname "$SCRATCH_URL"
psql "$SCRATCH_URL" -Atc "select 'users', count(*) from users union all select 'posts', count(*) from posts union all select 'audit_log', count(*) from audit_log"
DATABASE_URL="$SCRATCH_URL" npx tsx scripts/verify-audit-chain.ts
echo "restore drill OK in $(( $(date +%s) - START ))s — record this in the ops log"
