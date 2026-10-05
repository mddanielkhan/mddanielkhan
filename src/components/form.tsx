import type { ReactNode } from "react";
import { csrfToken } from "@/lib/auth/current";
import { CSRF_FIELD } from "@/lib/security/csrf";
import { Icon, type IconNode } from "./icons";

/**
 * Plain HTML form posting to a route handler. Works without JavaScript (low-end
 * phones, slow networks) and always carries the CSRF token + a safe return path.
 */
export async function Form({ action, back, children, className = "" }: { action: string; back?: string; children: ReactNode; className?: string }) {
  const token = await csrfToken();
  return (
    <form method="post" action={action} className={className}>
      <input type="hidden" name={CSRF_FIELD} value={token} />
      {back ? <input type="hidden" name="_back" value={back} /> : null}
      {children}
    </form>
  );
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-soft" | "link";

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" | "lg" = "md", extra = "") {
  return `btn btn-${variant}${size === "md" ? "" : ` btn-${size}`}${extra ? ` ${extra}` : ""}`;
}

/** A one-button form (vote, accept, delete, …). */
export async function ActionButton({
  action,
  back,
  fields = {},
  children,
  variant = "secondary",
  size = "md",
  icon,
  confirmText,
  className = "",
}: {
  action: string;
  back?: string;
  fields?: Record<string, string>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconNode;
  confirmText?: string;
  className?: string;
}) {
  return (
    <Form action={action} back={back} className="inline">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={buttonClass(variant, size, className)} aria-label={confirmText}>
        {icon ? <Icon icon={icon} /> : null}
        {children}
      </button>
    </Form>
  );
}
