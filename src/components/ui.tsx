import Link from "next/link";
import type { ReactNode } from "react";
import { ERRORS, NOTICES, NOTICE_TONES, errorMessage } from "@/lib/i18n/messages";
import { trustLevelName } from "@/lib/trust/trust-level";
import { daysUntil } from "@/lib/format";
import {
  BookOpen,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Compass,
  Icon,
  Info,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  StarHalf,
  TriangleAlert,
  type IconNode,
} from "./icons";

/* ───────────────────────────── Layout ───────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  breadcrumbs,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumbs?: Array<{ href?: string; label: string }>;
  className?: string;
}) {
  return (
    <header className={`mb-8 ${className}`}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2.125rem]">{title}</h1>
          {subtitle ? <div className="mt-2 text-base leading-relaxed text-muted sm:text-[1.0625rem]">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <Icon icon={ChevronRight} className="h-3.5 w-3.5" /> : null}
            {it.href ? (
              <Link href={it.href} className="font-medium text-muted no-underline hover:text-ink">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink-soft">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "section";

/** A titled region of a page. */
export function Section({
  title,
  description,
  action,
  children,
  id,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const hid = id ?? `s-${slug(title)}`;
  return (
    <section aria-labelledby={hid} className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={hid} className="text-xl font-bold tracking-tight">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "", padding = "md" }: { children: ReactNode; className?: string; padding?: "none" | "sm" | "md" | "lg" }) {
  const pad = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" }[padding];
  return <div className={`card ${pad} ${className}`}>{children}</div>;
}

/** A card with a header bar, body and optional footer — the standard container for forms and settings. */
export function Panel({
  title,
  description,
  actions,
  children,
  footer,
  id,
  tone = "default",
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  id?: string;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <section id={id} className={`card overflow-hidden ${tone === "danger" ? "border-[var(--color-danger-line)]" : ""} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className={`text-base font-bold ${tone === "danger" ? "text-[var(--color-danger-ink)]" : ""}`}>{title}</h2>
          {description ? <div className="mt-0.5 text-sm leading-relaxed text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {footer ? <div className="border-t border-line bg-subtle px-5 py-3 text-sm text-muted sm:px-6">{footer}</div> : null}
    </section>
  );
}

/* ──────────────────────────── Feedback ──────────────────────────── */

type Tone = "info" | "warn" | "danger" | "success";
const NOTICE_STYLE: Record<Tone, { box: string; icon: IconNode }> = {
  info: { box: "border-[var(--color-info-line)] bg-[var(--color-info-bg)] text-[var(--color-info-ink)]", icon: Info },
  warn: { box: "border-[var(--color-warn-line)] bg-[var(--color-warn-bg)] text-[var(--color-warn-ink)]", icon: TriangleAlert },
  danger: { box: "border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] text-[var(--color-danger-ink)]", icon: CircleAlert },
  success: { box: "border-brand-200 bg-[var(--color-success-bg)] text-[var(--color-success-ink)]", icon: CircleCheck },
};

export function Notice({ tone = "info", children, title, className = "mb-5", icon }: { tone?: Tone; children?: ReactNode; title?: ReactNode; className?: string; icon?: IconNode }) {
  const s = NOTICE_STYLE[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-xl border px-4 py-3.5 ${s.box} ${className}`}>
      <Icon icon={icon ?? s.icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
      </div>
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
      {n && NOTICES[n] ? <Notice tone={NOTICE_TONES[n] ?? "success"}>{NOTICES[n]}</Notice> : null}
      {e ? (
        <Notice tone="danger">
          {ERRORS[e] ?? errorMessage(e)}
          {ref ? <span className="mt-1 block text-sm opacity-80">Reference: {ref}</span> : null}
        </Notice>
      ) : null}
    </>
  );
}

export function EmptyState({ title, children, icon = Sparkles, action, className = "" }: { title: string; children?: ReactNode; icon?: IconNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`card flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <span className="icon-tile icon-tile-neutral mb-4 h-12 w-12 rounded-2xl">
        <Icon icon={icon} className="h-6 w-6" />
      </span>
      <p className="text-base font-bold">{title}</p>
      {children ? <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ───────────────────────────── Forms ───────────────────────────── */

export function Field({ label, name, hint, error, optional, children, className = "" }: { label: ReactNode; name: string; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={name} className="label">
        {label}
        {optional ? <span className="label-optional">Optional</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-sm font-medium text-[var(--color-danger-ink)]">{error}</p> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; name: string; hint?: ReactNode; optional?: boolean; fieldClassName?: string };
export function TextField({ label, name, hint, optional, fieldClassName, id, ...rest }: InputProps) {
  const fid = id ?? name;
  return (
    <Field label={label} name={fid} hint={hint} optional={optional} className={fieldClassName}>
      <input id={fid} name={name} className="input" aria-describedby={hint ? `${fid}-hint` : undefined} {...rest} />
    </Field>
  );
}

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; name: string; hint?: ReactNode; optional?: boolean; fieldClassName?: string };
export function TextArea({ label, name, hint, rows = 6, optional, fieldClassName, id, ...rest }: AreaProps) {
  const fid = id ?? name;
  return (
    <Field label={label} name={fid} hint={hint} optional={optional} className={fieldClassName}>
      <textarea id={fid} name={name} rows={rows} className="input" aria-describedby={hint ? `${fid}-hint` : undefined} {...rest} />
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  optional?: boolean;
  fieldClassName?: string;
  options: Array<{ value: string | number; label: string }>;
};
export function SelectField({ label, name, hint, options, optional, fieldClassName, id, ...rest }: SelectProps) {
  const fid = id ?? name;
  return (
    <Field label={label} name={fid} hint={hint} optional={optional} className={fieldClassName}>
      <select id={fid} name={name} className="input" aria-describedby={hint ? `${fid}-hint` : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({ name, label, description, defaultChecked, required, value }: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean; required?: boolean; value?: string }) {
  return (
    <label className="choice mb-3">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} required={required} />
      <span className="min-w-0">
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Visual grouping for a long form: a heading on the left, fields on the right (stacks on mobile). */
export function FormSection({ title, description, children, last = false }: { title: string; description?: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <div className={`grid gap-x-8 gap-y-4 py-6 md:grid-cols-[14rem_minmax(0,1fr)] ${last ? "" : "border-b border-line"}`}>
      <div>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ─────────────────────────── Data display ─────────────────────────── */

type PillTone = "neutral" | "brand" | "warn" | "danger" | "info" | "gold" | "solid";
const PILL_CLASS: Record<PillTone, string> = {
  neutral: "badge",
  brand: "badge badge-brand",
  warn: "badge badge-warn",
  danger: "badge badge-danger",
  info: "badge badge-info",
  gold: "badge badge-gold",
  solid: "badge badge-solid",
};

export function Pill({ children, tone = "neutral", title, icon, className = "" }: { children: ReactNode; tone?: PillTone; title?: string; icon?: IconNode; className?: string }) {
  return (
    <span title={title} className={`${PILL_CLASS[tone]} ${className}`}>
      {icon ? <Icon icon={icon} /> : null}
      {children}
    </span>
  );
}

export function TrustPill({ level }: { level: number }) {
  return (
    <Pill tone={level >= 3 ? "brand" : "neutral"} icon={Shield} title="Trust level: earned through consistent, rule-following participation. Cannot be bought.">
      TL{level} · {trustLevelName(level)}
    </Pill>
  );
}

export function Stat({ label, value, hint, icon, tone = "brand", href }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconNode; tone?: "brand" | "gold" | "danger" | "info" | "neutral"; href?: string }) {
  const body = (
    <div className="flex items-start gap-4">
      {icon ? (
        <span className={`icon-tile ${tone === "brand" ? "" : `icon-tile-${tone}`}`}>
          <Icon icon={icon} />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="card card-interactive block p-5 no-underline">
      {body}
    </Link>
  ) : (
    <div className="card p-5">{body}</div>
  );
}

export function Tabs({ items, label }: { items: Array<{ href: string; label: string; current: boolean; count?: number }>; label: string }) {
  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <div className="tabs">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="tab" aria-current={it.current ? "page" : undefined}>
            {it.label}
            {it.count ? <span className="count">{it.count}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Five stars in half-star steps (never rounded up to a full star), plus the exact score for screen readers. */
export function Stars({ score, className = "h-4 w-4" }: { score: number; className?: string }) {
  const s = Math.max(0, Math.min(5, score));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${s.toFixed(1)} out of 5`} role="img">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = s >= i + 0.75 ? "full" : s >= i + 0.25 ? "half" : "empty";
        return (
          <span key={i} className="relative inline-flex">
            <Icon icon={Star} className={`${className} ${fill === "full" ? "fill-current text-gold-500" : "text-line-strong"}`} />
            {fill === "half" ? <Icon icon={StarHalf} className={`${className} absolute inset-0 fill-current text-gold-500`} /> : null}
          </span>
        );
      })}
    </span>
  );
}

const PCT = ["w-pct-0", "w-pct-5", "w-pct-10", "w-pct-15", "w-pct-20", "w-pct-25", "w-pct-30", "w-pct-35", "w-pct-40", "w-pct-45", "w-pct-50", "w-pct-55", "w-pct-60", "w-pct-65", "w-pct-70", "w-pct-75", "w-pct-80", "w-pct-85", "w-pct-90", "w-pct-95", "w-pct-100"];

/** A horizontal meter for a 0–1 value (rendered in 5 % steps — no inline styles under our CSP). */
export function Meter({ value, label }: { value: number; label: string }) {
  const idx = Math.round(Math.max(0, Math.min(1, value)) * 20);
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span className={PCT[idx]} />
    </div>
  );
}

export function Steps({ steps, label }: { steps: Array<{ label: string; state: "done" | "current" | "todo" | "stopped" }>; label: string }) {
  return (
    <ol className="steps" aria-label={label}>
      {steps.map((s) => (
        <li key={s.label} className="step" data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export function DescriptionList({ items, className = "" }: { items: Array<[ReactNode, ReactNode] | null | false>; className?: string }) {
  return (
    <dl className={`divide-y divide-line text-sm ${className}`}>
      {items.filter(Boolean).map((it, i) => {
        const [k, v] = it as [ReactNode, ReactNode];
        return (
          <div key={i} className="grid grid-cols-1 gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
            <dt className="font-medium text-muted">{k}</dt>
            <dd className="min-w-0 break-words text-ink">{v}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// Fixed class lists (no inline style attributes: the strict CSP forbids them).
const AVATAR_COLORS = ["bg-[#1d6b47]", "bg-[#25618a]", "bg-[#7b4b22]", "bg-[#5f3f8a]", "bg-[#8a3a58]", "bg-[#2f6c74]", "bg-[#596a1f]", "bg-[#8a5233]"];
const AVATAR_SIZES = {
  24: "h-6 w-6 text-[0.625rem]",
  32: "h-8 w-8 text-xs",
  36: "h-9 w-9 text-sm",
  40: "h-10 w-10 text-sm",
  48: "h-12 w-12 text-base",
  56: "h-14 w-14 text-lg",
  72: "h-[72px] w-[72px] text-2xl",
  96: "h-24 w-24 text-3xl",
} as const;

export function Avatar({ name, size = 40, ring = false }: { name: string; size?: keyof typeof AVATAR_SIZES; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => [...p][0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold tracking-wide text-white ${AVATAR_SIZES[size]} ${AVATAR_COLORS[h % AVATAR_COLORS.length]} ${ring ? "ring-4 ring-[var(--color-surface)]" : ""}`}
    >
      {initials || "?"}
    </span>
  );
}

/* ───────────────────────────── Dates ───────────────────────────── */

export { daysUntil, formatDate, formatDateTime, formatSlot, timeAgo } from "@/lib/format";

export function DeadlinePill({ deadline }: { deadline: string | null }) {
  if (!deadline) return <Pill>Rolling</Pill>;
  const d = daysUntil(deadline);
  if (d < 0) return <Pill>Closed</Pill>;
  if (d === 0) return <Pill tone="danger">Closes today</Pill>;
  return <Pill tone={d <= 7 ? "danger" : d <= 30 ? "warn" : "neutral"}>{d === 1 ? "1 day left" : `${d} days left`}</Pill>;
}

/* ──────────────────────────── Content ──────────────────────────── */

export const POST_TYPE_LABEL: Record<string, string> = {
  question: "Question",
  discussion: "Discussion",
  guide: "Guide",
  opportunity: "Opportunity",
  story: "Success story",
  safety_alert: "Safety alert",
};

const POST_TYPE_META: Record<string, { icon: IconNode; tone: PillTone }> = {
  question: { icon: MessageSquareText, tone: "neutral" },
  discussion: { icon: MessagesSquare, tone: "neutral" },
  guide: { icon: BookOpen, tone: "brand" },
  opportunity: { icon: Compass, tone: "info" },
  story: { icon: Sparkles, tone: "gold" },
  safety_alert: { icon: ShieldAlert, tone: "danger" },
};

export function PostTypeBadge({ type }: { type: string }) {
  const meta = POST_TYPE_META[type] ?? { icon: Megaphone, tone: "neutral" as const };
  return (
    <Pill tone={meta.tone} icon={meta.icon}>
      {POST_TYPE_LABEL[type] ?? type}
    </Pill>
  );
}
