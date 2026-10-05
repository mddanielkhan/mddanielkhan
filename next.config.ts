import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  typedRoutes: false,
  // Don't let `next dev` write AGENTS.md/CLAUDE.md into the repository on every start.
  agentRules: false,
  outputFileTracingExcludes: { "*": ["test-results/**", ".mail-outbox/**", "tests/**", "docs/**", "deploy/**"] },
  experimental: {
    // Bound request bodies: our largest legitimate form is a 20k-char post.
    serverActions: { bodySizeLimit: "200kb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: STATIC_SECURITY_HEADERS },
      {
        // Authenticated/private pages and API responses must never be cached by shared caches.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
