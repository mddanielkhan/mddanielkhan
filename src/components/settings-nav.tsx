import Link from "next/link";

export function SettingsNav({ current }: { current: "profile" | "security" | "privacy" | "institution" }) {
  const items = [
    ["profile", "/settings", "Profile"],
    ["security", "/settings/security", "Security & devices"],
    ["institution", "/settings/verify-institution", "Verify institution"],
    ["privacy", "/settings/privacy", "Privacy & data"],
  ] as const;
  return (
    <nav aria-label="Settings" className="mb-6 flex flex-wrap gap-4 border-b border-[var(--color-line)] pb-2 text-sm">
      {items.map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={current === key ? "page" : undefined} className={current === key ? "font-semibold" : "muted"}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
