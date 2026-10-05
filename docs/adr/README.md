# Architecture Decision Records

Format: decision → why → rejected alternatives → review trigger. Accepted ADRs are not edited; they are superseded by
a new one. Decisions marked **(supersedes)** replace a choice in an earlier blueprint, as explained in
[BLUEPRINT §2](../BLUEPRINT.md#2-what-was-wrong-with-the-earlier-blueprints--verified-errata).

## ADR-001 — Modular monolith, one stateful service

**Decision.** One Next.js application plus one worker process from the same codebase. PostgreSQL is the only stateful
service.
**Why.** A solo founder can secure, back up and monitor one database. Transactions keep business changes, audit
entries and outgoing emails consistent (outbox pattern).
**Rejected.** Microservices (cost, security surface). Serverless (an in-memory limiter breaks, long jobs are awkward,
cost is unbounded).
**Review when.** More than 6 engineers, more than 100k MAU, or a module needs independent scaling.

## ADR-002 — Opaque server-side sessions (supersedes Pathshala's JWT)

**Decision.** 256-bit random cookie tokens, stored as SHA-256 in Postgres. The user row is re-read on every request.
Sessions rotate on login, on MFA step-up and on password change.
**Why.** Bans, suspensions and role changes apply instantly with no stale claims. A database leak yields no usable
cookies. It also enables the "your devices" page.
**Rejected.** JWT + tokenVersion (needs a DB read anyway and leaves a stale-claims window); PASETO (same revocation problem).

## ADR-003 — One request pipeline + one policy, enforced twice

**Decision.** Every route uses `defineRoute()`. Every permission lives in `policy.ts` (deny by default, fail closed),
and services call `assertAllowed()` again. A CI test fails the build if a route bypasses the pipeline.
**Why.** Broken access control is OWASP A01:2025. Central and tested beats scattered and hoped-for.
**Rejected.** Auth in middleware/proxy: Next.js shipped several proxy-bypass advisories in 2026.

## ADR-004 — PostgreSQL for queue, rate limits and search in Phase 1 (supersedes Shikor's Redis/BullMQ/MinIO stack)

**Decision.** `FOR UPDATE SKIP LOCKED` jobs, atomic UPSERT rate limits, `tsvector` + GIN full-text search
(`simple` config, which is safe for Bangla).
**Review triggers.** Rate-limit writes over 500/s or p95 over 20 ms → Redis. Search p95 over 400 ms or more than 2M
posts → Typesense/Meilisearch. Job backlog over 5 min sustained → move the worker to its own host. Each swap is behind
an existing interface.

## ADR-005 — Plain HTML forms → route handlers (no Server Actions)

**Decision.** Pages are server components. Mutations are `<form method="post">` to `/api/*` route handlers that
return 303 redirects with a status *code* (never free text).
**Why.** Works without JavaScript on low-end phones. Explicit HTTP is easy to rate-limit, test and audit. Several 2026
CVEs targeted Server Action endpoints. CSRF is handled uniformly.

## ADR-006 — Deterministic, explainable risk engine; holds rather than blocks

**Decision.** Intent-pattern signals + combinations + policy gates. Automatic rejection only for high-precision
combinations; everything ambiguous is **held for a human**. A benign corpus is part of CI.
**Why.** Explainable to moderators, appellants and regulators; no training data needed. Over-blocking harms the people
we protect (Shikor's engine blocked ordinary visa questions).
**Review when.** More than 2,000 labelled moderation decisions exist. Add an ML scorer in shadow mode, and only cut
over if it beats the rules at equal recall.

## ADR-007 — No uploads, no NID, adults only in Phase 1 (supersedes both blueprints' age handling)

**Decision.** Verification uses institutional email (only the domain is shown) and moderator review of public
evidence. 18+ by attestation; no birthdate is stored.
**Why.** PDPA 2026: children under 18 need verifiable guardian consent, and restricted personal data carries
localisation and breach duties. Data you don't hold can't leak.
**Review when.** Phase 1.5 guardian-consent design is approved by counsel.

## ADR-008 — No money in Phase 1; escrow only through a licensed PSP after a legal opinion (supersedes Pathshala's merchant-account escrow and Shikor's redeemable credits)

**Decision.** Sessions are free, and a database constraint enforces `price_bdt = 0`. No stored-value credits.
**Why.** Holding client funds or redeemable credits likely needs Bangladesh Bank licensing. "Free" also removes the
scammer's script.

## ADR-009 — Single VPS + Cloudflare + Caddy + Docker Compose

**Decision.** ~$10–25/month. Origin firewalled to Cloudflare ranges. Least-privilege DB roles. Encrypted off-site
backups with a monthly restore drill.
**Review when.** CPU over 70 % sustained, p95 over 500 ms, more than 25k MAU, or an uptime-clause B2B contract → read
replica / managed Postgres.

## ADR-010 — Web-first PWA, Bangla-ready, no native app

**Decision.** Server-rendered responsive web, manifest for install, Bangla UI chrome and font stack.
**Why.** SEO is the main acquisition channel. No app-store gatekeeping. One codebase. Instant security fixes.
**Review when.** More than 20k DAU, or a capability that needs native APIs is proven necessary.
