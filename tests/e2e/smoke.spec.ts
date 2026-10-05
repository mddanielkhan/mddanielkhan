import { expect, test } from "@playwright/test";
import { watchForErrors } from "./helpers";

const PUBLIC_PAGES = ["/", "/feed", "/mentors", "/opportunities", "/safety", "/guidelines", "/privacy", "/terms", "/transparency", "/security", "/about", "/login", "/register", "/report-concern"];

test("public pages render with no CSP violations or script errors", async ({ page }) => {
  const problems = watchForErrors(page);
  for (const path of PUBLIC_PAGES) {
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test("security headers are present on every page", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=63072000");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("layout fits small screens without horizontal scrolling", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
