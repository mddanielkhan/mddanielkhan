import Link from "next/link";
import { BRAND } from "@/lib/config/brand";
import { t, type Locale } from "@/lib/i18n/messages";
import { env } from "@/lib/env";

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-16 border-t border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm">
        <p className="mb-4 rounded-lg bg-[var(--color-brand-50)] px-4 py-3 font-semibold text-[var(--color-brand-800)] dark:text-[#9fe6bf]">
          🔒 {locale === "bn" ? BRAND.goldenRuleBn : BRAND.goldenRule}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about">{t(locale, "footer_about")}</Link>
          <Link href="/guidelines">{t(locale, "footer_guidelines")}</Link>
          <Link href="/safety">{t(locale, "nav_safety")}</Link>
          <Link href="/privacy">{t(locale, "footer_privacy")}</Link>
          <Link href="/terms">{t(locale, "footer_terms")}</Link>
          <Link href="/transparency">{t(locale, "footer_transparency")}</Link>
          <Link href="/security">{t(locale, "footer_security")}</Link>
          <Link href="/report-concern">{t(locale, "footer_report")}</Link>
        </nav>
        <p className="muted mt-4">
          Grievance Officer: {env().GRIEVANCE_OFFICER_NAME} · <a href={`mailto:${env().GRIEVANCE_OFFICER_EMAIL}`}>{env().GRIEVANCE_OFFICER_EMAIL}</a> · Mentoring here is peer guidance, not legal, immigration, medical or financial advice.
        </p>
        <p className="muted mt-1">
          © {new Date().getFullYear()} {BRAND.name} ({BRAND.nameBn}). No ads. No data selling. No trackers.
        </p>
      </div>
    </footer>
  );
}
