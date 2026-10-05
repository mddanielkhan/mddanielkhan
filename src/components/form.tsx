import type { ReactNode } from "react";
import { csrfToken } from "@/lib/auth/current";
import { CSRF_FIELD } from "@/lib/security/csrf";

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

/** A one-button form (vote, accept, delete, …). */
export async function ActionButton({
  action,
  back,
  fields = {},
  children,
  variant = "secondary",
  confirmText,
}: {
  action: string;
  back?: string;
  fields?: Record<string, string>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "link";
  confirmText?: string;
}) {
  return (
    <Form action={action} back={back} className="inline">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={`btn btn-${variant}`} aria-label={confirmText}>
        {children}
      </button>
    </Form>
  );
}
