/**
 * Content-safety signals for the Bangladesh student-fraud threat model.
 *
 * Every signal encodes an INTENT pattern (someone offering, requesting or
 * steering), not a lone keyword. Students legitimately discuss bank statements,
 * application fees, agents, visas and proxies all day; a filter that punishes
 * those words fails the very people it is meant to protect.
 *
 * Bangla text has no ASCII word boundaries, so Bangla alternatives are matched
 * as substrings; English alternatives use \b.
 *
 * Bump RULESET_VERSION on any change: each evaluation stores the version so a
 * moderator (or a court) can see which rules were in force at the time.
 */

export const RULESET_VERSION = "2026.10.1";

export type SignalCategory = "fraud" | "money" | "exam" | "steering" | "contact" | "link" | "abuse" | "support";

export type Signal = {
  code: string;
  category: SignalCategory;
  weight: number;
  /** Shown to the author (policy-level, never the pattern). */
  publicReason: string;
  /** Halve the weight when the match is inside a question ("Is a 100% visa guarantee real?"). Victims asking for help must not be treated as scammers. */
  questionDiscount?: boolean;
  pattern: RegExp;
};

const re = (src: string) => new RegExp(src, "iu");

const PAY_VERBS = String.raw`\b(?:send|pay|transfer|deposit|submit)\b|পাঠান|পাঠাও|পাঠাবেন|পাঠিয়ে দিন|জমা দিন|পেমেন্ট করুন|pathan|pathiye din|den\b|diben\b`;
const WALLETS = String.raw`\b(?:bkash|bikash|nagad|rocket|upay)\b|বিকাশ|নগদ|রকেট`;
const OUTCOMES = String.raw`\b(?:visas?|admissions?|offer letters?|offers?|scholarships?|jobs?|placements?|seats?|approvals?|pr|work permits?)\b|ভিসা|ভর্তি|চাকরি|স্কলারশিপ|অফার`;
const DOCS = String.raw`bank statements?|solvency (?:certificates?|letters?)|sponsor(?:ship)? (?:letters?|documents?)|certificates?|experience letters?|offer letters?|ielts (?:certificates?|results?)|marksheets?|transcripts?|documents?`;
/** Documents whose "availability" is itself a fraud marker (nobody legitimately sells these). */
const DOCS_STRONG = String.raw`bank statements?|solvency (?:certificates?|letters?)|sponsor(?:ship)? (?:letters?|documents?)|experience letters?|ielts (?:certificates?|results?)`;
const GUARANTEE = String.raw`\bguarantee[ds]?\b|\bguaranty\b|\b100\s*%|\bhundred percent\b|\bsure ?shot\b|\bno rejection\b|\bwithout (?:any )?rejection\b|\bconfirm(?:ed)? visa\b|গ্যারান্টি|নিশ্চিত|সুনিশ্চিত`;

export const SIGNALS: Signal[] = [
  {
    code: "MONEY_TO_PERSON",
    category: "money",
    weight: 35,
    publicReason: "Asking people to send money to a person or account is not allowed.",
    pattern: re(
      String.raw`(?:${PAY_VERBS})[^.?!\n]{0,20}(?:\b(?:money|taka|tk|bdt|fees?|amount|payment)\b|৳|\d{3,})[^.?!\n]{0,20}\b(?:to|on|in|at)\s+(?:me\b|us\b|my (?:number|account|bkash|nagad)|our (?:number|account|bkash|nagad)|this (?:number|account|bkash|nagad)|personal (?:number|account))|\b(?:send|pay|transfer)\s+(?:me|us)\b[^.?!\n]{0,15}(?:\b(?:money|taka|tk|bdt|fees?|amount)\b|৳|\d{3,})|(?:আমাকে|আমাদের|এই নম্বরে|এই নাম্বারে)[^।?!\n]{0,20}(?:টাকা|পেমেন্ট)`,
    ),
  },
  {
    code: "WALLET_WITH_NUMBER",
    category: "money",
    weight: 40,
    publicReason: "Personal bKash/Nagad/Rocket payment details are not allowed in posts.",
    pattern: re(String.raw`(?:${WALLETS})[^\n]{0,30}(?:\+?88)?0?1[3-9](?:[\s.-]?\d){8}|(?:\+?88)?0?1[3-9](?:[\s.-]?\d){8}[^\n]{0,30}(?:${WALLETS})`),
  },
  {
    code: "ADVANCE_FEE",
    questionDiscount: true,
    category: "money",
    weight: 30,
    publicReason: "Requests for advance or processing fees are reviewed by our team first.",
    pattern: re(
      String.raw`\b(?:advance|upfront)\s+(?:payment|fees?|money|amount|taka|tk)\b|\b(?:fees?|payment|money)\s+(?:first|in advance|upfront)\b|\b(?:processing|file|registration|service|token|booking) (?:fee|charge|money)s?\b[^.?!\n]{0,30}(?:${PAY_VERBS}|${WALLETS})|অগ্রিম (?:টাকা|পেমেন্ট|ফি)|এডভান্স (?:টাকা|পেমেন্ট)|advance (?:dite hobe|den|diben)|প্রসেসিং ফি|ফাইল চার্জ`,
    ),
  },
  {
    code: "GUARANTEED_OUTCOME",
    questionDiscount: true,
    category: "fraud",
    weight: 25,
    publicReason: "Nobody can guarantee a visa, admission, scholarship or job. Such claims are reviewed.",
    pattern: re(String.raw`(?:${GUARANTEE})[^.?!\n]{0,30}(?:${OUTCOMES})|(?:${OUTCOMES})[^.?!\n]{0,20}(?:${GUARANTEE})`),
  },
  {
    code: "AGENT_SERVICE_OFFER",
    category: "fraud",
    weight: 25,
    questionDiscount: true,
    publicReason: "Offering paid agent or processing services is not allowed in the community.",
    pattern: re(
      String.raw`\b(?:we|i)\s+(?:can |will |also )?(?:arrange|manage|process|handle|get you|ensure|confirm)\b[^.?!\n]{0,30}(?:${OUTCOMES}|\bfile processing\b)|\b(?:contact|call|knock|inbox|dm)\s+(?:me|us)\b[^.?!\n]{0,30}(?:${OUTCOMES}|\bprocessing\b)|\b(?:visa|admission|file) processing (?:service|agent|agency|available)\b|\b(?:offer|provide)\w* (?:visa|admission|file) processing\b|(?:ভিসা|ভর্তি|অফার লেটার|স্কলারশিপ|ফাইল)[^।?!\n]{0,20}(?:করে দিই|করে দেই|করে দিবো|করে দেব|করিয়ে দিই|করিয়ে দেব)|\b(?:visa|admission|offer letter|file)\b[^.?!\n]{0,20}(?:kore dibo|kore dei|kore debo|koriye dibo)`,
    ),
  },
  {
    code: "DOCUMENT_FRAUD_OFFER",
    category: "fraud",
    weight: 50,
    publicReason: "Offering to arrange documents (bank statements, certificates, letters) is fraud and is not allowed.",
    pattern: re(
      String.raw`\b(?:we|i)\s+(?:can |will |do |also )?(?:provide|arrange|manage|make|supply|sell)\b[^.?!\n]{0,20}\b(?:${DOCS})\b|\b(?:${DOCS_STRONG})\b[^.?!\n]{0,15}\b(?:available|for sale)\b|\bfake (?:${DOCS})\b[^.?!\n]{0,25}\b(?:available|provided?|service|contact|cheap)\b|(?:ব্যাংক স্টেটমেন্ট|সলভেন্সি|সার্টিফিকেট|সনদ|কাগজপত্র)[^।?!\n]{0,20}(?:বানিয়ে দিই|বানিয়ে দেই|বানিয়ে দেওয়া হয়|ম্যানেজ করে দিই|ব্যবস্থা করে দিই|করে দেওয়া হয়)|\b(?:statement|certificate|documents?) (?:banai|baniye dei|baniye dibo|manage kore dei)\b`,
    ),
  },
  {
    code: "EXAM_FRAUD",
    questionDiscount: true,
    category: "exam",
    weight: 50,
    publicReason: "Exam fraud (proxy test-takers, leaked papers, guaranteed scores) is not allowed.",
    pattern: re(
      String.raw`\bproxy (?:test|exam|candidate|sitter|ielts|toefl|pte|gre|gmat)s?\b|\b(?:ielts|toefl|pte|gre|gmat|duolingo|exam|test) proxy\b|\b(?:leaked|leak) (?:questions?|papers?)\b|\bquestion papers? (?:leak|leaked)\b|প্রশ্ন ?ফাঁস|প্রশ্নপত্র ফাঁস|\b(?:guaranteed?|confirm(?:ed)?) (?:band|score)s?\b|\bband (?:score )?guarantee\b|\b(?:ielts|toefl|pte|duolingo) (?:certificate|result)s? without (?:exam|test|sitting)\b|পরীক্ষা ছাড়া (?:সার্টিফিকেট|রেজাল্ট)`,
    ),
  },
  {
    code: "URGENCY_PRESSURE",
    questionDiscount: true,
    category: "fraud",
    weight: 12,
    publicReason: "Pressure tactics are a common scam sign.",
    pattern: re(
      String.raw`\b(?:only|last) \d+ (?:seats?|slots?|spots?) (?:left|remaining)\b|\blimited seats?\b|\bact (?:now|fast)\b|\bhurry\b|\btoday only\b|\bbefore it'?s too late\b|আজই যোগাযোগ|দ্রুত যোগাযোগ|সীমিত আসন|সময় শেষ হয়ে যাচ্ছে`,
    ),
  },
  {
    code: "OFF_PLATFORM_STEERING",
    category: "steering",
    weight: 10,
    publicReason: "Moving conversations to WhatsApp/Telegram removes the protection this platform gives you.",
    pattern: re(String.raw`\b(?:whats ?app|telegram|imo|viber|signal|wechat)\b|\b(?:inbox|dm|text|knock) me\b|হোয়াটসঅ্যাপ|টেলিগ্রাম|ইনবক্স করুন|ইমোতে`),
  },
  {
    code: "CRYPTO_PAYMENT",
    category: "money",
    weight: 30,
    questionDiscount: true,
    publicReason: "Crypto payments are a common scam channel and are reviewed.",
    pattern: re(String.raw`\b(?:usdt|binance|bitcoin|btc|crypto|trc20|ethereum)\b[^.?!\n]{0,30}\b(?:pay|send|deposit|invest|earn|payments?)\b|\b(?:pay|send|deposit|invest|payments?)\b[^.?!\n]{0,20}\b(?:usdt|binance|bitcoin|btc|crypto|trc20)\b`),
  },
  {
    code: "MONEY_MULE",
    category: "money",
    weight: 45,
    publicReason: "Money-transfer 'jobs' make you a money mule — a crime. These are not allowed.",
    pattern: re(String.raw`\breceive and (?:send|forward|transfer)\b|\bmoney (?:transfer|forwarding) (?:job|work)\b|\bcommission per (?:transaction|transfer)\b|\b(?:use|rent|lend) (?:your|ur) (?:bank account|bkash|nagad)\b`),
  },
  {
    code: "MLM_INCOME",
    questionDiscount: true,
    category: "fraud",
    weight: 20,
    publicReason: "Income schemes and recruitment pyramids are not allowed.",
    pattern: re(String.raw`\bpassive income\b|\bearn (?:from|at) home\b|\bwork from home\b[^.?!\n]{0,40}\b(?:earn|income|commission|payments?)\b|\bjoin (?:my|our) team\b|\bdownline\b|\brefer and earn\b|\bdaily income\b|ঘরে বসে আয়`),
  },
  {
    code: "OVERSEAS_JOB_FEE",
    questionDiscount: true,
    category: "fraud",
    weight: 35,
    publicReason: "Overseas job offers that involve fees are reviewed (trafficking and scam risk).",
    pattern: re(
      String.raw`\b(?:job|work|work permit|employment)s?\b[^.?!\n]{0,40}\b(?:europe|romania|serbia|croatia|poland|malaysia|dubai|saudi|qatar|russia|cambodia|abroad|overseas)\b[^.?!\n]{0,40}\b(?:fees?|cost|charge|taka|tk|bdt|package)\b|(?:বিদেশে|ইউরোপে|মালয়েশিয়ায়)[^।?!\n]{0,20}(?:চাকরি|কাজ)[^।?!\n]{0,30}(?:টাকা|খরচ|প্যাকেজ)`,
    ),
  },
  {
    code: "THREAT",
    category: "abuse",
    weight: 45,
    publicReason: "Threats are not allowed.",
    pattern: re(String.raw`\b(?:i|we)(?:'ll| will| am going to| are going to) (?:kill|hurt|beat|find|expose) (?:you|u)\b|তোকে মেরে ফেলব|তোমাকে মেরে ফেলব`),
  },
  {
    code: "SELF_HARM_SUPPORT",
    category: "support",
    weight: 0,
    publicReason: "",
    pattern: re(
      String.raw`\b(?:suicide|suicidal|kill myself|end my life|want to die|no reason to live|don'?t want to live)\b|আত্মহত্যা|মরে যেতে চাই|বাঁচতে চাই না|\bmore jete chai\b`,
    ),
  },
];

/** Phrases that look like guarantees but are legitimate scholarship vocabulary. */
export const GUARANTEE_ALLOWLIST = /\b100\s*%\s*(?:scholarships?|tuition(?: fee)? waivers?|waivers?|funded|funding|fee waivers?|tuition)\b|\bfully funded\b/giu;

/** Domains whose links are considered trustworthy for opportunity sources. */
export const TRUSTED_DOMAIN_SUFFIXES = [
  "edu",
  "edu.bd",
  "ac.bd",
  "gov",
  "gov.bd",
  "ac.uk",
  "gov.uk",
  "edu.au",
  "gov.au",
  "ac.jp",
  "go.jp",
  "ac.kr",
  "go.kr",
  "edu.my",
  "gov.my",
  "ac.in",
  "edu.cn",
  "gc.ca",
  "canada.ca",
  "europa.eu",
  "daad.de",
  "uni-assist.de",
  "britishcouncil.org",
  "ielts.org",
  "ets.org",
  "pearsonpte.com",
  "duolingo.com",
  "chevening.org",
  "fulbrightonline.org",
  "commonapp.org",
  "studyinjapan.go.jp",
  "bdjobs.com",
  "linkedin.com",
  "github.com",
] as const;
