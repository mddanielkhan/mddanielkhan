// Bundle the worker into dist/worker.mjs (dependencies stay external; resolved from node_modules at runtime).
import { build } from "esbuild";

await build({
  entryPoints: ["src/worker.ts"],
  outfile: "dist/worker.mjs",
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
