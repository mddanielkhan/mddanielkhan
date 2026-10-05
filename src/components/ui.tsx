import type { ReactNode } from "react";
import { ERRORS, NOTICES, errorMessage } from "@/lib/i18n/messages";
import { trustLevelName } from "@/lib/trust/trust-level";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="muted mt-1 max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

type Tone = "info" | "warn" | "danger" | "success";
const toneClass: Record<Tone, string> = {
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-ink)]",
  warn: "bg-[var(--color-warn-bg)] text-[var(--color-warn-ink)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger-ink)]",
  success: "bg-[var(--color-brand-50)] text-[var(--color-brand-800)] dark:text-[#9fe6bf]",
};

export function Notice({ tone = "info", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`mb-4 rounded-lg px-4 py-3 ${toneClass[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

/** Status messages come from fixed codes in the URL — never free text (no content injection). */
export function Flash({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const n = typeof searchParams?.n === "string" ? searchParams.n : undefined;
  const e = typeof searchParams?.e === "string" ? searchParams.e : undefined;
  const ref = typeof searchParams?.ref === "string" && /^[0-9a-f]{8}$/.test(searchParams.ref) ? searchParams.ref : undefined;
  return (
    <>
      {n && NOTICES[n] ? <Notice tone="success">{NOTICES[n]}</Notice> : null}
      {e ? (
        <Notice tone="danger">
          {ERRORS[e] ?? errorMessage(e)}
          {ref ? <span className="block text-sm opacity-80">Reference: {ref}</span> : null}
        </Notice>
      ) : null}
    </>
  );
}

export function Field({ label, name, hint, error, children }: { label: string; name: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="mb-1 block font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="muted mt-1 text-sm">
          {hint}
        </p>
      ) : null}
      {error ? <p className="mt-1 text-sm text-[var(--color-danger-ink)]">{error}</p> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: ReactNode };
export function TextField({ label, name, hint, ...rest }: InputProps) {
  return (
    <Field label={label} name={name} hint={hint}>
      <input id={name} name={name} className="input" aria-describedby={hint ? `${name}-hint` : undefined} {...rest} />
    </Field>
  );
}

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string; hint?: ReactNode };
export function TextArea({ label, name, hint, rows = 6, ...rest }: AreaProps) {
  return (
    <Field label={label} name={name} hint={hint}>
      <textarea id={name} name={name} rows={rows} className="input" aria-describedby={hint ? `${name}-hint` : undefined} {...rest} />
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; hint?: ReactNode; options: Array<{ value: string | number; label: string }> };
export function SelectField({ label, name, hint, options, ...rest }: SelectProps) {
  return (
    <Field label={label} name={name} hint={hint}>
      <select id={name} name={name} className="input" aria-describedby={hint ? `${name}-hint` : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({ name, label, defaultChecked, required }: { name: string; label: ReactNode; defaultChecked?: boolean; required?: boolean }) {
  return (
    <label className="mb-3 flex items-start gap-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} required={required} className="mt-1 h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

export function Pill({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "brand" | "warn" | "danger" | "info"; title?: string }) {
  const tones = {
    neutral: "border-[var(--color-line)] text-[var(--color-muted)]",
    brand: "border-transparent bg-[var(--color-brand-50)] text-[var(--color-brand-800)] dark:text-[#9fe6bf]",
    warn: "border-transparent bg-[var(--color-warn-bg)] text-[var(--color-warn-ink)]",
    danger: "border-transparent bg-[var(--color-danger-bg)] text-[var(--color-danger-ink)]",
    info: "border-transparent bg-[var(--color-info-bg)] text-[var(--color-info-ink)]",
  } as const;
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function TrustPill({ level }: { level: number }) {
  return (
    <Pill tone={level >= 3 ? "brand" : "neutral"} title="Trust level: earned through consistent, rule-following participation. Cannot be bought.">
      TL{level} · {trustLevelName(level)}
    </Pill>
  );
}

// Fixed class lists (no inline style attributes: the strict CSP forbids them).
const AVATAR_COLORS = ["bg-[#1f6f4a]", "bg-[#285e8e]", "bg-[#7a4a1f]", "bg-[#6b3f8f]", "bg-[#8f3f5c]", "bg-[#3f6b8f]", "bg-[#5c6b1f]", "bg-[#8f5c3f]"];
const AVATAR_SIZES = { 36: "h-9 w-9 text-sm", 40: "h-10 w-10 text-base", 48: "h-12 w-12 text-lg", 72: "h-[72px] w-[72px] text-2xl" } as const;

export function Avatar({ name, size = 40 }: { name: string; size?: keyof typeof AVATAR_SIZES }) {
  const initials = name
    .split(/\s+/)
    .map((p) => [...p][0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${AVATAR_SIZES[size]} ${AVATAR_COLORS[h % AVATAR_COLORS.length]}`}>
      {initials || "?"}
    </span>
  );
}

const BD_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });
const BD_DATETIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return BD_DATE.format(typeof d === "string" ? new Date(d) : d);
}
export function formatDateTime(d: Date | null | undefined) {
  if (!d) return "";
  return `${BD_DATETIME.format(d)} (BD time)`;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="muted mt-2">{children}</div> : null}
    </div>
  );
}

export const POST_TYPE_LABEL: Record<string, string> = {
  question: "Question",
  discussion: "Discussion",
  guide: "Guide",
  opportunity: "Opportunity",
  story: "Success story",
  safety_alert: "Safety alert",
};
