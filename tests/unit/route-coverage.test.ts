import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Build-failing guard: every route handler must be created by defineRoute()
 * (the security pipeline: origin check, CSRF, rate limits, session, policy,
 * validation, safe errors). A raw `export async function POST` fails CI.
 */
function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return routeFiles(p);
    return name === "route.ts" ? [p] : [];
  });
}

const files = routeFiles(path.resolve(__dirname, "../../src/app"));

describe("route coverage", () => {
  it("finds the route handlers", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  for (const file of files) {
    const rel = path.relative(path.resolve(__dirname, "../.."), file);
    it(`${rel} uses defineRoute with an explicit auth mode`, () => {
      const src = readFileSync(file, "utf8");
      const exported = [...src.matchAll(/export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1]);
      expect(exported.length).toBeGreaterThan(0);
      for (const method of exported) {
        expect(src, `${method} must be "export const ${method} = defineRoute({...})"`).toMatch(new RegExp(`export const ${method} = defineRoute\\(`));
      }
      expect(src).toMatch(/auth:\s*\{\s*kind:\s*"(public|authenticated|policy)"/);
      expect(src).not.toMatch(/NextResponse/); // responses are built only by the pipeline
      // Mutations under /api/mod must require a staff policy.
      if (rel.includes(`${path.sep}api${path.sep}mod${path.sep}`)) expect(src).toMatch(/action:\s*"staff\.(moderate|admin)"/);
      // GET handlers must be declared as such (and therefore skip CSRF only by design).
      if (exported.includes("GET")) expect(src).toMatch(/method:\s*"GET"/);
    });
  }
});
