/**
 * Text normalisation for safety analysis.
 *
 * Scammers evade keyword filters with one keystroke: `guaranteeed`,
 * `g u a r a n t e e d`, Cyrillic look-alikes, zero-width spaces, full-width
 * letters, or Banglish. We normalise those away before matching.
 *
 * LESSON FROM THE EARLIER "SHIKOR" BLUEPRINT: it mapped ordinary English
 * words ("copy", "fake", "bank", "job", "proxy") onto Bangla scam keywords and
 * then HARD-BLOCKED on single words — so "Can I submit a scanned copy of my HSC
 * certificate?" and "How much bank statement do I need for a German visa?" were
 * blocked with a strike. Here, normalisation only removes *obfuscation*; it
 * never changes the meaning of a word. Meaning is handled by the signal rules,
 * which require intent patterns (offer/request + object), not lone keywords.
 */

const INVISIBLE_RE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁦-⁯ㅤ﻿ﾠ]/g;

// Look-alike letters from other scripts → Latin. Deliberately excludes digits:
// "100%" and phone numbers must survive intact.
const CONFUSABLES: Record<string, string> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", ѕ: "s", і: "i", ј: "j", ԁ: "d", ӏ: "l",
  α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "−": "-",
};

export function stripInvisibles(s: string) {
  return s.replace(INVISIBLE_RE, "");
}

export function foldConfusables(s: string) {
  let out = "";
  for (const ch of s) out += CONFUSABLES[ch] ?? ch;
  return out;
}

/** `guaranteeeed` → `guaranteed`; keeps doubled letters (school, less). */
export function collapseRepeats(s: string) {
  return s.replace(/(\p{L})\1{2,}/gu, "$1$1");
}

/** `g u a r a n t e e d` → `guaranteed` (≥ 4 single letters separated by single spaces/dots). */
export function collapseSpacedLetters(s: string) {
  return s.replace(/(?<![\p{L}\p{N}])(?:\p{L}[ .\-_*]){3,}\p{L}(?![\p{L}\p{N}])/gu, (m) => m.replace(/[ .\-_*]/g, ""));
}

/** Leetspeak applied ONLY inside tokens that contain letters (so numbers stay numbers). */
export function foldLeetInWords(s: string) {
  const map: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
  return s.replace(/[\p{L}0-9@$]+/gu, (tok) => {
    if (!/\p{L}/u.test(tok) || /^\d/.test(tok)) return tok; // pure numbers, amounts, years untouched
    if (!/[0-9@$]/.test(tok)) return tok;
    return tok.replace(/[013457@$]/g, (c) => map[c] ?? c);
  });
}

export type Normalised = { original: string; text: string };

export function normalise(input: string): Normalised {
  let s = input.normalize("NFKC");
  s = stripInvisibles(s);
  s = s.toLowerCase();
  s = foldConfusables(s);
  s = collapseSpacedLetters(s);
  s = foldLeetInWords(s);
  s = collapseRepeats(s);
  s = s.replace(/[ \t]+/g, " ");
  return { original: input, text: s };
}

// ─── Contact & link extraction ──────────────────────────────────────────────

const BD_MOBILE_RE = /(?<!\d)(?:\+?88[\s-]?0[\s-]?1|01)[3-9](?:[\s.-]?\d){8}(?!\d)/g;
const INTL_PHONE_RE = /(?<![\d+])\+(?!88)\d{1,3}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4}){2,3}(?!\d)/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|xyz|top|bd|io|me|co|ly|gl|gd|at|cc|in|pk|online|site|link|click)\/[^\s<>"'`)\]]*/gi;

export const SHORTENER_DOMAINS = new Set(["bit.ly", "tinyurl.com", "goo.gl", "t.co", "is.gd", "buff.ly", "cutt.ly", "rb.gy", "rebrand.ly", "shorturl.at", "tiny.cc", "t.ly", "s.id", "ow.ly"]);

export type Contacts = { phones: string[]; emails: string[]; urls: string[] };

export function extractContacts(text: string): Contacts {
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    phones: uniq([...(text.match(BD_MOBILE_RE) ?? []), ...(text.match(INTL_PHONE_RE) ?? [])].map((p) => p.replace(/[\s.-]/g, ""))),
    emails: uniq((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase())),
    urls: uniq((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""))),
  };
}

export function hostOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True if host equals domain or is a subdomain of it. */
export function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}
