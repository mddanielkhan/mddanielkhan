import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Two projects:
 *  - unit: pure logic (risk engine, trust maths, state machine, policy, crypto). No I/O.
 *  - integration: services against a real PostgreSQL (DATABASE_URL, default peerlink_test).
 *
 * Coverage thresholds on security-critical modules are a CONTROL, not a vanity
 * metric: lowering them to make a build pass is not allowed — add the test.
 */
const alias = { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/db/schema.ts"],
      reporter: ["text-summary", "lcov"],
      thresholds: {
        "src/lib/risk/**": { lines: 90, branches: 80 },
        "src/lib/trust/**": { lines: 90, branches: 80 },
        "src/lib/booking/state-machine.ts": { lines: 95, branches: 90 },
        "src/lib/policy/**": { lines: 95, branches: 90 },
        "src/lib/auth/totp.ts": { lines: 95, branches: 85 },
      },
    },
  },
});
