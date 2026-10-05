import Link from "next/link";

export function ModNav({ current, counts }: { current: string; counts?: Partial<Record<string, number>> }) {
  const items = [
    ["dashboard", "/mod", "Overview"],
    ["queue", "/mod/queue", "Review queue"],
    ["reports", "/mod/reports", "Reports"],
    ["mentors", "/mod/mentors", "Mentor applications"],
    ["appeals", "/mod/appeals", "Appeals"],
    ["disputes", "/mod/disputes", "Disputes"],
    ["users", "/mod/users", "Members"],
    ["settings", "/mod/settings", "Safety settings"],
    ["audit", "/mod/audit", "Audit log"],
  ] as const;
  return (
    <nav aria-label="Moderation" className="mb-6 flex flex-wrap gap-4 border-b border-[var(--color-line)] pb-2 text-sm">
      {items.map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={current === key ? "page" : undefined} className={current === key ? "font-semibold" : "muted"}>
          {label}
          {counts?.[key] ? <span className="ml-1 rounded-full bg-[var(--color-danger-ink)] px-1.5 text-xs text-white">{counts[key]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
