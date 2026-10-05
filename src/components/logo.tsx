import Link from "next/link";
import { BRAND } from "@/lib/config/brand";

/** Brand mark: two equal rings, interlocked — two peers, linked. Mirrors public/icon.svg. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#157a46" />
      <circle cx="12.4" cy="16" r="5.6" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="19.6" cy="16" r="5.6" fill="none" stroke="#9fe3bf" strokeWidth="2.5" />
      {/* The white ring passes over the mint one at the top crossing: cut the mint ring, then redraw white past the cut. */}
      <path d="M13.56 10.52A5.6 5.6 0 0 1 17.59 13.9" fill="none" stroke="#157a46" strokeWidth="4.7" />
      <path d="M12.79 10.41A5.6 5.6 0 0 1 17.83 14.65" fill="none" stroke="#fff" strokeWidth="2.5" />
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
