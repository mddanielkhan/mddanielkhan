import Link from "next/link";
import { BRAND } from "@/lib/config/brand";

/** Brand mark: a sprout above the ground line with its roots below — শিকড় means "roots". */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#157a46" />
      <path d="M16 21.5V12.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16.2 14.2c.1-3.6 2.7-6.3 6.3-6.4-.1 3.6-2.7 6.3-6.3 6.4Z" fill="#fff" />
      <path d="M15.8 16.6c-.1-2.9-2.3-5.1-5.2-5.2.1 2.9 2.3 5.1 5.2 5.2Z" fill="#bfe9d1" />
      <path d="M8.5 21.5h15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 21.5v4M16 23.4l-3.2 2.3M16 23.4l3.2 2.3" stroke="#9fe3bf" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg text-ink no-underline" aria-label={`${BRAND.name} home`}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[1.1875rem] font-extrabold tracking-tight">{BRAND.name}</span>
        {compact ? null : (
          <span lang="bn" className="mt-0.5 text-[0.6875rem] font-semibold text-muted">
            {BRAND.nameBn}
          </span>
        )}
      </span>
    </Link>
  );
}
