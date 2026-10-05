import { env } from "@/lib/env";

/**
 * Client IP extraction.
 *
 * NEVER trust X-Forwarded-For blindly: any client can send it, which makes
 * IP-keyed rate limits trivially bypassable. Only the header configured in
 * TRUSTED_IP_HEADER is read, and only because the deployment guarantees that a
 * proxy we control (Cloudflare / Caddy) overwrites it. With x-forwarded-for we
 * take the entry appended by our own proxy chain (counting TRUSTED_PROXY_HOPS
 * from the right), never the left-most client-supplied value.
 */
export function clientIp(headers: Headers): string | null {
  const mode = env().TRUSTED_IP_HEADER;
  if (mode === "none") return null;
  const raw = headers.get(mode);
  if (!raw) return null;
  if (mode === "x-forwarded-for") {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const idx = parts.length - env().TRUSTED_PROXY_HOPS;
    return normaliseIp(parts[Math.max(0, idx)] ?? null);
  }
  return normaliseIp(raw.trim());
}

function normaliseIp(ip: string | null): string | null {
  if (!ip) return null;
  // Strip IPv4-mapped IPv6 prefix and port suffixes.
  const v = ip.replace(/^::ffff:/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(v)) return v.split(":")[0]!;
  if (/^[0-9a-f:]+$/i.test(v)) return v.toLowerCase();
  return null;
}
