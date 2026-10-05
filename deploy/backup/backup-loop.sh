#!/bin/sh
# Nightly encrypted logical backup → off-site object storage, with retention.
# An untested backup is not a backup: run deploy/backup/restore-drill.sh monthly.
set -eu
apk add --no-cache age rclone >/dev/null 2>&1 || true
while true; do
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  OUT=/var/backups/peerlink/peerlink-$STAMP.dump.age
  if pg_dump --format=custom --no-owner --no-privileges | age -r "$AGE_RECIPIENT" > "$OUT"; then
    SIZE=$(wc -c < "$OUT")
    # A suspiciously small dump usually means the wrong database: fail loudly.
    if [ "$SIZE" -lt 2048 ]; then echo "{\"level\":\"error\",\"msg\":\"backup too small\",\"size\":$SIZE}"; else
      if [ -n "${RCLONE_REMOTE:-}" ]; then rclone copy "$OUT" "$RCLONE_REMOTE" && echo "{\"level\":\"info\",\"msg\":\"backup uploaded\",\"file\":\"$OUT\",\"size\":$SIZE}"; fi
    fi
  else
    echo "{\"level\":\"error\",\"msg\":\"pg_dump failed\"}"
  fi
  find /var/backups/peerlink -name '*.dump.age' -mtime +"${RETENTION_DAYS:-30}" -delete
  [ -n "${RCLONE_REMOTE:-}" ] && rclone delete --min-age "${RETENTION_DAYS:-30}d" "$RCLONE_REMOTE" || true
  sleep 86400
done
