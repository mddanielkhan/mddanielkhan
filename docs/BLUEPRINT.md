# PeerLink — Consolidated Blueprint v3

### The improved, verified version of the Pathshala and Shikor blueprints

> **Naming.** PeerLink is the product. "Pathshala" and "Shikor" always mean the two earlier blueprint documents this
> one audits and replaces (§2).

**Status:** Phase 1 built, tested, deployable · **Date:** 5 October 2026 · **Market:** Bangladesh first (web/PWA, Bangla + English)

> **Not legal advice.** Bangladesh's digital-law framework changed repeatedly in 2024–2026. §10 lists exactly what a licensed
> Bangladeshi advocate must confirm in writing before public launch.

---

## Contents

1. [Executive summary](#1-executive-summary)
2. [What was wrong with the earlier blueprints — verified errata](#2-what-was-wrong-with-the-earlier-blueprints--verified-errata)
3. [Market research & gap analysis (2026 update)](#3-market-research--gap-analysis-2026-update)
4. [The improved concept](#4-the-improved-concept)
5. [Product specification (Phase 1, as built)](#5-product-specification-phase-1-as-built)
6. [Trust & reputation system](#6-trust--reputation-system)
7. [Security architecture](#7-security-architecture)
8. [Trust & safety: anti-scam, moderation, wellbeing](#8-trust--safety-anti-scam-moderation-wellbeing)
9. [Architecture, stack & data model](#9-architecture-stack--data-model)
10. [Legal & compliance (Bangladesh)](#10-legal--compliance-bangladesh)
11. [Monetisation — sequenced, with hard constraints](#11-monetisation--sequenced-with-hard-constraints)
12. [Go-to-market & cold start](#12-go-to-market--cold-start)
13. [Roadmap with phase gates](#13-roadmap-with-phase-gates)
14. [Risk register](#14-risk-register)
15. [Known limitations (honest list)](#15-known-limitations-honest-list)
16. [Sources](#16-sources)

---

## 1. Executive summary

**Your idea:** a web platform where students open profiles and discuss studies, opportunities, careers and higher study.
People can open profiles as experts, others can book sessions or ask for informal advice, and helpers earn rankings
and trust badges from feedback. Posts and opportunities are allowed; scams are not. It should be secure, user-friendly
and professional, and built to last.

**What exists now:** a working Phase-1 product in this repository:

| | |
|---|---|
| Application | Next.js 16.3.8 (latest security-patched release) + PostgreSQL + Drizzle; 46 pages, 57 API routes, a background worker |
| Verification | **235 unit + integration tests** (real PostgreSQL), **11 browser end-to-end tests** (Playwright, production build, desktop + mobile), coverage gates on security-critical modules, lint + strict typecheck clean, `npm audit` (production) clean |
| Deployment | Docker image, Docker Compose for a single VPS behind Cloudflare, Caddy TLS, least-privilege DB roles, encrypted off-site backups + restore drill, GitHub Actions CI + CodeQL + Dependabot |
| Documentation | This blueprint, [SETUP.md](SETUP.md) (start → production), [OPERATIONS.md](OPERATIONS.md) (moderation SOP, incident runbooks), [ADRs](adr/README.md) |

**The positioning in one line:** *the place students can trust.* Every trust signal is either a **verified fact**
(checked by a person, with a public credential page) or an **earned record** (computed from things that actually happened).
Nobody may ask anyone for money. Phase 1 is free.

**The three decisions that matter most**

1. **Launch narrow, seed the hard side first.** Lead with higher study abroad, scholarships and admissions. Recruit
   30–50 founding mentors by hand *before* inviting students. Cold start kills two-sided platforms, not technology.
2. **No money in Phase 1.** Introduce paid sessions only through a licensed payment provider's escrow, after a written
   legal opinion. The platform never holds client money.
3. **Adults only at launch.** Under Bangladesh's Personal Data Protection Act 2026, anyone under 18 is a child and needs
   verifiable guardian consent. Build that properly in Phase 1.5; don't improvise it.

---

## 2. What was wrong with the earlier blueprints — verified errata

I audited both documents you provided. For the Shikor blueprint I also extracted all 87 files from the single-file edition and ran
them. Everything below was **reproduced or checked in this session**, not assumed. Each finding has a fix in this
repository.

### 2.1 Shikor ("Complete Final Blueprint", 87 files)

| # | Finding | Evidence | Fix in v3 |
|---|---|---|---|
| S1 | **The package does not install.** `@vitest/coverage-v8@^3.2.4` cannot co-exist with `vitest@^5.0.3` → `npm install` fails with `ERESOLVE`. | Ran `npm install` on the extracted `app/` | Every dependency is pinned to an exact version and verified to install with `npm ci`; CI fails on peer conflicts. |
| S2 | **"`tsc --noEmit` clean" is false.** `validation/schemas.ts:228` uses Zod 3's `errorMap` option with Zod 4, where it doesn't exist. | `tsc` error TS2769 | Strict typecheck (incl. `noUncheckedIndexedAccess`) is a CI gate. |
| S3 | **The scam filter hard-blocks ordinary student questions with a strike.** "How much bank statement do I need to show for a German student visa?", "Can I submit a scanned copy of my HSC certificate?" and "Is it okay to use a proxy server…?" → `block` + `hardBlock`. Cause: normalisation maps English words (`copy`, `bank`, `statement`, `proxy`, `fake`, `job`) onto Bangla scam keywords, and rules block on single words. | Ran the 3 sentences through its `evaluateRules` | Normalisation removes **obfuscation only**, never meaning. Rules match **intent** (offer/request + object). There are no single-keyword blocks. A 40-sentence benign corpus, including those exact sentences, must produce **zero holds** (CI test). |
| S4 | **No application.** There are no pages, no routes, no database queries and no UI. "Reference implementation of the queue" points to a folder containing only `normalise.ts`. | File listing | 46 pages, 57 routes and a worker, all working end to end. |
| S5 | **Password minimum 12** is below NIST SP 800-63B-4 (Aug 2025), which **requires 15 characters for single-factor passwords**. | `auth/password.ts` | 15-character minimum, passphrase guidance, blocklist, optional breached-password check. |
| S6 | **30-minute idle timeout for every student** would log people out mid-answer. Argon2 at 64 MiB/t=3 with no concurrency limit is a memory-exhaustion risk on a 4 GB VPS. | `auth/sessions.ts` | Members: 14-day idle / 30-day absolute. Staff: 30-minute idle / 12-hour absolute + mandatory 2FA. Argon2id at OWASP's 19 MiB/t=2 with a 4-slot concurrency gate. |
| S7 | **16–17-year-olds "self-consent".** This conflicts with PDPA 2026: a child is <18 and needs parent/guardian consent. The 13–15 tier adds a safeguarding burden a solo founder can't staff. | PDPA 2026 summaries (§16) | Phase 1 is 18+, using an attestation (no birthdate stored). Guardian-consented restricted accounts are planned for Phase 1.5 after counsel defines "verifiable". |
| S8 | **"Contribution Credits redeemable for payout"** is stored value, i.e. e-money-like. It would need payment-services licensing in Bangladesh. | Concept §2 | Credits removed. Reputation is non-monetary and non-transferable, and can never be bought or redeemed. |
| S9 | **Internal contradiction:** the Expert badge requires Expert Score ≥ 70 + 5 validated answers + sessions, yet the go-to-market plan launches with 50–80 "verified" mentors. They couldn't show a badge on day one. | Trust doc §3.2 vs GTM | **Verified** (a fact a moderator checked, available on day one) is separate from **earned** (rank computed from activity). |
| S10 | **Phase-1 infrastructure contradicts its own "minimum moving parts" principle.** Redis, BullMQ, MinIO, Prometheus, Grafana, Loki, GlitchTip and Plausible means 8 services for a solo founder. | ADR-005/009 | Phase 1 runs on **Postgres only**: sessions, rate limits, job queue and full-text search. Redis etc. are deferred behind measured triggers (ADR-004). |
| S11 | **The hash-chained audit log and the IP-retention purge conflict.** Purging IP columns from chained rows breaks the chain. | Design | IP hashes live in a separate `audit_ip` table that is purged after 90 days; the chained table is untouched. |
| S12 | **ID-document uploads (NID, selfies) in V1/V2** create the highest-liability personal data, plus data-localisation duties for "restricted" data. | Verification doc | **No file uploads in Phase 1.** Verification uses institutional email (only the domain is shown) and manual review of public evidence links. |
| S13 | **Expert Score is normalised by the topic's 95th percentile.** With few experts this is unstable and can be gamed by one outlier. | Formula | Uses a topic reputation ledger with a "Top helper" cut (top 5 %, minimum 30 points, max 10 people) recomputed daily. |

### 2.2 Pathshala ("Platform Blueprint")

| # | Finding | Fix in v3 |
|---|---|---|
| P1 | The referenced `pathshala/` codebase and its "53-assertion smoke test" were not included, so nothing could be verified. | Full codebase with 246 automated tests that run in CI. |
| P2 | §9.1 prices sessions in **₺ (Turkish lira)** instead of **৳ (taka)**. | — |
| P3 | **JWT + `tokenVersion`** needs a database read on every request anyway (so no stateless benefit), and role or trust changes inside the token go stale. | Opaque server-side sessions: SHA-256-hashed tokens, revoked instantly, user row re-read on every request. |
| P4 | **In-memory rate limiter.** It stops working with a second instance, on restart, or on serverless (Vercel was the recommended host). | Atomic PostgreSQL rate limiter. It's Redis-shaped, so swapping it later changes no call sites. |
| P5 | **CSP with `'unsafe-inline'` scripts**, deferred "until feature work stabilises". | Per-request nonce + `'strict-dynamic'` from day one. E2E tests fail on any CSP violation (they caught an inline-style bug during this build). |
| P6 | **Phase-2 escrow "held in the platform merchant account".** Holding client money is the activity most likely to need a licence. | Escrow only through a licensed provider's split-settlement, and only after a written legal opinion (ADR-008). |
| P7 | **No age policy at all** (PDPA 2026 children's data). | 18+ gate (S7). |
| P8 | **In-person sessions allowed** in Phase 1, i.e. strangers meeting physically. | Online only. Meeting links are restricted to known video providers (anti-phishing), with a private Jitsi room by default. |
| P9 | **Mentor-only completion confirmation** lets a mentor farm fake sessions and reviews. | Two-sided confirmation: one side confirming with no dispute in 72 h completes it; conflicting reports go to a human. |
| P10 | The OWASP Top 10 is described with 2021 categories (SSRF separate, "Identification & Authentication Failures"). | Mapped to the final **OWASP Top 10:2025** (§7.1). |
| P11 | Password minimum of 10 characters. | 15 characters (NIST SP 800-63B-4). |
| P12 | A "daily rotating salt" for IP hashes prevents the cross-day correlation the same paragraph claims to enable. | Keyed HMAC (HKDF subkey) with 90-day retention. Correlation works inside the window, and the hashes are useless outside it. |
| P13 | Reviews show reviewer identity (unspecified), which invites retaliation against students. | Public reviews show "Verified session · date", never the student's name. |

### 2.3 Gaps in both

- **The 2026 Next.js security advisories** (May, July and September releases): several **middleware/proxy authorisation
  bypasses** and Server-Action DoS issues. Both designs gated authentication in middleware. In v3 the proxy only sets
  headers; every page and route authorises itself, and services check again (defence in depth).
- **Real Bangladeshi competitors were missing**: MentorMind, AbroadMates, Qunnix and Mentors' (consultancy). See §3.
- **No benign-content test corpus.** A filter tested only on scams will over-block; v3 tests both directions.
- **No guard that every route is protected.** v3 has a build-failing route-coverage test.

---

## 3. Market research & gap analysis (2026 update)

### 3.1 The problem is real and getting worse

- **Fraud keeps escalating.** In July 2026 the CID arrested the chairman of BSB Global Network on allegations of
  embezzling crores of taka from students under the guise of foreign admission, scholarship and visa support. Fake
  consultancies charge ৳8–11 lakh for "PR packages", and law enforcement now treats these rings as a form of human
  trafficking and money laundering ([Daily Sun](https://www.daily-sun.com/post/815186)).
- **Overseas-job scams feed forced labour.** Bangladeshi jobseekers are trafficked into scam compounds in Cambodia
  ([Kathmandu Post, Jul 2026](https://kathmandupost.com/world/2026/07/16/how-bangladeshi-jobseekers-are-trafficked-into-cambodia-s-scam-compounds)),
  and recruiting agencies lost licences over a fraudulent transfer of 30 youths to Russia ([Prothom Alo](https://en.prothomalo.com/amp/story/bangladesh/pfydrq5l7w)).
- **The scam signature is stable**: a guaranteed outcome + money paid to a person + urgency + moving off-platform. That is
  what the engine in §8.1 encodes.

### 3.2 Competitors

| Player | Model | Strength | Gap we exploit |
|---|---|---|---|
| Facebook groups (study-abroad, admission, scholarship) | Unmoderated community | Huge reach | No verification, scams in DMs, nothing structured or searchable, no enforcement record |
| **MentorMind** (mentormind.bd) | 1:1 mentor messaging, 16+ categories, AI assist | First mover, "#1 mentorship platform in BD" claim | Private-messaging-first (the highest scam-risk channel). No public knowledge base, no published verification method or enforcement record ([site](https://mentormind.bd/)) |
| **AbroadMates** | Peer study-abroad mentoring, began on Facebook/Instagram | Authentic peer supply | Social-media-native, with no platform-level trust, booking accountability or anti-fraud |
| **Qunnix** | "LinkedIn for BD students": networking, internships, competitions, calculators | Student network and utilities | Networking-first. No verified-expert layer, completion-gated reputation or scam defence ([site](https://qunnix.com/)) |
| **Mentors'** (study-abroad consultancy, 16 yrs) | Commission-based agency | Brand and offices | Structurally conflicted (university commissions). Our mentors must publicly declare conflicts of interest |
| ADPList / MentorCruise / Topmate | Global mentoring marketplaces | Product polish | No BD context or local payment rails; quality and no-show problems (ADPList); paid-first (MentorCruise) |
| 10 Minute School, Shikho | EdTech content | Brand reach | Course selling, not mentorship or community |

### 3.3 Our differentiators (what competitors can't copy quickly)

1. **Inspectable verification.** Every badge links to a public credential page: what was verified, how, when, and whether
   it's still valid. Documents are never published or kept.
2. **A public enforcement record.** A live transparency report, a published strike ladder and appeals to a different moderator.
3. **A structured, indexable knowledge base.** Questions with accepted answers, guides with official sources and a
   "last verified" date, verified opportunities and a subscribable deadline calendar. Facebook groups can't do this.
4. **Neutrality.** No ads, no data selling, no pay-to-rank, ever. Mentors declare commissions.

---

## 4. The improved concept

| Your original idea | v3 design | Why |
|---|---|---|
| "Open a profile as an expert" | **Expert status is granted, never claimed.** Application with evidence → manual moderator review → mandatory 2FA → listed. A *Verified mentor* badge names what was checked ("MSc Informatics, TU Munich · Higher study abroad"). It is revocable and expires after 12 months. | Self-declared expertise is exactly how fake agents work. Verified accounts are the most valuable to hijack, hence mandatory 2FA. |
| "Book a session or informal advice" | **Free online sessions** through a state machine: request with prepared questions + 1–3 times → mentor accepts within 72 h → private Jitsi room → **both confirm** it happened → feedback. Weekly capacity limits protect mentors from burnout. | Structure creates accountability, and accountability makes reputation meaningful. |
| "Ranking and trust badge from feedback" | **Four separate signals:** (1) **Trust Level** TL0–TL4 (citizenship, behavioural, demotable); (2) **Reputation** (an append-only ledger, broken down by topic); (3) **Rating** (completion-gated, 3 axes, Bayesian-shrunk, hidden below 3 reviews, with response rate shown); (4) **Reliability** (no-show/late-cancel telemetry, public). Badges are **facts**. | One number can't express citizenship, competence and dependability. Separating them makes gaming harder and explanations possible. |
| "Share posts and opportunities, but no scams" | **Layered defence:** account gates (TL ≥ 1 and 72 h before sharing opportunities) → explainable risk engine (EN/BN/Banglish) → hold for human review → community reports weighted by trust → moderation with SLAs → appeals → transparency. Opportunities need an official https link and an honest fee answer; moderators add **✓ Verified**. | "No scam" is an outcome. It needs a system with humans at the centre. |
| "Top-notch security" | A defined set of controls, every one of which is tested (§7). | "Maximum security" has to be checkable. |
| "User friendly, professional" | Works without JavaScript (plain forms), fast on low-end phones, Bangla UI chrome, WCAG-minded markup, errors that explain how to fix them. | Most BD students are mobile-first on slow connections. |
| (implicit) "long-term, no hidden mess" | Schema-first with DB-enforced invariants, forward-only migrations, ADRs, CI gates, runbooks. | Long-lived platforms die of accumulated mess. |

---

## 5. Product specification (Phase 1, as built)

**Accounts.** Registration (18+ attestation, consent to versioned policies) gives the same response whether or not the
email exists. Then email verification by a single-use link (confirmed by POST so email scanners can't burn it), login
with optional/required TOTP and recovery codes, password reset, a device list with remote sign-out, data export and real
account deletion.

**Community.** Ten controlled topics (political and religious content excluded at launch). Post types: question,
discussion, guide (must cite official sources), opportunity (organisation, official https link, fee disclosure,
optional deadline), success story, and safety alert (staff only). Also answers, "helpful" votes (no downvotes on
questions), accepted answers, full-text search (Bangla-safe `simple` config), and topic/type/sort filters. Every edit
is re-screened, and editing a verified opportunity removes its checkmark.

**Opportunities.** A verified-first list sorted by deadline, plus an RFC 5545 calendar feed of moderator-verified deadlines.

**Mentors.** Application → review console → approval grants per-topic *Verified mentor* badges. A profile shows the
scope of advice, the conflict-of-interest statement, offerings (15/30/45/60 min, **free by database constraint**),
rating, reliability and anonymised reviews. The directory is ranked on merit only, with a separate "new verified
mentors" section so newcomers aren't buried. There's an optional, self-described "women mentors" filter.

**Sessions.** Request → accept (choose a proposed slot; meeting links limited to Jitsi/Meet/Zoom/Teams/Whereby) →
reminders 24 h and 1 h before → outcome confirmation → feedback (14-day window, once only). Private messages are
screened, and payment requests are held and never delivered. Disputes go to staff. Low reliability auto-pauses a mentor.

**Safety & governance.** Report on every surface (13 reasons, with priority lanes P0–P3), a public notice-and-action
form for non-users, a moderation console (queue, reports, mentor applications, appeals, disputes, members, kill
switches, blocked domains, audit-log viewer), a strike ladder, appeals and a live transparency report.

**Not in Phase 1 (deliberately):** payments, file uploads, open DMs, native apps, AI advisers, under-18 accounts, video
hosting and political/religious spaces. See §13 for when each arrives.

---

## 6. Trust & reputation system

### 6.1 Trust Levels (`src/lib/trust/trust-level.ts`)

| Level | Requirements (all observable) | Unlocks |
|---|---|---|
| TL0 New | Registered | Ask, answer, vote, report (TL0 reports carry no auto-hide weight). Links held for review. 3 posts/day |
| TL1 Basic | Verified email, ≥ 3 days old, visited ≥ 3 days, 1 published contribution, no active strike | Share opportunities (held for review), more posts, 2 open session requests |
| TL2 Member | ≥ 30 days, ≥ 10 visit days, 10 contributions, 10 helpful votes, no strike in 180 d | Clean opportunities publish directly (unverified label) and public contact details are allowed; reports weigh 2 |
| TL3 Regular | ≥ 90 days, ≥ 45 visit days, 30 contributions, 50 helpful votes, 3 accepted answers, 3 upheld reports, clean record | Reports weigh 3 (community moderation). **Demoted automatically** if criteria lapse |
| TL4 Leader | Staff appointment, no active strike | — |

Members see exactly what the next level needs on their profile, with progress. Levels are recomputed nightly and on
moderation events.

### 6.2 Reputation ledger (`src/lib/trust/reputation.ts`)

Append-only, with a unique key on (user, kind, source) so awards are **idempotent**: retries, double-clicks and
vote → unvote → vote can never farm points. Corrections are reversal rows; the trigger forbids UPDATE.

| Event | Points | Guard rail |
|---|---|---|
| Helpful vote on post / answer | +1 / +2 | Cap of 20 vote points per day; no self-votes |
| Answer accepted | +10 | Asker ≠ answerer; changing the accepted answer reverses the old award |
| Session completed (mentor) | +5 | Only via the two-sided state machine |
| Feedback avg ≥ 4 / ≥ 3 / ≥ 2 / < 2 | +5 / +1 / 0 / −5 | Completion-gated, once per booking |
| Opportunity verified | +5 | Moderator decision |
| Content removed / fraud confirmed | −10 / −50 | Moderator decision, appealable (reversed if granted) |

### 6.3 Rating (`src/lib/trust/rating.ts`)

Three axes, all 1–5: helpfulness 0.4, knowledge (accuracy) 0.4, respect & safety 0.2. Bayesian shrinkage
`(Σx + μ·m)/(n + m)` with μ = 4.0, m = 5, so three perfect reviews show 4.4, not 5.0. Hidden below 3 reviews, and
the response rate is always shown. **Respect ≤ 2 always opens a safety review.**

### 6.4 Reliability (`src/lib/trust/reliability.ts`)

`1 − (no-shows + ½·late cancels) / basis`, shown after 3 sessions, in bands. Below 60 % the mentor stops receiving
requests until a moderator reviews.

### 6.5 Badges = facts with provenance (`src/lib/trust/badges.ts`)

Verified institution email (domain only, 12 months) · Verified professional · **Verified mentor (per topic, manual
review, 12 months)** · Founding mentor · Moderator · 10/50/100 confirmed sessions · Top helper per topic (top 5 %,
minimum 30 points, recomputed daily) · Opportunity scout (5 verified opportunities). Each has a public page at
`/v/{credentialId}`. **Never purchasable**; this is written into the product constitution (§11).

### 6.6 Anti-gaming

| Attack | Defence |
|---|---|
| Fake sessions between colluding accounts | Both sides must confirm, feedback is once per booking, accounts are rate-limited, and staff see clustering in the audit log |
| Review bombing | Only the student of a completed booking can review, once |
| Vote farming / rings | Idempotent awards, daily cap, no self-votes; TL3 needs upheld *reports*, not just votes |
| Brigading to silence someone | TL0 reports carry zero hiding weight, hiding needs weighted reports ≥ 4, content is only ever *held* for human review |
| Badge forgery / impersonation | Badges are server-side rows. Display names can't contain "official/verified/support" or badge-like symbols, and usernames like `admin*` are reserved |
| Retaliation against students | Reviews are anonymous; mentors can report extortion |

---

## 7. Security architecture

### 7.1 Mapped to OWASP Top 10:2025

| Category | Controls in this codebase | Proof |
|---|---|---|
| **A01 Broken Access Control** (incl. SSRF) | A central deny-by-default policy (`policy.ts`) enforced in the route pipeline **and** again inside services. Object-level checks are actor-scoped queries (a booking you're not part of returns 404). Staff powers need role + TOTP + an MFA-verified session. No server-side fetching of user URLs. | `security.test.ts` policy matrix; `route-coverage.test.ts`; IDOR assertions in integration tests |
| **A02 Security Misconfiguration** | Fail-fast env validation (refuses placeholder, weak or reused secrets, http, console email, inline jobs, a missing trusted-IP header), strict headers, `poweredByHeader:false`, non-root read-only containers | `env.test.ts`; `smoke.spec.ts` header checks |
| **A03 Software Supply Chain** | Exact pins, lockfile + `npm ci`, `npm audit --omit=dev --audit-level=high` in CI, Dependabot, CodeQL, a minimal dependency set. Nodemailer was upgraded during this build after `npm audit` found SMTP-injection advisories | CI workflow |
| **A04 Cryptographic Failures** | Argon2id; SHA-256-hashed session, email and recovery tokens; AES-256-GCM for TOTP secrets with AAD; HKDF purpose-separated subkeys; HSTS preload | `security.test.ts` |
| **A05 Injection** | Drizzle parameterised SQL; Zod on every body; React escaping; `react/no-danger` lint error; user text rendered as text (no auto-linking) | lint + validation tests |
| **A06 Insecure Design** | Threat-driven product rules: free sessions, no DMs, online-only, no uploads, adults-only, two-sided completion, holds rather than blocks | integration tests |
| **A07 Authentication Failures** | 15-char minimum (NIST 800-63B-4), breach check, dual-keyed throttling (per IP for campus NAT, per account), timing-equalised unknown-account path, identical errors, TOTP with replay protection, session rotation on login/MFA/password change, new-device email | `auth.test.ts` |
| **A08 Software/Data Integrity** | Hash-chained audit log + append-only triggers + runtime role without UPDATE/DELETE; append-only reputation ledger; DB check constraints for business invariants | `auth.test.ts` tamper test; grants verified live |
| **A09 Logging & Alerting** | Structured JSON logs, an audit trail for all security and moderation events, daily chain verification that alerts admins, P0 report alerts, failed-job alerts | worker logs |
| **A10 Exceptional Conditions** | Typed `AppError`s; unknown errors return a generic message plus a reference id; the policy fails closed; Turnstile fails closed; HIBP fails open (availability) and logs it | `route.ts`, policy tests |

### 7.2 Session & request lifecycle

```
Browser ──HTTPS──▶ Cloudflare (WAF, DDoS, bot) ──▶ Caddy (TLS, body cap) ──▶ Next.js
  proxy.ts: per-request CSP nonce + CSRF seed cookie (never auth)
  page / route:
    defineRoute(): size cap → Origin/Fetch-Metadata → signed CSRF token → IP flood limit
                 → session (opaque token → SHA-256 → row + fresh user) → policy
                 → Zod → per-route rate limits → handler → service (re-checks policy)
                 → audit (hash chain, same transaction) → 303 redirect / JSON
```

Cookies: `__Host-peerlink_sid` (HttpOnly, Secure, SameSite=Lax, Path=/) and `__Host-peerlink_csrf`.

### 7.3 Data protection by design

No NID, birthdate, phone or document collection in Phase 1. IPs are stored only as keyed HMACs (90 days). Emails never
contain user-generated text, and every link points at our own origin (anti-phishing). Profiles are hidden from search
engines unless the member opts in. Data export is JSON; deletion erases personal data immediately and keeps
contributions as "Deleted member" (or deletes them on request). A banned user's email hash survives deletion, so
deleting the account can't be used to evade a ban.

### 7.4 Before payments (Phase 2 gate)

An independent penetration test (or OWASP ASVS 5.0 Level 2 self-assessment with an external reviewer), WebAuthn
passkeys for staff, branch-coverage gates raised to 90 % on money paths, and a separately audited payments module.

---

## 8. Trust & safety: anti-scam, moderation, wellbeing

### 8.1 The risk engine (`src/lib/risk/`)

**Normalisation** removes obfuscation only: NFKC, invisible and bidi characters, Cyrillic/Greek look-alikes, spaced
letters, leetspeak *inside words* (numbers, amounts and phone numbers stay intact) and repeated letters.

**Signals** are intent patterns in English, Bangla and Banglish: money to a person, wallet + phone number, advance or
processing fees, guaranteed outcomes, agent service offers, document-fraud offers, exam fraud, urgency, off-platform
steering, crypto payment, money-mule recruitment, MLM, overseas jobs with fees, and threats. **Questions are
discounted:** "Is a 100 % visa guarantee real?" is a victim asking for help, not a scammer. "100 % scholarship" and
"fully funded" are allowlisted. **Policy gates:** opportunities from TL < 2 or with fees, links from TL0, shorteners,
blocked domains, and public contact details from TL < 2.

**Combinations** carry the weight: offer/guarantee + money + off-platform contact.

**Decisions:** < 20 publish · 20–44 publish + flag · ≥ 45 **hold for a human** · reject only for high-precision
combinations (blocked domain, document-fraud offer + money/contact, exam fraud + money/contact, wallet + offer). Authors
see policy-level reasons, never patterns, and can edit or **ask for a human review**. Each evaluation stores the
ruleset version.

**Calibration:** `tests/unit/risk-engine.test.ts` requires 40 benign student questions (English, Bangla, Banglish,
including those the Shikor blueprint blocked) to produce **zero holds** and ≤ 15 % flags, and 16 scam posts (including
full-width-Unicode and leetspeak evasions) to all be held or rejected.

Crisis language ("I want to die", "আত্মহত্যা") **never penalises**. The author gets private support resources and staff
get a P0 report to reach out.

### 8.2 Moderation

| Priority | Examples | Target |
|---|---|---|
| P0 | Minor safety, self-harm | 1 hour (coverage hours), staff alerted by email |
| P1 | Scam, fake opportunity, payment request, impersonation, sexual content | 4 hours |
| P2 | Harassment, hate, privacy, misinformation | 24 hours |
| P3 | Spam, other | 48 hours |

**Strike ladder:** warning → strike 1 (7-day posting/booking restriction) → strike 2 (30 days) → strike 3 (90-day
suspension) → ban. Fraud, exam fraud, threats and anything involving minors go straight to a ban. Strikes expire after
12 months. A ban revokes sessions, badges and mentor status, cancels open bookings, and records the email hash.

**Due process:** every action stores a public reason and notifies the member with an appeal link (30-day window). The
appeal must be decided by **a different moderator**. A one-person team is the only exception, and it is audited.
Granted appeals reverse the effects (content restored, reputation reversed, strike revoked).

**Notice-and-action:** a public form for non-users with acknowledgement and staff alerts for P0/P1, plus a named
Grievance Officer in the footer and privacy policy.

### 8.3 Wellbeing & ethics (self-imposed)

No ads, no data selling, no pay-to-rank, no dark patterns, no infinite-scroll engagement tricks, no "someone viewed
your profile" bait. Kindness is part of the guidelines. There are no downvotes on questions, and crisis routing never
punishes.

---

## 9. Architecture, stack & data model

**Modular monolith** (ADR-001): one Next.js app + one worker from the same codebase, with PostgreSQL as the only
stateful service.

| Layer | Choice | Why (and what was rejected) |
|---|---|---|
| Web | Next.js 16.3.8 App Router, server components, **plain HTML forms → route handlers** | SSR for SEO and low-end phones. Forms work without JS. Route handlers rather than Server Actions for explicit, testable HTTP (several 2026 CVEs targeted Server Actions). |
| DB | PostgreSQL 16+ via Drizzle ORM 0.45 + SQL migrations | Relational integrity as business rules. Drizzle stays close to SQL; Prisma 7/8 churn and engine changes were avoided. |
| Queue / limits / search | PostgreSQL (`SKIP LOCKED` jobs, UPSERT limiter, `tsvector` + GIN) | One stateful service to secure, back up and monitor. Redis/Typesense have documented triggers (ADR-004). |
| Auth | Own minimal, tested code on `@node-rs/argon2` + `node:crypto` | Every control is visible and tested; no framework magic to misconfigure. |
| Email | SMTP (any provider) via Nodemailer 10 | Provider-agnostic. Console/file transports for dev and tests. |
| UI | Tailwind CSS 4, zero UI component libraries | Small bundle, no third-party scripts (CSP), Bangla font stack. |
| Tests | Vitest 5 (unit + integration on real Postgres), Playwright (prod build, desktop + mobile) | Integration against real Postgres catches what mocks hide. |

**Data model:** 30 tables (`src/lib/db/schema.ts`). Invariants live in the database:

- `offerings_phase1_free CHECK (price_bdt = 0)`
- `feedback_booking_uq` (one review per booking)
- `bookings_one_open_per_pair_uq` (partial unique index)
- `bookings_not_self`
- `reputation_events_idem_uq`
- `badges_active_uq`
- `reports_dedupe_uq`
- `posts_opportunity_fields`
- lower-case email and username-format checks
- append-only triggers on `audit_log` / `reputation_events`

**Least privilege:** the app runs as `peerlink_app` (DML only, no UPDATE/DELETE on the audit log, can't disable
triggers). Migrations run as `peerlink_owner`. Verified live in this session (§SETUP).

---

## 10. Legal & compliance (Bangladesh)

| Instrument | Status (Oct 2026, per sources) | What we built |
|---|---|---|
| **Personal Data Protection Act 2026** (from the Nov 2025 ordinance; Act from 15 Apr 2026) | In force; organisational obligations and penalties phase in around **May 2027** | Consent records with policy versions, a privacy notice with purposes, retention and rights, data export, erasure, minimisation, adults-only, profiling disclosure + human review, breach-notification runbook. **Child = under 18 → guardian consent.** Localisation targets restricted/critical data, which we don't collect. |
| **Cyber Security Act 2026** + **Amendment** (s.26A rumour/disinformation up to 10 years/Tk 4 M; expanded s.25 defamation; passed by parliament per Dhaka Tribune) | In force | Procedural defence: published guidelines, notice-and-action, hash-chained evidence of what we did and when, Grievance Officer, political/religious content excluded, allegations against named organisations moderated, "guaranteed" claims screened |
| Consumer Rights Protection Act 2009 | In force | Becomes central once payments exist (refunds, pricing transparency) |

**What a licensed Bangladeshi advocate must confirm in writing before public launch:**

1. The PDPA 2026 obligations for a start-up controller, the breach-notification window, and whether any hosting-location
   duty applies to our data.
2. What counts as "verifiable" guardian consent (for Phase 1.5).
3. Any intermediary safe-harbour conditions under the Cyber Security Act 2026 and how our notice-and-action process
   satisfies them.
4. A review of the Terms, Privacy Policy and Guidelines (Bangla + English).
5. **Before Phase 2:** whether platform-facilitated payments or escrow need a licence, and the PSP structure. Budget
   ≈ ৳1–3 lakh one-off for the entity, policy review and opinions.

---

## 11. Monetisation — sequenced, with hard constraints

**Product constitution (non-negotiable):** trust signals, rankings and badges are **never for sale**. No ads, no data
selling, no commissions from universities or agencies.

| Phase | Revenue line | Notes |
|---|---|---|
| 1 (now) | None. Free builds supply, SEO and trust | The free promise also takes away the scammer's "pay me" script |
| 2 | **Paid sessions** via a licensed PSP's split-settlement/escrow (e.g. an SSLCommerz aggregator account: ৳25,500 setup, ~2.5 % per transaction; bKash/Nagad included) ([SSLCommerz pricing](https://sslcommerz.com/pricing/)). Platform fee 10–15 %, minimum price ৳200 | Only after the legal opinion. Mentor payout KYC only for payout-eligible mentors. Refund and dispute policy in Bangla |
| 2–3 | **Institutional programmes**: universities and NGOs buy cohort mentoring and career-office dashboards | Diversifies away from student wallets |
| 3 | Optional mentor "Pro" tools (calendar sync, templates). **Never ranking** | Labelled, capped, quality-gated |

Unit-economics caution: on a ৳600 session the gateway takes about ৳15, so per-session fees alone won't sustain the
business. B2B is the real line.

---

## 12. Go-to-market & cold start

1. **Weeks −6 to 0: supply first.** Hand-recruit 30–50 founding mentors: Bangladeshi alumni in Germany, Japan, Malaysia,
   Canada and the UK, plus senior BUET/DU/NSU/BRAC students. Verify them personally, enable 2FA, grant
   *Founding mentor*. Ask each to write one guide with official sources.
2. **Seed content.** 100+ posts before launch: guides, real Q&A, verified opportunities with deadlines.
3. **Launch by cohort, not by blast.** One campus at a time, with "Ask a Germany alum anything" sessions. Measure
   before expanding.
4. **SEO flywheel.** Every accepted answer, guide and verified opportunity is an indexable page answering long-tail
   queries currently served by agent sites.
5. **Distribute the Safety page where the scams live.** The red-flag list is screenshot-ready content for Facebook groups.
6. **North-star metric: weekly completed sessions with feedback.** Guardrails: scam-report time to action, false-hold
   rate (target < 5 %), 4-week mentor retention, women users' retention vs overall.

---

## 13. Roadmap with phase gates

| Phase | Scope | Exit criteria |
|---|---|---|
| **1 — Built (this repo)** | Everything in §5 | CI green; staging deployed; restore drill passed |
| **1.0 Launch prep (3–4 wks)** | Entity + legal review (§10), domain, Cloudflare, email DNS (SPF/DKIM/DMARC), production deploy, 2+ trained moderators and SLA rota, founding-mentor recruitment, Bangla translation review of legal pages | Launch checklist in [SETUP.md](SETUP.md) all green |
| **Closed beta (4–6 wks)** | 1 campus, 30–50 mentors | 50 completed sessions; P1 SLA met 95 %; false-hold rate < 5 %; no scam loss incident |
| **1.5 (2–4 months)** | Guardian-consented under-18 accounts (restricted: public Q&A + group AMAs only), full Bangla UI, WebAuthn passkeys, weekly digest email, guides with versioning/maintainers, right-of-reply for named organisations, embedding-based near-duplicate scam detection (pgvector), Redis if the triggers fire | 5k MAU, 500 sessions/month |
| **2 (+3–6 months)** | Paid sessions via licensed PSP escrow, payout KYC, disputes with ledger, pen test, separate payments module | Legal opinion received; dispute rate < 2 % |
| **3** | Institutional programmes, regional expansion, native app only if data justifies it | Revenue covers ops |

---

## 14. Risk register

| # | Risk | L × I | Mitigation |
|---|---|---|---|
| R1 | A scam harms a student, collapsing trust | M × **H** | Layered defence §8, free Phase 1, P1 4-hour SLA, public post-mortem within 7 days, transparency report |
| R2 | Cold start (empty room) | **H** × H | Supply-first, campus cohorts, seed content §12 |
| R3 | Moderator capacity / burnout | M × H | SLA rota, holds rather than auto-removal, kill switches, queue metrics, stipends for moderators |
| R4 | Verified-mentor account takeover | M × **H** | Mandatory TOTP, session revocation, new-device email, badge revocation in one click |
| R5 | Legal exposure (CSA 2026 / PDPA 2026) | M × M | §10 procedural defence + counsel |
| R6 | Over-blocking legitimate questions | M × M | Benign-corpus CI gate, holds not blocks, human-review button, weekly false-hold review |
| R7 | Monetisation corrupts neutrality | M × **H** | Product constitution §11 |
| R8 | Platform dependence (host, email, Cloudflare) | L × M | Portable Postgres, Docker, SMTP abstraction, documented exits |
| R9 | Scammers adapt their wording | **H** × M | Monthly rule review from moderator labels, blocked-domain list, human review, near-duplicate detection in 1.5 |
| R10 | Solo-founder bus factor | M × M | This documentation, ADRs, runbooks, tests as the specification |

---

## 15. Known limitations (honest list)

- **Legal texts are drafts.** They need advocate review and full Bangla translations.
- **The Docker image build was validated by configuration but not executed in this sandbox** (no Docker daemon). CI
  builds and tests the same steps natively. Run `docker build -f deploy/Dockerfile .` once on your machine before the
  first deploy.
- **Email-scanner-safe links rely on a POST confirmation step.** That is correct, but it means one extra click.
- **Rate limits are per-instance-consistent but not geo-aware.** Cloudflare's WAF rules supply the outer layer.
- **The risk engine is deterministic.** It will miss novel scam wording until a moderator labels it; that is the role
  of human review.
- **Gender filtering is self-described and opt-in.** Mentors aren't verified for gender. The UI says so implicitly by
  calling it "self-described" in settings.

---

## 16. Sources

- NIST SP 800-63B-4 (2025), password length — <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63B-4.pdf>; ASVS discussion — <https://github.com/OWASP/ASVS/issues/3242>
- OWASP Top 10:2025 — <https://owasp.org/Top10/2025/>; changes summary — <https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know>
- Next.js 2026 security releases — <https://vercel.com/changelog/next-js-may-2026-security-release>, <https://www.netlify.com/changelog/2026-07-21-nextjs-security-vulnerabilities/>, <https://nextjs.org/blog/upcoming-nextjs-security-release-september-2026>
- Bangladesh PDPA 2026 — <https://securiti.ai/bangladesh-personal-data-protection-act-overview/>, <https://www.dataguidance.com/opinion/bangladesh-unpacking-personal-data-protection-act>, <https://digitalpolicyalert.org/change/18757-personal-data-protection-amendment-ordinance-2026-ordinance-no-23-of-2026>, <https://www.thedailystar.net/tech-startup/news/bangladeshs-personal-data-protection-ordinance-2025-key-takeaways-4015401>
- Cyber Security (Amendment) Act 2026 — <https://www.dhakatribune.com/bangladesh/parliament/414016/cyber-security-amendment-bill-2026-passes-in>, <https://en.prothomalo.com/bangladesh/wbq9kji6z7>, <https://civicus.org/index.php/media-resources/news/8806-bangladesh-draft-cyber-protection-amendment-act-2026-poses-serious-risk-to-freedom-of-expression-and-mirrors-the-digital-security-act-used-to-repress-human-rights-defenders-and-journalists>
- Student fraud and trafficking — <https://www.daily-sun.com/post/815186>, <https://kathmandupost.com/world/2026/07/16/how-bangladeshi-jobseekers-are-trafficked-into-cambodia-s-scam-compounds>, <https://en.prothomalo.com/amp/story/bangladesh/pfydrq5l7w>
- Competitors — <https://mentormind.bd/>, <https://qunnix.com/>, <https://mentors.com.bd/>, <https://tbsgraduates.net/interviews/why-two-bangladeshi-students-decided-to-fix-the-study-abroad-system/>
- Payments — <https://sslcommerz.com/pricing/>, <https://nowpayments.io/blog/payment-gateway-banglsdesh>
- Reputation design — Discourse trust levels <https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/>; Stack Overflow, "A Theory of Moderation" <https://stackoverflow.blog/2009/05/18/a-theory-of-moderation/>
- Marketplace cold start — <https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem>
