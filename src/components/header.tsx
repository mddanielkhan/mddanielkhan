import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/messages";
import type { Actor } from "@/lib/policy/policy";
import { isStaffRole } from "@/lib/policy/policy";
import { Form } from "./form";
import { Avatar } from "./ui";
import { Logo } from "./logo";
import { Disclosure, NavLink } from "./client/nav";
import { Bell, BookOpen, CalendarDays, ChevronDown, Compass, GraduationCap, Icon, Languages, LayoutDashboard, LogOut, Menu, Plus, Scale, Settings, ShieldCheck, User, Users } from "./icons";

const MAIN_NAV = [
  { href: "/feed", key: "nav_community", icon: Users },
  { href: "/opportunities", key: "nav_opportunities", icon: Compass },
  { href: "/mentors", key: "nav_mentors", icon: GraduationCap },
  { href: "/safety", key: "nav_safety", icon: ShieldCheck },
] as const;

function LocaleSwitch({ locale }: { locale: Locale }) {
  return (
    <Form action="/api/locale" className="inline">
      <input type="hidden" name="locale" value={locale === "en" ? "bn" : "en"} />
      <button type="submit" className="btn btn-ghost btn-sm gap-1.5 px-2.5" aria-label={locale === "en" ? "বাংলায় দেখুন (switch to Bangla)" : "Switch to English"}>
        <Icon icon={Languages} />
        <span lang={locale === "en" ? "bn" : "en"}>{locale === "en" ? "বাংলা" : "English"}</span>
      </button>
    </Form>
  );
}

function AccountMenu({ actor, locale, mentorStatus }: { actor: NonNullable<Actor>; locale: Locale; mentorStatus: string | null }) {
  const u = actor.user;
  const staff = isStaffRole(u.role);
  const mentoring = mentorStatus === "approved" || mentorStatus === "paused" || mentorStatus === "pending" ? { href: "/mentor", label: t(locale, "nav_mentoring") } : { href: "/mentors/apply", label: t(locale, "nav_become_mentor") };
  return (
    <Disclosure
      className="relative"
      testId="account-menu"
      summaryLabel={`${t(locale, "nav_account")}: ${u.displayName}`}
      summaryClassName="flex items-center gap-2 rounded-full p-0.5 pr-1.5 hover:bg-subtle sm:pr-2"
      summary={
        <>
          <Avatar name={u.displayName} size={32} />
          <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-ink lg:inline">{u.displayName}</span>
          <Icon icon={ChevronDown} className="hidden h-4 w-4 text-muted sm:block" />
        </>
      }
    >
      <div className="menu-panel right-0 mt-2 w-64">
        <div className="flex items-center gap-3 border-b border-line px-2.5 pb-3 pt-2">
          <Avatar name={u.displayName} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{u.displayName}</p>
            <p className="truncate text-xs text-muted">@{u.username}</p>
          </div>
        </div>
        <nav aria-label="Account" className="py-1.5">
          <Link href={`/u/${u.username}`} className="menu-item">
            <Icon icon={User} />
            {t(locale, "nav_profile")}
          </Link>
          <Link href="/bookings" className="menu-item">
            <Icon icon={CalendarDays} />
            {t(locale, "nav_bookings")}
          </Link>
          <Link href={mentoring.href} className="menu-item">
            <Icon icon={BookOpen} />
            {mentoring.label}
          </Link>
          {staff ? (
            <Link href="/mod" className="menu-item">
              <Icon icon={Scale} />
              {t(locale, "nav_mod")}
            </Link>
          ) : null}
          <Link href="/settings" className="menu-item">
            <Icon icon={Settings} />
            {t(locale, "nav_settings")}
          </Link>
        </nav>
        <div className="border-t border-line pt-1.5">
          <Form action="/api/auth/logout">
            <button type="submit" className="menu-item">
              <Icon icon={LogOut} />
              {t(locale, "nav_logout")}
            </button>
          </Form>
        </div>
      </div>
    </Disclosure>
  );
}

function MobileMenu({ actor, locale }: { actor: Actor; locale: Locale }) {
  return (
    <Disclosure className="md:hidden" summaryLabel={t(locale, "nav_menu")} summaryClassName="btn btn-ghost btn-icon" summary={<Icon icon={Menu} className="h-5 w-5" />}>
      <div className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-lg">
        <nav aria-label="Main" className="container-app grid gap-1 py-3">
          {MAIN_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} className="nav-link">
              <Icon icon={n.icon} />
              {t(locale, n.key)}
            </NavLink>
          ))}
          {actor ? (
            <Link href="/posts/new" className="btn btn-primary mt-2">
              <Icon icon={Plus} />
              {t(locale, "nav_ask")}
            </Link>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/login" className="btn btn-secondary">
                {t(locale, "nav_login")}
              </Link>
              <Link href="/register" className="btn btn-primary">
                {t(locale, "nav_join")}
              </Link>
            </div>
          )}
        </nav>
      </div>
    </Disclosure>
  );
}

export function Header({ actor, locale, unread, mentorStatus }: { actor: Actor; locale: Locale; unread: number; mentorStatus: string | null }) {
  return (
    <header className="app-header">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="container-app relative flex h-16 items-center gap-2">
        <Logo />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-0.5 md:flex">
          {MAIN_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} className="header-link">
              {t(locale, n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <LocaleSwitch locale={locale} />
          {actor ? (
            <>
              <Link href="/posts/new" className="btn btn-primary btn-sm ml-1 hidden sm:inline-flex">
                <Icon icon={Plus} />
                {t(locale, "nav_ask")}
              </Link>
              {isStaffRole(actor.user.role) ? (
                <Link href="/mod" className="btn btn-ghost btn-icon hidden lg:inline-flex" aria-label={t(locale, "nav_mod")} title={t(locale, "nav_mod")}>
                  <Icon icon={LayoutDashboard} />
                </Link>
              ) : null}
              <Link href="/notifications" className="btn btn-ghost btn-icon relative" aria-label={`${t(locale, "nav_notifications")}${unread ? ` (${unread} unread)` : ""}`} title={t(locale, "nav_notifications")}>
                <Icon icon={Bell} />
                {unread ? <span className="count absolute -right-0.5 -top-0.5 ring-2 ring-[var(--color-surface)]">{unread > 99 ? "99+" : unread}</span> : null}
              </Link>
              <AccountMenu actor={actor} locale={locale} mentorStatus={mentorStatus} />
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                {t(locale, "nav_login")}
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                {t(locale, "nav_join")}
              </Link>
            </>
          )}
          <MobileMenu actor={actor} locale={locale} />
        </div>
      </div>
    </header>
  );
}
