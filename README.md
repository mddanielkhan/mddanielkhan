# Shikor (শিকড়)

**A verification-first community and mentorship platform for students in Bangladesh.** Students ask about studies,
admissions, scholarships, higher study abroad and careers. Verified mentors give free sessions. Opportunities are
checked against official sources. Trust is earned, inspectable and never for sale.

> 🔒 **Golden rule:** nobody on Shikor may ask anyone for money. Sessions are free.

This repository is the complete, working **Phase 1**. It is the improved and verified successor to the earlier
"Pathshala" and "Shikor" blueprints; see [what was wrong with them and what changed](docs/BLUEPRINT.md#2-what-was-wrong-with-the-earlier-blueprints--verified-errata).

| | |
|---|---|
| Stack | Next.js 16.3.8 · React 19 · TypeScript (strict) · PostgreSQL 16+ · Drizzle ORM · Tailwind CSS 4 |
| Size | 46 pages · 57 API routes (all through one security pipeline) · 30 tables · background worker |
| Tests | 235 unit + integration (real Postgres) · 11 Playwright E2E (production build, desktop + mobile) · coverage gates |
| Security | Argon2id · opaque sessions · TOTP 2FA (mandatory for mentors and staff) · nonce CSP · signed CSRF · central deny-by-default policy · hash-chained audit log · least-privilege DB roles |
| Runs on | One small VPS behind Cloudflare (~$10–25/month), Docker Compose, Caddy |

## Read this first

| If you want to… | Read |
|---|---|
| Understand the product, the research and every decision | **[docs/BLUEPRINT.md](docs/BLUEPRINT.md)** |
| Run it locally, then deploy to production | **[docs/SETUP.md](docs/SETUP.md)** |
| Run moderation and handle incidents | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| See why the architecture is the way it is | [docs/adr/README.md](docs/adr/README.md) |
| Report a vulnerability | [SECURITY.md](SECURITY.md) |

## Quick start

```bash
npm ci
cp .env.example .env          # then set APP_SECRET and ENCRYPTION_KEY: openssl rand -hex 32 (twice)
docker compose up -d          # PostgreSQL + Mailpit
npm run db:migrate && npm run db:seed
npm run dev                   # http://localhost:3000 — demo logins are printed by the seed
```

Quality gates (the same ones CI runs):

```bash
npm run lint && npm run typecheck
npm run test:coverage         # unit + integration with coverage thresholds
npm run build && npm run test:e2e
```

## What's inside

- **Community:** questions with accepted answers, discussions, guides that must cite official sources, success stories,
  "helpful" votes, Bangla-safe full-text search, ten controlled topics.
- **Opportunities:** structured posts (organisation, official https link, fee disclosure, deadline), moderator
  **✓ verification**, and a subscribable deadline calendar (`/opportunities/calendar.ics`).
- **Verified mentors:** applications reviewed by hand, public scope-of-advice and conflict-of-interest statements,
  mandatory 2FA, badges with public credential pages (`/v/{id}`), and merit-only ranking with a "new mentors" section.
- **Free sessions:** request with prepared questions → mentor accepts a proposed slot → private Jitsi room → both
  confirm → completion-gated, anonymous, three-axis feedback. Capacity limits, reminders and disputes are included.
- **Trust & reputation:** behavioural trust levels (TL0–TL4), an idempotent reputation ledger by topic, shrunk ratings,
  reliability, and badges as facts.
- **Safety:** an explainable scam engine for English, Bangla and Banglish (tested on both benign and scam corpora),
  holds rather than blocks, weighted community reports, priority lanes, a strike ladder, appeals to a *different*
  moderator, a public notice-and-action form, a live transparency report, kill switches, crisis support routing.
- **Privacy (PDPA 2026):** adults only in this phase, minimal data (no NID, birthdate or phone), data export, real
  deletion, IPs stored only as keyed hashes for 90 days.

## Repository layout

```
src/app            pages + api/**/route.ts        src/lib/http/route.ts   the request pipeline
src/lib/policy     the permission model           src/lib/risk            the scam engine
src/lib/trust      trust, ratings, reputation     src/lib/audit           hash-chained audit log
drizzle/           SQL migrations                 deploy/                 Docker, Caddy, Postgres roles, backups
tests/             unit · integration · e2e       docs/                   blueprint · setup · operations · ADRs
```

## Status & next steps

Phase 1 is feature-complete and tested. Before public launch, complete the
[launch checklist](docs/SETUP.md#part-c--launch-checklist-all-must-be-): legal review, moderators, founding mentors,
email DNS, backups. The roadmap (guardian-consented under-18 accounts, full Bangla UI, passkeys, then licensed escrow
for paid sessions) is in [BLUEPRINT §13](docs/BLUEPRINT.md#13-roadmap-with-phase-gates).
