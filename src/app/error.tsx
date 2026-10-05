"use client";

/** Generic error boundary: shows a reference code, never internals (OWASP A10:2025). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="muted mt-2">Please try again. If it keeps happening, contact support{error.digest ? ` and mention reference ${error.digest}` : ""}.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}
