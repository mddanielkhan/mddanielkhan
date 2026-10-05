#!/usr/bin/env bash
# Allow HTTP(S) to this origin ONLY from Cloudflare, plus SSH from your admin IP.
# Without this, attackers can bypass Cloudflare's WAF and spoof CF-Connecting-IP
# (which our rate limiting trusts). Re-run monthly: Cloudflare publishes its ranges.
#   sudo ADMIN_IP=203.0.113.10 bash deploy/firewall-cloudflare.sh
set -euo pipefail
: "${ADMIN_IP:?Set ADMIN_IP to the address you SSH from}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$ADMIN_IP" to any port 22 proto tcp
for range in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  ufw allow from "$range" to any port 80,443 proto tcp
done
ufw --force enable
ufw status verbose
