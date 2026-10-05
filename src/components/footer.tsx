import Link from "next/link";
import { BRAND } from "@/lib/config/brand";
import { t, type Locale } from "@/lib/i18n/messages";
import { env } from "@/lib/env";
import { Logo } from "./logo";
import { Icon, Lock } from "./icons";

function Column({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="font-medium text-ink-soft no-underline hover:text-ink hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  const e = env();
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-app py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">{locale === "bn" ? BRAND.taglineBn : BRAND.tagline}</p>
            <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm font-semibold text-brand-800">
              <Icon icon={Lock} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{locale === "bn" ? BRAND.goldenRuleBn : BRAND.goldenRule}</span>
            </p>
          </div>
          <Column
            title={t(locale, "footer_col_explore")}
            links={[
              ["/feed", t(locale, "nav_community")],
              ["/opportunities", t(locale, "nav_opportunities")],
              ["/mentors", t(locale, "nav_mentors")],
              ["/mentors/apply", t(locale, "nav_become_mentor")],
            ]}
          />
          <Column
            title={t(locale, "footer_col_safety")}
            links={[
              ["/safety", t(locale, "footer_safety_centre")],
              ["/guidelines", t(locale, "footer_guidelines")],
              ["/report-concern", t(locale, "footer_report")],
              ["/transparency", t(locale, "footer_transparency")],
            ]}
          />
          <Column
            title={t(locale, "footer_col_about")}
            links={[
              ["/about", t(locale, "footer_about")],
              ["/security", t(locale, "footer_security")],
              ["/privacy", t(locale, "footer_privacy")],
              ["/terms", t(locale, "footer_terms")],
            ]}
          />
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-sm text-muted lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.name} (<span lang="bn">{BRAND.nameBn}</span>) · {t(locale, "footer_no_ads")}
          </p>
          <p>
            {t(locale, "footer_grievance")}: {e.GRIEVANCE_OFFICER_NAME} · <a href={`mailto:${e.GRIEVANCE_OFFICER_EMAIL}`}>{e.GRIEVANCE_OFFICER_EMAIL}</a>
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">{t(locale, "footer_disclaimer")}</p>
      </div>
    </footer>
  );
}
