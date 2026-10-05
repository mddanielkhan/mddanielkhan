/**
 * Only allow same-site relative paths as redirect targets (open-redirect defence).
 * Absolute URLs are reduced to their path only if they point at our own origin.
 */
export function safeBackPath(input: string | null | undefined, fallback = "/"): string {
  if (!input) return fallback;
  let path = input;
  if (/^https?:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      const own = new URL(process.env.APP_URL ?? "http://localhost:3000");
      if (u.origin !== own.origin) return fallback;
      path = u.pathname + u.search;
    } catch {
      return fallback;
    }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || /[\r\n]/.test(path)) return fallback;
  // Strip our own status params so messages don't stack up.
  const u = new URL(path, "http://x");
  for (const p of ["n", "e", "ref"]) u.searchParams.delete(p);
  return u.pathname + (u.search ? u.search : "");
}

export function withParam(path: string, key: string, value: string | null | undefined): string {
  if (!value) return path;
  const u = new URL(path, "http://x");
  u.searchParams.set(key, value);
  return u.pathname + u.search + u.hash;
}
