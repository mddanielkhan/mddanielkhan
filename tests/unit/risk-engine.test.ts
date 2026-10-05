import { describe, expect, it } from "vitest";
import { evaluateRisk, publicReasons, type RiskInput } from "@/lib/risk/engine";
import { normalise, extractContacts } from "@/lib/risk/normalise";

const established: Omit<RiskInput, "text" | "surface"> = { authorTrustLevel: 1, authorAccountAgeMs: 30 * 86400_000 };
const post = (text: string, extra: Partial<RiskInput> = {}) => evaluateRisk({ ...established, surface: "post", text, ...extra });

/**
 * BENIGN CORPUS — real-style questions Bangladeshi students ask. None of these may
 * be held or rejected. The first three are the exact sentences the previous
 * blueprint's rule engine hard-blocked with a strike.
 */
const BENIGN = [
  "How much bank statement do I need to show for a German student visa?",
  "Can I submit a scanned copy of my HSC certificate to TU Munich?",
  "Is it okay to use a proxy server to access the university portal from campus?",
  "My job interview at BRAC went well, any tips for the next round?",
  "Is this scholarship fake? They are asking me to pay a processing fee to receive it.",
  "Do I need to pay an application fee for the DAAD scholarship?",
  "Can I pay the IELTS registration fee with bKash?",
  "Got a 100% scholarship at a Hungarian university through Stipendium Hungaricum!",
  "Is admission guaranteed if I meet all the minimum requirements?",
  "Which agent did you use for your Malaysia student visa, and was it worth it?",
  "How do I prepare my bank statement and sponsor letter for a Canadian study permit?",
  "Can my bank provide a solvency certificate within a week?",
  "What is a blocked account and how much money do I need to deposit for Germany?",
  "I can share my experience with the Japanese MEXT scholarship interview if anyone wants.",
  "Is the Chevening deadline in November? I am preparing my essays now.",
  "Are part-time jobs in Malaysia enough to cover tuition fees and living cost?",
  "Did the question paper leak rumour about the admission test turn out to be false?",
  "What GRE score do I need for a fully funded PhD in the USA?",
  "Should I send my transcripts to the university or does uni-assist do that?",
  "Join our WhatsApp study group for IELTS speaking practice every Friday.",
  "My CGPA is 3.2 from a private university, can I still get admission in Germany?",
  "How to write a statement of purpose for a masters in data science?",
  "Is it worth doing an MBA in Bangladesh or should I go abroad?",
  "Does anyone know if the Commonwealth scholarship covers flight tickets?",
  "আমি জার্মানিতে মাস্টার্স করতে চাই, ব্লকড অ্যাকাউন্টে কত টাকা লাগবে?",
  "বুয়েটে ভর্তি পরীক্ষার প্রস্তুতি কিভাবে নেব?",
  "স্কলারশিপের জন্য আইইএলটিএস কত স্কোর লাগে?",
  "আমার এক বন্ধু বলল এজেন্ট ১০০% ভিসা গ্যারান্টি দিচ্ছে, এটা কি বিশ্বাসযোগ্য?",
  "Ami Malaysia te porte jete chai, kon university bhalo?",
  "Visa interview e ki ki proshno kore?",
  "The university said the tuition deposit is paid through their official portal only.",
  "I failed my first IELTS attempt with 5.5, any advice for getting 7?",
  "Is 6 months enough to prepare for the BCS exam alongside a job?",
  "How can I verify that an offer letter is real and not fake?",
  "Our department is hiring research assistants — see the official notice on du.ac.bd.",
  "What documents should I carry for my Australian student visa biometrics appointment?",
  "Can I work 20 hours a week on a UK student visa?",
  "Thanks a lot, this guide helped me get my Erasmus Mundus acceptance!",
  "I prepared my documents myself and got the visa without an agent.",
  "Has anyone faced rejection for a Canada study permit? What did you change?",
];

/** SCAM CORPUS — must be held or rejected. Patterns from documented BD student fraud. */
const SCAMS = [
  "100% visa guarantee for Canada! No IELTS needed. Contact WhatsApp 01712345678 for processing.",
  "We arrange bank statements and solvency certificates for any embassy. Inbox me, cheap rate.",
  "Guaranteed admission in UK universities. Pay 50000 tk advance payment to our bKash 01812345678.",
  "IELTS proxy test available, guaranteed band 7.5. Telegram me for details.",
  "Fake certificates available — transcripts, experience letters. Contact 01911223344.",
  "Europe work permit visa, Romania job, package cost 8 lakh taka, only 3 seats left, hurry!",
  "Earn daily income from home! Join our team, pay registration fee first via Nagad.",
  "Send money to my bkash 01711111111 to confirm your scholarship seat.",
  "Bank statement banai dei, 100% visa confirm. WhatsApp korun.",
  "ব্যাংক স্টেটমেন্ট বানিয়ে দিই, ভিসা নিশ্চিত। যোগাযোগ করুন 01712345678",
  "আগাম টাকা দিলে অগ্রিম পেমেন্ট নেওয়া হবে, স্কলারশিপ গ্যারান্টি। বিকাশ 01812345678",
  "Get leaked questions for the admission test, inbox me, 2000 tk only.",
  "Work from home: receive and forward payments, commission per transaction. USDT payment.",
  "Visa processing service available. We get you a guaranteed Schengen visa. Call 01612345678",
  "Ｇｕａｒａｎｔｅｅｄ ｖｉｓａ! Pay advance fee to our agent, WhatsApp only.",
  "g u a r a n t e e d admission, s3nd m0ney to my number 01712345678 via bkash",
];

describe("risk engine — benign corpus never held or rejected", () => {
  for (const text of BENIGN) {
    it(`allows: ${text.slice(0, 70)}`, () => {
      const r = post(text);
      expect(["allow", "flag"], `${text} → ${r.decision} ${JSON.stringify(r.signals.map((s) => s.code))}`).toContain(r.decision);
    });
  }

  it("keeps the false-positive rate on the benign corpus at zero holds", () => {
    const held = BENIGN.map((t) => post(t)).filter((r) => r.decision === "hold" || r.decision === "reject");
    expect(held).toHaveLength(0);
  });

  it("flags at most a small share of benign posts (patrol queue stays usable)", () => {
    const flagged = BENIGN.map((t) => post(t)).filter((r) => r.decision === "flag").length;
    expect(flagged / BENIGN.length).toBeLessThanOrEqual(0.15);
  });
});

describe("risk engine — scam corpus is caught", () => {
  for (const text of SCAMS) {
    it(`catches: ${text.slice(0, 70)}`, () => {
      const r = post(text);
      expect(["hold", "reject"], `${text} → ${r.decision} ${r.score} ${JSON.stringify(r.signals.map((s) => s.code))}`).toContain(r.decision);
    });
  }

  it("rejects outright only high-precision combinations", () => {
    expect(post("We arrange bank statements for any embassy, WhatsApp me").decision).toBe("reject");
    expect(post("IELTS proxy test available, telegram me").decision).toBe("reject");
    expect(post("Guaranteed visa, contact us").decision).not.toBe("reject");
  });
});

describe("risk engine — policy gates", () => {
  it("holds opportunities from low-trust authors even when text is clean", () => {
    const r = post("Fully funded summer research internship at a public university. Apply on the official website before 30 June.", {
      postType: "opportunity",
      authorTrustLevel: 1,
    });
    expect(r.decision).toBe("hold");
  });

  it("holds opportunities that involve a fee regardless of trust", () => {
    const r = post("Workshop on research writing, registration via the official page.", { postType: "opportunity", authorTrustLevel: 3, involvesFee: true });
    expect(r.decision).toBe("hold");
  });

  it("publishes clean opportunities from established members", () => {
    const r = post("DAAD EPOS scholarship applications are open. Read the official call on daad.de before applying.", {
      postType: "opportunity",
      authorTrustLevel: 2,
      extraUrls: ["https://www.daad.de/en/"],
    });
    expect(r.decision).toBe("allow");
  });

  it("rejects links to blocked domains", () => {
    const r = post("Apply here https://scam-visa.example.com/apply now", { blockedDomains: new Set(["scam-visa.example.com"]) });
    expect(r.decision).toBe("reject");
  });

  it("holds shortened links from new members and links from TL0 accounts", () => {
    expect(post("Scholarship info at bit.ly/3abcd", { authorTrustLevel: 0 }).decision).toBe("hold");
    expect(post("Read my blog at https://myblog.example.net/post for tips", { authorTrustLevel: 0 }).decision).toBe("hold");
    expect(post("Official info: https://www.daad.de/en/ for German scholarships", { authorTrustLevel: 0 }).decision).toBe("allow");
  });

  it("holds public phone numbers from low-trust members", () => {
    expect(post("Call me at 01712345678 if you want to discuss scholarships", { authorTrustLevel: 0 }).decision).toBe("hold");
  });

  it("never gives immunity to staff or mentors", () => {
    const r = evaluateRisk({ ...established, surface: "post", text: SCAMS[0]!, authorIsStaff: true, authorIsApprovedMentor: true, authorTrustLevel: 4 });
    expect(r.decision).not.toBe("allow");
  });
});

describe("risk engine — support routing", () => {
  it("detects crisis language without penalising the author", () => {
    const r = post("I failed my admission test again and I want to die, I don't know what to do.");
    expect(r.supportNeeded).toBe(true);
    expect(r.decision).toBe("allow");
  });
  it("detects Bangla crisis language", () => {
    expect(post("সব শেষ, আমি আর বাঁচতে চাই না").supportNeeded).toBe(true);
  });
});

describe("explanations", () => {
  it("exposes policy reasons only, never patterns", () => {
    const reasons = publicReasons(post(SCAMS[0]!));
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) expect(r).not.toMatch(/\\b|\(\?:/);
  });
});

describe("normalise", () => {
  it("defeats common obfuscation without changing meaning", () => {
    expect(normalise("ＧＵＡＲＡＮＴＥＥＤ").text).toBe("guaranteed");
    expect(normalise("guaranteeeeed").text).toBe("guaranteed");
    expect(normalise("g u a r a n t e e d visa").text).toBe("guaranteed visa");
    expect(normalise("gu​arantee").text).toBe("guarantee");
    expect(normalise("vіsа").text).toBe("visa"); // Cyrillic і and а
    expect(normalise("s3nd m0ney").text).toBe("send money");
  });
  it("keeps numbers, amounts and years intact", () => {
    expect(normalise("Pay 5000 tk by 2026").text).toBe("pay 5000 tk by 2026");
    expect(normalise("01712345678").text).toBe("01712345678");
  });
  it("extracts BD phones, emails and URLs", () => {
    const c = extractContacts("Call +880 1712-345678 or 01812345678, mail x@y.com, see https://a.example.org/x.");
    expect(c.phones).toEqual(expect.arrayContaining(["+8801712345678", "01812345678"]));
    expect(c.emails).toEqual(["x@y.com"]);
    expect(c.urls).toEqual(["https://a.example.org/x"]);
  });
});
