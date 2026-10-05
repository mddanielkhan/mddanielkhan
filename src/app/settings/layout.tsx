import Link from "next/link";
import { getActor } from "@/lib/auth/current";
import { NavLink } from "@/components/client/nav";
import { Avatar } from "@/components/ui";
import { ArrowUpRight, GraduationCap, Icon, KeyRound, Lock, UserRound } from "@/components/icons";

const ITEMS = [
  { href: "/settings", label: "Profile", icon: UserRound, exact: true },
  { href: "/settings/security", label: "Security & devices", icon: KeyRound },
  { href: "/settings/verify-institution", label: "Verify institution", icon: GraduationCap },
  { href: "/settings/privacy", label: "Privacy & data", icon: Lock },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  // Pages enforce sign-in themselves so deep links (e.g. a confirmation token) keep their return path.
  const actor = await getActor();
  if (!actor) return <>{children}</>;
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 hidden items-center gap-3 px-3 lg:flex">
          <Avatar name={actor.user.displayName} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{actor.user.displayName}</p>
            <Link href={`/u/${actor.user.username}`} className="flex items-center gap-0.5 text-xs font-semibold text-muted no-underline hover:text-ink">
              View public profile <Icon icon={ArrowUpRight} className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <nav aria-label="Settings" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {ITEMS.map((it) => (
            <NavLink key={it.href} href={it.href} exact={it.exact} className="nav-link shrink-0 whitespace-nowrap">
              <Icon icon={it.icon} />
              {it.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </div>
  );
}
