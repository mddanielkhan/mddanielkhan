import Link from "next/link";
import { BRAND } from "@/lib/config/brand";
import { t, type Locale } from "@/lib/i18n/messages";
import type { Actor } from "@/lib/policy/policy";
import { isStaffRole } from "@/lib/policy/policy";
import { ActionButton } from "./form";

export function Header({ actor, locale, unread }: { actor: Actor; locale: Locale; unread: number }) {
  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-[var(--color-ink)] no-underline">
          <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] text-white">
            শ
          </span>
          {BRAND.name}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-4 text-sm font-medium">
          <Link href="/feed">{t(locale, "nav_community")}</Link>
          <Link href="/opportunities">{t(locale, "nav_opportunities")}</Link>
          <Link href="/mentors">{t(locale, "nav_mentors")}</Link>
          <Link href="/safety">{t(locale, "nav_safety")}</Link>
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <ActionButton action="/api/locale" fields={{ locale: locale === "en" ? "bn" : "en" }} variant="link">
            {locale === "en" ? "বাংলা" : "English"}
          </ActionButton>
          {actor ? (
            <>
              <Link href="/posts/new" className="btn btn-primary">
                {t(locale, "nav_ask")}
              </Link>
              <Link href="/bookings">{t(locale, "nav_bookings")}</Link>
              <Link href="/notifications" aria-label={`${t(locale, "nav_notifications")}${unread ? ` (${unread} unread)` : ""}`}>
                🔔{unread ? <span className="ml-1 rounded-full bg-[var(--color-brand-600)] px-1.5 text-xs text-white">{unread > 99 ? "99+" : unread}</span> : null}
              </Link>
              {isStaffRole(actor.user.role) ? <Link href="/mod">{t(locale, "nav_mod")}</Link> : null}
              <Link href={`/u/${actor.user.username}`}>{actor.user.displayName}</Link>
              <Link href="/settings">{t(locale, "nav_settings")}</Link>
              <ActionButton action="/api/auth/logout" variant="link">
                {t(locale, "nav_logout")}
              </ActionButton>
            </>
          ) : (
            <>
              <Link href="/login">{t(locale, "nav_login")}</Link>
              <Link href="/register" className="btn btn-primary">
                {t(locale, "nav_join")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
