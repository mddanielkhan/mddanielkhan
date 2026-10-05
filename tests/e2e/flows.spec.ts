import { expect, test } from "@playwright/test";
import { ADMIN_TOTP, MENTOR_TOTP } from "./fixtures";
import { lastMail, login, watchForErrors } from "./helpers";

test.describe.configure({ mode: "serial" });

test("a new student registers, verifies their email and asks a question", async ({ page }) => {
  const problems = watchForErrors(page);
  await page.goto("/register");
  await page.getByLabel("Email").fill("mitu@example.com");
  await page.getByLabel("Username").fill("mitu_du");
  await page.getByLabel("Display name").fill("Mitu");
  await page.getByLabel("Password").fill("short");
  await page.getByLabel("I am 18 or older.").check();
  await page.getByRole("checkbox", { name: /I accept the Terms/ }).check();
  // Browser-side validation mirrors the server policy (15+ chars).
  expect(await page.getByLabel("Password").evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);
  await page.getByLabel("Password").fill("lantern river mango cloud");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/Check your inbox for a verification link/)).toBeVisible();

  const mail = lastMail("mitu@example.com", "verify_email");
  expect(mail).not.toBeNull();
  // Anti-phishing: every link in our emails points at our own origin.
  const links = mail!.text.match(/https?:\/\/\S+/g) ?? [];
  expect(links.length).toBe(1);
  for (const l of links) expect(l.startsWith("http://localhost:3100/")).toBe(true);
  const link = links[0]!;
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByText(/Email verified/)).toBeVisible();

  await login(page, "mitu@example.com", "lantern river mango cloud");
  await page.goto("/posts/new");
  await page.getByLabel("Title").fill("Which public universities in Bangladesh offer an MSc in data science?");
  await page.getByLabel("Details").fill("I finished my BSc in Statistics and want to study data science locally first. Which public universities offer it and how competitive are admissions?");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/Published! Thank you/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("MSc in data science");
  expect(problems).toEqual([]);
});

test("a scam post is held for review and invisible to others", async ({ page, browser }) => {
  await login(page, "student@shikor.local");
  await page.goto("/posts/new");
  await page.getByLabel("Title").fill("Guaranteed UK admission and visa, limited seats");
  await page.getByLabel("Details").fill("100% guaranteed admission and visa for UK. Only 3 seats left! Pay 50000 tk advance payment to our bKash 01812345678 and WhatsApp us today.");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/wasn't published|waiting for a quick moderator review/)).toBeVisible();
  const url = page.url();

  const other = await browser.newContext();
  const anon = await other.newPage();
  const res = await anon.goto(url);
  expect(res?.status()).toBe(404);
  await other.close();
});

test("a student requests a session and a 2FA-protected mentor accepts it", async ({ page, browser }) => {
  await login(page, "student@shikor.local");
  await page.goto("/u/nusrat_tum");
  await page.getByRole("link", { name: "Request this session" }).first().click();
  await page.getByLabel("What do you want help with?").fill("Shortlisting German MSc programmes");
  await page.getByLabel("Your prepared questions").fill("I have a 3.4 CGPA in EEE from RUET. Which TU9 programmes are realistic, and how should I plan APS and uni-assist timelines?");
  const when = new Date(Date.now() + 2 * 86400_000 + 6 * 3600_000).toISOString().slice(0, 16);
  await page.getByLabel("Proposed time 1").fill(when);
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(/Request sent/)).toBeVisible();
  const bookingUrl = new URL(page.url()).pathname;

  const ctx = await browser.newContext();
  const mentor = await ctx.newPage();
  await login(mentor, "mentor@shikor.local", undefined, MENTOR_TOTP);
  await mentor.goto(bookingUrl);
  await mentor.getByRole("button", { name: "Accept" }).click();
  await expect(mentor.getByText(/Session confirmed/)).toBeVisible();
  await expect(mentor.getByRole("link", { name: "Join the video call" })).toHaveAttribute("href", /^https:\/\/meet\.jit\.si\/Shikor-/);
  await ctx.close();

  await page.goto(bookingUrl);
  await expect(page.getByText("Confirmed")).toBeVisible();
});

test("staff need 2FA, then can review the held scam post", async ({ page }) => {
  await login(page, "admin@shikor.local", undefined, ADMIN_TOTP);
  await page.goto("/mod/queue");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  const card = page.locator(".card", { hasText: "100% visa guarantee for Canada" }).first();
  await expect(card).toBeVisible();
  await card.getByText("Remove…").click();
  await card.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Done.")).toBeVisible();
  await page.goto("/mod/audit");
  await expect(page.getByText(/Chain intact/)).toBeVisible();
});

test("cross-site form posts are rejected (CSRF)", async ({ request }) => {
  const res = await request.post("/api/posts", {
    form: { type: "question", topicId: "1", title: "CSRF attempt title here", body: "This should never be created by a cross-site request." },
    headers: { origin: "https://evil.example" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toMatch(/e=cross_site_request/);
  const noToken = await request.post("/api/auth/login", { form: { email: "a@b.co", password: "x" }, headers: { origin: "http://localhost:3100" }, maxRedirects: 0 });
  expect(noToken.headers()["location"]).toMatch(/e=csrf_failed/);
});
