"use client";

import { CircleAlert, Icon } from "@/components/icons";

/** Generic error boundary: shows a reference code, never internals (OWASP A10:2025). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center sm:py-24">
      <span className="icon-tile icon-tile-danger h-14 w-14 rounded-2xl">
        <Icon icon={CircleAlert} className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted">Please try again. If it keeps happening, contact support{error.digest ? " and mention the reference below" : ""}.</p>
      {error.digest ? <p className="mt-4 rounded-lg bg-subtle px-3 py-1.5 font-mono text-sm text-ink-soft">Reference: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        Try again
      </button>
    </div>
  );
}
