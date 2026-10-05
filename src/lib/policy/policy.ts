import type { SessionRow, SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/http/errors";

/**
 * Central authorization policy — deny by default, fail closed.
 *
 * Every page and route handler asks `authorize(actor, action, context)`.
 * Broken access control is OWASP A01:2025; ad-hoc `if` checks scattered across
 * handlers are how it happens. Here the whole permission model is one file a
 * reviewer can read top to bottom, and tests/unit/policy.test.ts pins it.
 *
 * Object-level checks (is this *your* booking?) are done by the services with
 * actor-scoped queries; this layer answers "may this actor perform this kind of
 * action at all, given role, status, verification, trust and restrictions".
 */

export type Actor = { user: SessionUser; session: SessionRow } | null;

export type Action =
  | "post.create"
  | "post.create.opportunity"
  | "post.create.safety_alert"
  | "answer.create"
  | "vote.cast"
  | "report.create"
  | "booking.request"
  | "booking.participate"
  | "mentor.apply"
  | "mentor.manage"
  | "profile.update"
  | "account.manage"
  | "appeal.create"
  | "staff.moderate"
  | "staff.admin";

export type DenyReason =
  | "login_required"
  | "email_unverified"
  | "suspended"
  | "restricted"
  | "trust_level_too_low"
  | "account_too_new"
  | "not_mentor"
  | "mfa_required"
  | "forbidden";

export type Decision = { ok: true } | { ok: false; reason: DenyReason };

const ALLOW: Decision = { ok: true };
const deny = (reason: DenyReason): Decision => ({ ok: false, reason });

export type PolicyContext = {
  now?: Date;
  /** For mentor.manage / booking participation: the actor's mentor status, looked up by the caller. */
  mentorStatus?: "pending" | "approved" | "rejected" | "paused" | "revoked" | null;
};

export const OPPORTUNITY_MIN_ACCOUNT_AGE_MS = 72 * 3600_000;
export const OPPORTUNITY_MIN_TRUST_LEVEL = 1;

export function isStaffRole(role: string) {
  return role === "moderator" || role === "admin";
}

export function isSuspended(user: SessionUser, now = new Date()) {
  return user.status === "suspended" && (!user.suspendedUntil || user.suspendedUntil > now);
}

export function isRestricted(user: SessionUser, now = new Date()) {
  return !!user.restrictedUntil && user.restrictedUntil > now;
}

/** Staff powers require TOTP enrolled AND verified in this session. */
export function hasStaffMfa(actor: NonNullable<Actor>) {
  return !!actor.user.totpEnabledAt && actor.session.mfaState === "verified";
}

export function authorize(actor: Actor, action: Action, ctx: PolicyContext = {}): Decision {
  try {
    return evaluate(actor, action, ctx);
  } catch {
    return deny("forbidden"); // fail closed
  }
}

function evaluate(actor: Actor, action: Action, ctx: PolicyContext): Decision {
  if (!actor) return deny("login_required");
  const { user } = actor;
  const now = ctx.now ?? new Date();
  if (user.status === "banned" || user.status === "deleted") return deny("forbidden");
  if (actor.session.mfaState === "pending") return deny("mfa_required");

  // Actions that remain available while suspended (due process + data rights).
  switch (action) {
    case "account.manage":
    case "appeal.create":
      return ALLOW;
    default:
      break;
  }

  if (isSuspended(user, now)) return deny("suspended");
  if (!user.emailVerifiedAt) return deny("email_unverified");

  switch (action) {
    case "profile.update":
      return ALLOW;

    case "post.create":
    case "answer.create":
    case "vote.cast":
    case "report.create":
      if (action !== "report.create" && action !== "vote.cast" && isRestricted(user, now)) return deny("restricted");
      return ALLOW;

    case "post.create.opportunity":
      if (isRestricted(user, now)) return deny("restricted");
      if (user.trustLevel < OPPORTUNITY_MIN_TRUST_LEVEL && !isStaffRole(user.role)) return deny("trust_level_too_low");
      if (now.getTime() - user.createdAt.getTime() < OPPORTUNITY_MIN_ACCOUNT_AGE_MS && !isStaffRole(user.role)) {
        return deny("account_too_new");
      }
      return ALLOW;

    case "post.create.safety_alert":
      if (!isStaffRole(user.role)) return deny("forbidden");
      return hasStaffMfa(actor) ? ALLOW : deny("mfa_required");

    case "booking.request":
      if (isRestricted(user, now)) return deny("restricted");
      return ALLOW;

    case "booking.participate":
      return ALLOW;

    case "mentor.apply":
      if (isRestricted(user, now)) return deny("restricted");
      return ALLOW;

    case "mentor.manage":
      if (ctx.mentorStatus !== "approved" && ctx.mentorStatus !== "paused") return deny("not_mentor");
      // Verified mentors are prime account-takeover targets (impersonation scams): 2FA is mandatory.
      if (!user.totpEnabledAt) return deny("mfa_required");
      return ALLOW;

    case "staff.moderate":
      if (!isStaffRole(user.role)) return deny("forbidden");
      return hasStaffMfa(actor) ? ALLOW : deny("mfa_required");

    case "staff.admin":
      if (user.role !== "admin") return deny("forbidden");
      return hasStaffMfa(actor) ? ALLOW : deny("mfa_required");

    default: {
      const exhaustive: never = action;
      void exhaustive;
      return deny("forbidden");
    }
  }
}

export const DENY_MESSAGES: Record<DenyReason, string> = {
  login_required: "Please log in to continue.",
  email_unverified: "Please verify your email address first — check your inbox.",
  suspended: "Your account is suspended. You can still read, appeal, export or delete your data.",
  restricted: "Your account is temporarily restricted from posting and booking.",
  trust_level_too_low: "Sharing opportunities unlocks at Trust Level 1 — take part in the community for a few days first.",
  account_too_new: "New accounts can share opportunities after 72 hours. This protects students from throwaway scam accounts.",
  not_mentor: "This is available to approved mentors only.",
  mfa_required: "Two-factor authentication is required for this. Set it up in Settings → Security.",
  forbidden: "You do not have permission to do that.",
};

/**
 * Defence in depth: services call this too, so a route that forgets its policy
 * binding still cannot let a restricted, suspended or unverified actor through.
 */
export function assertAllowed(actor: Actor, action: Action, ctx: PolicyContext = {}): void {
  const d = authorize(actor, action, ctx);
  if (!d.ok) throw new AppError(d.reason, d.reason === "login_required" ? 401 : 403, DENY_MESSAGES[d.reason]);
}
