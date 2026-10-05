// Bundle the worker and operational scripts into dist/*.mjs (dependencies stay external,
// resolved from node_modules at runtime). These ship in the production image so ops
// tasks run with plain `node`, no TypeScript toolchain on the server.
import { build } from "esbuild";

const entries = {
  worker: "src/worker.ts",
  "create-admin": "scripts/create-admin.ts",
  seed: "scripts/seed.ts",
  "verify-audit-chain": "scripts/verify-audit-chain.ts",
  doctor: "scripts/doctor.ts",
};

await build({
  entryPoints: entries,
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  tsconfig: "tsconfig.json",
  sourcemap: false,
  logLevel: "info",
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
