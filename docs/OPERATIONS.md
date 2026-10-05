# Operations — moderation, incidents and routines

Software makes a trust platform possible; **people running a process** make it trustworthy. This is the operating
manual for the founder and the first moderators.

---

## 1. Moderation standard operating procedure

### 1.1 Daily (each moderator on shift)

1. Open **/mod**. Handle in this order: **P0 reports → P1 reports → review queue → mentor applications → appeals → disputes**.
2. Hit the time targets on the dashboard: P0 1 h · P1 4 h · held content 24 h · P2 24 h · P3 48 h · appeals 5 days.
3. For each decision, write the **public reason** in plain language. The member reads it, and it is how we stay
   consistent and legally defensible.

### 1.2 How to decide

| Situation | Action |
|---|---|
| Held post that's legitimate (e.g. a student asking whether an offer is fake) | **Approve**. If the filter was wrong, add the sentence to `tests/unit/risk-engine.test.ts` (benign list) at the weekly review |
| Opportunity you could confirm on the **official** website | **Approve + verify ✓**. Never verify from screenshots or forwarded links |
| Opportunity you can't confirm | Approve without verification only if harmless; otherwise remove with "couldn't confirm with an official source" |
| Advance-fee, guaranteed visa, "we arrange documents", exam proxy | **Remove (reason: scam)**, ban the account (tick *confirmed fraud*), add the domain to **Blocked domains** |
| First minor issue (off-topic, sharing a phone number) | Remove the content or **Warn** |
| Repeated issues | **Strike** (the ladder applies automatically) |
| Harassment, threats, sexual content, anything involving minors | Remove + **Ban**. Preserve evidence (don't delete it; *removed* keeps it). For minors and threats, follow §2.4 |
| Self-harm / crisis report | **Never punish.** Reach out privately with the resources on /safety#support. Mark the report handled |
| Mentor application | Check every claim against an **independent** source (the university's own staff page, LinkedIn history, publications). Ask for a short video call if unsure. **Never request ID documents or NID numbers.** Write the badge label as exactly what you verified |
| Session dispute | Read the session messages. Ask both sides once (by message). Decide on the balance of evidence, and explain |

### 1.3 Conflicts of interest

Never moderate content, mentors or disputes involving yourself, friends, your employer or your agency. The system
blocks acting on your own account and content and resolving your own disputes. Use judgement for the rest, and hand
the item to a colleague.

### 1.4 Moderator wellbeing

Rotate P0 duty. Take breaks after graphic content. No one moderates more than 2 hours of reports in a row. The founder
checks in weekly.

---

## 2. Incident response

**Severity:** **SEV1** = student money or safety at risk now, data breach, or platform compromise · **SEV2** = active
scam wave, account takeover of a mentor, outage over 1 h · **SEV3** = everything else.

For every SEV1/SEV2: (1) contain, (2) preserve evidence (don't delete; the audit log is append-only), (3) fix,
(4) communicate, (5) write a post-mortem **within 7 days** with a fix that is *implemented*, not just noted.

### 2.1 Kill switches (no deploy needed)

`/mod/settings` (admin): pause **registrations**, **posting**, **opportunity posts** or **booking requests**. Every
flip is audited. Use them first and investigate second.

### 2.2 Playbook — scam wave

1. Pause **opportunity posts** (and posting, if needed).
2. Find the shared pattern (domain, phrasing, phone). Add the domains to **Blocked domains**.
3. Remove the content (reason: scam), ban the accounts (confirmed fraud), and check their session messages.
4. Publish a **Safety alert** post describing the *pattern* (never name unconvicted individuals).
5. Add the phrasing to the scam corpus in tests and, if needed, a new signal. Bump `RULESET_VERSION`.
6. Resume, then watch the queue for 48 h.

### 2.3 Playbook — mentor account takeover

1. Admin → `/mod/users` → **Suspend** (this ends all their sessions on the next request).
2. Message students with open bookings with that mentor (via the booking messages) and warn them.
3. Contact the real person by a known-good channel. Have them reset their password and re-enrol 2FA.
4. Review the audit log (`/mod/audit`) for actions taken during the takeover. Reverse them.
5. Restore the account. Note the incident in the next transparency report.

### 2.4 Playbook — risk to a minor, threats, trafficking

Don't investigate beyond preserving evidence. Ban the account, keep the content as *removed*, and contact counsel. For
imminent danger, call **999**. Use the reporting path pre-agreed with counsel (Cyber Crime Unit / relevant authority).
Write that path down **before launch**.

### 2.5 Playbook — suspected data breach

1. **Contain:** rotate `APP_SECRET`. This invalidates CSRF tokens and IP-hash correlations; sessions survive because
   they're DB-hashed, so also run `UPDATE sessions SET revoked_at=now()` (as owner) to force everyone to log in again.
   Rotate DB passwords and SMTP credentials.
2. **Preserve:** snapshot the VPS disk and copy the logs. Don't wipe anything.
3. **Assess:** what data, how many people, since when. The audit log + `npm run audit:verify` show whether records were
   altered.
4. **Notify:** the data-protection authority and affected users as PDPA 2026 requires (confirm the window with counsel
   in advance). Use plain Bangla and English: what happened, what data, what we did, and what you should do.
5. **Post-mortem** within 7 days, and include it in the transparency report.

### 2.6 Playbook — legal / government request

All requests go to the Grievance Officer. Log them (date, authority, legal basis, scope). **Counsel reviews them before
any disclosure.** Disclose the minimum. Notify the user where lawful. Count every request in the quarterly
transparency report.

### 2.7 Playbook — audit chain broken

The nightly job emails admins. Treat it as **SEV1** (possible tampering). Don't "fix" the table. Restore the latest
backup into a scratch DB and compare. Find the first broken entry (`npm run audit:verify` prints it). Investigate
database access logs and credentials.

---

## 3. Routines

| When | Task |
|---|---|
| **Daily** | Queues within SLA · glance at the error logs · confirm the nightly backup log line |
| **Weekly** | Review held → approved rate (false holds) and add benign misses to the test corpus · review new scam patterns and blocked domains · check mentor reliability pauses · reply to all appeals |
| **Monthly** | Restore drill (`deploy/backup/restore-drill.sh`), logged with duration · dependency updates (merge Dependabot PRs after CI) · access review: who is moderator/admin, remove anyone inactive · re-run `deploy/firewall-cloudflare.sh` (Cloudflare ranges change) |
| **Quarterly** | Publish the **transparency report** (the `/transparency` live figures + legal requests + incidents + changes made) · policy review with moderators · threat-model refresh · check the Next.js security advisories and that the Node version is still supported |
| **Before each Bangladesh election period** | Heightened moderation, counsel on standby, political content stays out of scope |
| **Before payments (Phase 2)** | External penetration test, legal opinion on escrow, payments module review (BLUEPRINT §7.4) |

---

## 4. Metrics that tell you it's working

| Metric | Healthy | Alarm |
|---|---|---|
| Median time to act on reports (from /transparency) | < 4 h | > 24 h |
| False-hold rate (held then approved ÷ held) | < 5 % | > 15 %: the filter is too strict, so tune it |
| Confirmed financial-loss scams via the platform | **0** | ≥ 1 → SEV1 post-mortem, public |
| Sessions with feedback ÷ completed | > 50 % | < 25 % |
| Mentor no-show rate | < 4 % | > 10 % |
| Appeals granted ÷ decided | 5–15 % | > 25 %: moderators are over-reaching |
| Women users' 90-day retention vs overall | within 5 points | larger gap = a safety signal |
