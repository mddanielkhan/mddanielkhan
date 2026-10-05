import { describe, expect, it } from "vitest";
import { displayName, postSchema, profileSchema, registerSchema, username, httpsUrl, bookingRequestSchema } from "@/lib/validation/schemas";

/** Mirrors exactly what the HTML forms submit (blank fields included). */
const questionForm = {
  type: "question",
  topicId: "1",
  title: "Which public universities offer data science?",
  body: "I finished my BSc in Statistics and want to study data science locally first.",
  tags: "",
  orgName: "",
  officialUrl: "",
  deadline: "",
  involvesFee: "",
  sources: "",
};

describe("post form", () => {
  it("accepts a question with the untouched opportunity/guide fields left blank (regression)", () => {
    const r = postSchema.safeParse(questionForm);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(r.data?.involvesFee).toBeUndefined();
    expect(r.data?.officialUrl).toBeUndefined();
  });
  it("requires org, official https link and fee answer for opportunities", () => {
    const r = postSchema.safeParse({ ...questionForm, type: "opportunity" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["orgName", "officialUrl", "involvesFee"]));
    expect(postSchema.safeParse({ ...questionForm, type: "opportunity", orgName: "DAAD", officialUrl: "http://daad.de", involvesFee: "no" }).success).toBe(false);
    expect(postSchema.safeParse({ ...questionForm, type: "opportunity", orgName: "DAAD", officialUrl: "https://www.daad.de/en/", involvesFee: "no" }).success).toBe(true);
  });
  it("requires sources for guides and normalises tags", () => {
    expect(postSchema.safeParse({ ...questionForm, type: "guide" }).success).toBe(false);
    const r = postSchema.parse({ ...questionForm, tags: "Germany, MASTERS, germany, a, cse!!" });
    expect(r.tags).toEqual(["germany", "masters", "cse"]);
  });
  it("strips control and bidi-override characters", () => {
    const r = postSchema.parse({ ...questionForm, title: "Visa‮ question\u0007 about Japan" });
    expect(r.title).toBe("Visa question about Japan");
  });
});

describe("identity fields", () => {
  it("blocks reserved and impersonating usernames/display names", () => {
    expect(username.safeParse("admin").success).toBe(false);
    expect(username.safeParse("peerlink_support").success).toBe(false);
    expect(username.safeParse("Raima_RUET").data).toBe("raima_ruet");
    expect(username.safeParse("mod_team").success).toBe(false);
    expect(username.safeParse("moderator1").success).toBe(false);
    expect(username.safeParse("modhumita").success).toBe(true);
    expect(username.safeParse("peer_link_help").success).toBe(false);
    expect(username.safeParse("peerless").success).toBe(true);
    expect(displayName.safeParse("Official PeerLink Support").success).toBe(false);
    expect(displayName.safeParse("PeerLink Team").success).toBe(false);
    expect(displayName.safeParse("Peer Link team").success).toBe(false);
    expect(displayName.safeParse("পিয়ারলিংক টিম").success).toBe(false);
    expect(displayName.safeParse("পি\u09DFারলিংক টিম").success).toBe(false); // precomposed য় is normalised first
    expect(displayName.safeParse("Raima ✔").success).toBe(false);
    expect(displayName.safeParse("রাইমা আহমেদ").success).toBe(true);
  });
  it("requires adult attestation and consent at registration", () => {
    const base = { email: "A@B.co", username: "raima", displayName: "Raima", password: "x".repeat(20), adult: "on", accept: "on" };
    expect(registerSchema.parse(base).email).toBe("a@b.co");
    expect(registerSchema.safeParse({ ...base, adult: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, accept: undefined }).success).toBe(false);
  });
  it("accepts only https links without credentials", () => {
    expect(httpsUrl.safeParse("https://example.org/x").success).toBe(true);
    expect(httpsUrl.safeParse("http://example.org").success).toBe(false);
    expect(httpsUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpsUrl.safeParse("https://user:pw@example.org").success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "Raima", linkedinUrl: "https://evil.example/in/raima" }).success).toBe(false);
  });
  it("accepts 1–3 proposed times from the booking form", () => {
    const r = bookingRequestSchema.safeParse({ offeringId: "00000000-0000-4000-8000-000000000000", subject: "Help with SOP", message: "x".repeat(50), times: ["2026-10-10T10:00", "", ""] });
    expect(r.success).toBe(true);
  });
});

describe("error messages from URL codes", () => {
  it("names only known fields and never echoes arbitrary words", async () => {
    const { errorMessage } = await import("@/lib/i18n/messages");
    expect(errorMessage("invalid_email")).toBe('Please check the "Email" field and try again.');
    expect(errorMessage("invalid_Your account is hacked call support")).toBe("Please check the form and try again.");
    expect(errorMessage("totally_unknown")).toMatch(/Something went wrong/);
  });
});
