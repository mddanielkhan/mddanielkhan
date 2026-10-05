# Setup — from your laptop to a production launch

This guide has three parts. Part A gets the app running on your computer in about 5 minutes. Part B deploys it to
production on a small VPS behind Cloudflare, for roughly $10–25 a month. Part C is the checklist to complete before
inviting real students.

---

## Part A — Local development

### A1. Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | **22.12+** (LTS, see `.nvmrc`) or 24+ | `node --version` |
| npm | 10+ | ships with Node |
| Docker | Desktop or Engine with Compose v2 | Recommended: runs PostgreSQL and Mailpit for you |
| PostgreSQL | **16+** | Only if you don't use Docker |
| Git | any recent | |

### A2. Quick start (about 5 minutes)

```bash
git clone <your repo> shikor && cd shikor
npm ci              # exact, locked dependencies
npm run setup       # configuration, database, demo data — one command
npm run dev         # http://localhost:3000
```

`npm run setup` is safe to run as often as you like. It:

1. **Checks prerequisites:** the Node version, and that `.env` is git-ignored (it stops if not).
2. **Creates `.env`** from `.env.example` with two fresh, independent 256-bit secrets, readable only by you
   (mode `600`). It never overwrites an existing `.env` or its secrets, and never prints them.
3. **Starts PostgreSQL and Mailpit** with Docker Compose, if Docker is running. A newly created `.env` then sends
   email to Mailpit.
4. **Waits for the database**, applies migrations, and **creates the demo community** once.
5. **Checks that existing data matches your keys:** if the database was seeded with a different `ENCRYPTION_KEY`,
   it stops and tells you how to fix it, instead of letting 2FA sign-in fail later.
6. **Prints what you need next:** URLs, demo accounts, and QR codes for the demo mentor's and moderator's 2FA.

| Flag | Use it when |
|---|---|
| `npm run setup -- --no-docker` | You run your own PostgreSQL. Set `DATABASE_URL` in `.env` first. |
| `npm run setup -- --no-seed` | You want an empty database (schema only). |
| `npm run setup -- --reset` | You want to wipe the **local** database and start over (refuses non-localhost databases). |

**Without Docker:** install PostgreSQL 16+, then create the databases and run setup:

```bash
createuser --pwprompt shikor          # password: shikor (or change DATABASE_URL in .env)
createdb -O shikor shikor && createdb -O shikor shikor_test && createdb -O shikor shikor_e2e
npm run setup -- --no-docker
```

### A3. Demo accounts

Every demo account uses the password `demo passphrase for local dev`.

| Email | Role | Sign-in |
|---|---|---|
| `student@shikor.local` | Student (Rafi) | Password only |
| `mentor@shikor.local` | Verified mentor (Nusrat) | Password + 2FA. Scan the QR code setup printed. |
| `admin@shikor.local` | Admin / moderator | Password + 2FA. Scan the QR code setup printed. |
| `helper@shikor.local` | Member (Tanvir) | Password only |

The other seeded people (other mentors, applicants and a scam account) exist to fill the community and moderation
queues. Their 2FA keys are random and never shown, so use the accounts above to sign in. Lost the QR codes? Run
`npm run setup -- --reset`.

### A4. Email and background jobs

- **Email:** with Docker, setup routes mail to **Mailpit** at <http://localhost:8025>. Without Docker,
  `EMAIL_TRANSPORT=console` prints each email, including verification links, in the `npm run dev` terminal.
- **Background jobs:** `JOBS_INLINE=true` (the development default) runs jobs immediately. To exercise the real
  worker, set it to `false` and run `npm run worker:dev` in a second terminal.

### A5. Everyday commands

| Command | What it does |
|---|---|
| `npm run setup` | Configure and prepare everything (idempotent) |
| `npm run doctor` | Check configuration, secrets, database, migrations, audit chain and email |
| `npm run dev` | Dev server with hot reload |
| `npm run check` | Lint + typecheck + unit tests (run before every commit) |
| `npm run test:integration` | Service tests against real Postgres (`shikor_test`) |
| `npm run test:coverage` | All tests + coverage gates on security-critical modules |
| `npm run build && npm run test:e2e` | Production build + Playwright browser tests (desktop + mobile) |
| `npm run db:generate -- --name <change>` | Create a migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run admin:create` | Bootstrap the first admin (prints a one-time password) |
| `npm run audit:verify` | Recompute the audit-log hash chain |

Every script reads `.env` the same way the app does, so the app, the worker and the scripts always share one
configuration.

### A6. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Docker not available` during setup | The Docker daemon isn't running. Start Docker Desktop, or use your own PostgreSQL with `--no-docker`. |
| `Could not connect to the database` | PostgreSQL isn't reachable at `DATABASE_URL`. With Docker run `docker compose up -d`; otherwise start your local server. |
| `port is already allocated` (5432) | Another PostgreSQL is running. Stop it, or use it with `--no-docker`. |
| `This database was set up with a different ENCRYPTION_KEY` | The data was created under other keys. Locally: `npm run setup -- --reset`. Real data: restore the original key. |
| `Invalid environment configuration` | A value in `.env` is malformed. The message names the key (never the value). `npm run doctor` explains it. |
| 2FA code rejected | Turn on automatic time in your phone settings, or wait for the next code: a code can be used only once. |
| `APP_SECRET/ENCRYPTION_KEY are not set` warning | There's no `.env`, so built-in development keys are in use. Run `npm run setup`. |

### A7. Project map

```
src/
  app/                 pages (server components) and api/**/route.ts handlers
  app/globals.css      design tokens (light + dark) and component classes
  components/          server-rendered UI: ui.tsx primitives, icons, header/footer, cards
  components/client/   the only client code: active nav links and menu behaviour
  proxy.ts             CSP nonce + CSRF seed (never an auth gate)
  worker.ts            background jobs + scheduled maintenance
  lib/
    http/route.ts      THE request pipeline — every route uses defineRoute()
    policy/policy.ts   THE permission model — deny by default
    auth/              passwords (Argon2id), sessions, TOTP, request helpers
    security/          crypto, CSRF, headers, IP extraction, rate limiting
    risk/              scam engine (normalise → signals → decision)
    trust/             trust levels, rating, reliability, reputation ledger, badges
    content/ booking/ mentors/ moderation/ reports/ account/   domain services
    audit/             hash-chained audit log
    db/                Drizzle schema + client
    cli/               shared helpers for scripts (.env loading, terminal output)
scripts/               setup, doctor, migrate, seed, create-admin, verify-audit-chain
drizzle/               SQL migrations (forward-only)
tests/unit|integration|e2e
deploy/                Dockerfile, production compose, Caddy, Postgres roles, backups, firewall
docs/                  blueprint, setup, operations, ADRs
```

### A8. Rules for changing code

1. **New route?** Use `defineRoute({ auth: …, schema: …, handler })`. The route-coverage test fails otherwise.
2. **New permission?** Add an `Action` to `policy.ts`, cover it in `tests/unit/security.test.ts`, and call
   `assertAllowed()` in the service too.
3. **New user-generated text field?** Validate it with `text(min,max)`, screen it with `evaluateRisk()`, and render it
   as text (never `dangerouslySetInnerHTML`, which lint blocks).
4. **New rule in the scam engine?** Add benign and scam examples to `tests/unit/risk-engine.test.ts` first, then bump
   `RULESET_VERSION`.
5. **Schema change?** Edit `schema.ts` → `npm run db:generate` → commit the SQL. Never edit an applied migration.
   Keep changes backwards-compatible (expand → migrate → contract).

---

## Part B — Production deployment (single VPS + Cloudflare)

Target: one VPS (2–4 vCPU, 4–8 GB RAM, e.g. Hetzner CPX21/CPX31 ≈ €8–15/month), Ubuntu 24.04, Docker, and the
Cloudflare free plan in front.

### B1. Accounts & domain (day 1)

1. Register the domain (and common typos and `.com.bd` variants, to defend against lookalike phishing).
2. Turn on **2FA everywhere**: registrar, Cloudflare, VPS provider, email provider, GitHub. Account takeover of these
   is the most common way small companies get breached.
3. Put the domain on Cloudflare: proxy (orange cloud) on, **SSL/TLS "Full (strict)"**, "Always Use HTTPS",
   HSTS (after you've confirmed HTTPS works), Bot Fight Mode on, and the managed WAF rules on.
4. Optional but recommended: create a **Turnstile** widget and add `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
   for bot protection on registration.

### B2. Email that actually arrives (and can't be spoofed)

Choose a transactional email provider with SMTP (Amazon SES, Postmark, Resend, Brevo, Zoho). In DNS, set:

- **SPF**, e.g. `v=spf1 include:<provider> -all`
- **DKIM**: the provider's CNAME/TXT records
- **DMARC**: start with `v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain`, then move to `p=reject` after 2 weeks of clean reports

DMARC also stops scammers sending "from" your domain to your students.

### B3. Server hardening

```bash
# as root on a fresh Ubuntu 24.04 VPS
adduser deploy && usermod -aG sudo deploy
# SSH: keys only, no root login
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl restart ssh
apt update && apt -y upgrade && apt -y install unattended-upgrades ufw curl git age
dpkg-reconfigure -plow unattended-upgrades
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
# Only Cloudflare may reach 80/443 (prevents bypassing the WAF and spoofing CF-Connecting-IP):
sudo ADMIN_IP=<your.ip.address> bash deploy/firewall-cloudflare.sh
```

### B4. Secrets file (never in git)

Create `/etc/shikor/shikor.env` (owned by root, mode `600`):

```bash
NODE_ENV=production
APP_URL=https://your-domain.example
APP_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32, different>
EMAIL_TRANSPORT=smtp
SMTP_URL=smtps://<user>:<password>@<smtp-host>:465
EMAIL_FROM="Shikor <no-reply@your-domain.example>"
TRUSTED_IP_HEADER=cf-connecting-ip
HIBP_CHECK=true
JOBS_INLINE=false
GRIEVANCE_OFFICER_NAME="<named person>"
GRIEVANCE_OFFICER_EMAIL=grievance@your-domain.example
SUPPORT_EMAIL=support@your-domain.example
SECURITY_EMAIL=security@your-domain.example
TURNSTILE_SITE_KEY=<optional>
TURNSTILE_SECRET_KEY=<optional>
# used by compose interpolation:
SITE_DOMAIN=your-domain.example
POSTGRES_SUPERUSER_PASSWORD=<long random>
OWNER_DB_PASSWORD=<long random>
APP_DB_PASSWORD=<long random>
BACKUP_AGE_RECIPIENT=<age public key, see B7>
BACKUP_RCLONE_REMOTE=<remote:bucket/path, see B7>
```

The app **refuses to start** if a secret is a placeholder, if the two secrets are equal, or if the URL isn't https.
It also refuses if email isn't SMTP, if inline jobs are on, or if the grievance contact or trusted IP header is
missing. This is deliberate.

### B5. Build the image and create the database roles

```bash
git clone <your repo> /opt/shikor && cd /opt/shikor
docker build -f deploy/Dockerfile -t shikor:$(git rev-parse --short HEAD) -t shikor:latest .

# Start Postgres alone, then create the least-privilege roles once:
docker compose -f deploy/docker-compose.prod.yml --env-file /etc/shikor/shikor.env up -d postgres
docker compose -f deploy/docker-compose.prod.yml --env-file /etc/shikor/shikor.env exec -T postgres \
  psql -U postgres -v owner_pw="'$OWNER_DB_PASSWORD'" -v app_pw="'$APP_DB_PASSWORD'" -f - < deploy/postgres/grants.sql
```

(Export the three passwords into your shell from the env file first, e.g. `set -a; . /etc/shikor/shikor.env; set +a`.)

### B6. Start everything

```bash
set -a; . /etc/shikor/shikor.env; set +a          # load the passwords into this shell
COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file /etc/shikor/shikor.env"
$COMPOSE up -d                                     # "migrate" runs first (as shikor_owner), then app + worker + caddy + backup
curl -fsS https://your-domain.example/api/health   # → {"status":"ok"}
```

Seed the topic list (no demo data in production) and create the first admin. Both scripts ship pre-built in the image
(`dist/*.mjs`) and run as the owner role:

```bash
OWNER_URL="postgres://shikor_owner:$OWNER_DB_PASSWORD@postgres:5432/shikor"
$COMPOSE run --rm -e DATABASE_URL="$OWNER_URL" app node dist/seed.mjs --topics-only
$COMPOSE run --rm -e DATABASE_URL="$OWNER_URL" -e ADMIN_EMAIL=you@your-domain.example -e ADMIN_USERNAME=founder app node dist/create-admin.mjs
$COMPOSE run --rm app node dist/verify-audit-chain.mjs   # → "audit chain intact"
$COMPOSE run --rm app node dist/doctor.mjs               # → "All checks passed"
```

`doctor` is read-only and never prints secret values. It fails if the app connects as a privileged database role,
if secrets are missing, if migrations are pending, if the audit chain is broken, or if the SMTP server rejects the
connection. Run it after every deploy.

Then log in, **change the printed one-time password, and enable 2FA** (Settings → Security). Staff powers stay locked
until 2FA is verified in the session. Promote further moderators from `/mod/users` (admin only).

### B7. Backups (do this before any real user signs up)

```bash
age-keygen -o backup.key        # keep backup.key OFFLINE (password manager + printed copy)
grep 'public key' backup.key    # → put this in BACKUP_AGE_RECIPIENT
# rclone remote for an S3-compatible bucket (Backblaze B2, Cloudflare R2, Wasabi…) with object lock if available:
rclone config                   # create the remote, then copy rclone.conf → deploy/backup/rclone.conf (chmod 600)
```

The `backup` service writes an encrypted `pg_dump` nightly, uploads it off-site, and keeps 30 days. **The first time,
and then every month,** run the restore drill against a scratch database:

```bash
AGE_KEY_FILE=backup.key SCRATCH_URL=postgres://...@localhost:5432/shikor_restore_test \
  bash deploy/backup/restore-drill.sh /path/to/shikor-YYYYMMDD.dump.age
```

It restores the backup, prints row counts, **verifies the audit hash chain** and reports how long the recovery took.

### B8. Monitoring (free tiers are enough)

- **Uptime:** an external check on `https://your-domain.example/api/health` every minute (UptimeRobot, BetterStack)
  that alerts your phone.
- **Logs:** `docker compose logs -f app worker`. Logs are JSON; ship them to Grafana Cloud or BetterStack free tiers if
  you want search and alerts. Alert on `"level":"error"`, `"AUDIT CHAIN BROKEN"`, `backup too small` and `pg_dump failed`.
- **Cost alerts** at your VPS and email providers. A runaway email loop costs money.

### B9. Deploying updates

```bash
cd /opt/shikor && git pull
docker build -f deploy/Dockerfile -t shikor:$(git rev-parse --short HEAD) -t shikor:latest .
docker compose -f deploy/docker-compose.prod.yml --env-file /etc/shikor/shikor.env up -d   # migrate runs first
curl -fsS https://your-domain.example/api/health
docker compose -f deploy/docker-compose.prod.yml --env-file /etc/shikor/shikor.env run --rm app node dist/doctor.mjs
```

Rollback: `docker tag shikor:<previous-sha> shikor:latest && docker compose ... up -d`. Migrations are forward-only and
backwards-compatible, so the previous image keeps working.

---

## Part C — Launch checklist (all must be ✅)

**Legal & people**
- [ ] Entity registered; advocate reviewed Terms, Privacy and Guidelines (Bangla + English) and the PDPA/CSA questions in BLUEPRINT §10
- [ ] Named Grievance Officer with a monitored inbox; support and security inboxes monitored
- [ ] At least 2 trained moderators with a P0/P1 rota (see OPERATIONS.md); escalation contacts written down
- [ ] 30–50 founding mentors verified, with 2FA enabled; 100+ seed posts; Safety page reviewed

**Security**
- [ ] Cloudflare Full (strict), WAF and bot protection on; origin firewall allows only Cloudflare (B3)
- [ ] `/etc/shikor/shikor.env` is mode 600; secrets generated fresh; never reused from staging
- [ ] 2FA on every infrastructure account; SSH keys only
- [ ] App runs as `shikor_app` (`docker compose exec postgres psql -U postgres -c "\du"`)
- [ ] `node dist/doctor.mjs` reports **All checks passed** on the production host
- [ ] `https://your-domain/.well-known/security.txt` correct; `SECURITY.md` email works
- [ ] Response headers checked (securityheaders.com shows A+); no CSP errors in the browser console
- [ ] CI green on the deployed commit (lint, typecheck, tests, coverage, build, E2E, audit)

**Data**
- [ ] Nightly backup uploaded off-site; restore drill passed and logged
- [ ] `npm run audit:verify` against production says "intact"
- [ ] Topics seeded; no demo accounts in production

**Email**
- [ ] SPF, DKIM, DMARC pass (send a test to <https://www.mail-tester.com>)
- [ ] Verification and reset emails arrive within a minute, not in spam
