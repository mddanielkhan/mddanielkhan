# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build. The runtime image has no build toolchain, no dev
# dependencies, runs as a non-root user and works on a read-only filesystem.
# Pin the base image by digest in production (supply chain, OWASP A03:2025).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 10001 peerlink && useradd --system --uid 10001 --gid peerlink --no-create-home peerlink
# Web server (standalone output), then the full pruned production node_modules on top
# so the worker and migration runner resolve every dependency they need.
COPY --from=build --chown=peerlink:peerlink /app/.next/standalone ./
COPY --from=build --chown=peerlink:peerlink /app/node_modules ./node_modules
COPY --from=build --chown=peerlink:peerlink /app/dist ./dist
COPY --from=build --chown=peerlink:peerlink /app/drizzle ./drizzle
COPY --from=build --chown=peerlink:peerlink /app/deploy/postgres ./deploy/postgres
COPY --from=build --chown=peerlink:peerlink /app/scripts/migrate.mjs ./scripts/migrate.mjs
USER peerlink
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
