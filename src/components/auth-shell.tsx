import type { ReactNode } from "react";
import { BRAND } from "@/lib/config/brand";
import { LogoMark } from "./logo";
import { BadgeCheck, Icon, KeyRound, Lock, ShieldCheck } from "./icons";

const POINTS = [
  { icon: Lock, title: "Free, always", body: "Nobody on Shikor may ask you for money. Sessions with mentors cost nothing." },
  { icon: BadgeCheck, title: "Real people, checked", body: "Mentors are approved by a moderator after a credential review." },
  { icon: KeyRound, title: "Your account, protected", body: "Argon2id passwords, optional 2FA, and you can sign out any device." },
];

/** Two-panel layout for sign-in and sign-up: the form, and why it is safe to be here. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-line bg-surface shadow-md lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="p-6 sm:p-10">
        <LogoMark className="h-10 w-10" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
        <div className="mt-7">{children}</div>
        {footer ? <div className="mt-6 border-t border-line pt-5 text-sm text-muted">{footer}</div> : null}
      </div>
      <aside className="band-brand relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
        <div className="relative">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-200">
            {BRAND.name} · <span lang="bn">{BRAND.nameBn}</span>
          </p>
          <p className="mt-3 text-2xl font-bold leading-snug text-white">Honest guidance from people who&apos;ve been there.</p>
        </div>
        <ul className="relative mt-10 space-y-6">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-200 ring-1 ring-white/15">
                <Icon icon={p.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold text-white">{p.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-[#cfe9db]">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="relative mt-10 flex items-center gap-2 text-xs text-[#a9d6bd]">
          <Icon icon={ShieldCheck} className="h-4 w-4" />
          We will never ask for your password or a code by phone, email or message.
        </p>
      </aside>
    </div>
  );
}

/** Single focused card for short steps (2FA, reset, confirm). */
export function AuthCard({ title, subtitle, children, footer, icon }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 shadow-md sm:p-9">
        {icon ?? <LogoMark className="h-10 w-10" />}
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <div className="mt-2 text-muted">{subtitle}</div> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </div>
  );
}
