import { getActor } from "@/lib/auth/current";
import { authorize } from "@/lib/policy/policy";
import { queueCounts } from "@/lib/moderation/service";
import { NavLink } from "@/components/client/nav";
import { ClipboardCheck, Flag, GraduationCap, Icon, Inbox, LayoutDashboard, Power, Scale, ScrollText, Users, type IconNode } from "@/components/icons";

/** Moderation console shell: one permission gate, one navigation, live counts. */
export default async function ModLayout({ children }: { children: React.ReactNode }) {
  // Each page enforces its own permission (and redirects with its exact return path).
  // The shell only renders — and only reads counts — for authorised staff.
  const actor = await getActor();
  if (!actor || !authorize(actor, "staff.moderate").ok) return <>{children}</>;
  const c = await queueCounts();
  const admin = actor.user.role === "admin";
  const items: Array<{ href: string; label: string; icon: IconNode; count?: number; urgent?: boolean; exact?: boolean }> = [
    { href: "/mod", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/mod/queue", label: "Review queue", icon: Inbox, count: c.held },
    { href: "/mod/reports", label: "Reports", icon: Flag, count: c.openReports, urgent: c.p0 > 0 },
    { href: "/mod/mentors", label: "Mentor applications", icon: GraduationCap, count: c.pendingMentors },
    { href: "/mod/appeals", label: "Appeals", icon: Scale, count: c.openAppeals },
    { href: "/mod/disputes", label: "Disputes", icon: ClipboardCheck, count: c.disputes },
    { href: "/mod/users", label: "Members", icon: Users },
    { href: "/mod/settings", label: "Safety settings", icon: Power },
    ...(admin ? [{ href: "/mod/audit", label: "Audit log", icon: ScrollText }] : []),
  ];
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 hidden px-3 lg:block">
          <p className="eyebrow">Moderation</p>
          <p className="mt-1 text-sm text-muted">Signed in as {actor.user.role}</p>
        </div>
        <nav aria-label="Moderation" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {items.map((it) => (
            <NavLink key={it.href} href={it.href} exact={it.exact} className="nav-link shrink-0 whitespace-nowrap">
              <Icon icon={it.icon} />
              <span className="flex-1">{it.label}</span>
              {it.count ? <span className={`count ${it.urgent ? "count-danger" : ""}`}>{it.count}</span> : null}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
