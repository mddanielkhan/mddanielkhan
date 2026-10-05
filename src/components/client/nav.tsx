"use client";

/*
 * The only client-side code in the app shell. Both components progressively
 * enhance plain HTML: links work and <details> menus open without JavaScript;
 * with it, the current page is marked and menus close the way people expect.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export function NavLink({ href, children, className, exact = false, match }: { href: string; children: ReactNode; className?: string; exact?: boolean; match?: string }) {
  const pathname = usePathname() ?? "";
  const base = match ?? href;
  const active = exact ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
  return (
    <Link href={href} className={className} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

/** A <details> disclosure that closes on navigation, outside click and Escape. */
export function Disclosure({ summary, summaryClassName, summaryLabel, children, className, testId }: { summary: ReactNode; summaryClassName?: string; summaryLabel: string; children: ReactNode; className?: string; testId?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className={className} data-testid={testId}>
      <summary className={summaryClassName} aria-label={summaryLabel}>
        {summary}
      </summary>
      {children}
    </details>
  );
}
