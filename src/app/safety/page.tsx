import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { BRAND } from "@/lib/config/brand";
import { Banknote, Clock, FileText, Flag, Gift, Icon, KeyRound, LifeBuoy, Lock, MessageCircle, Phone, Plane, ShieldAlert, Siren, Trophy, type IconNode } from "@/components/icons";

export const metadata = { title: "Safety & scam red flags", description: "How to spot study-abroad, scholarship and job scams targeting Bangladeshi students — and how to stay safe." };

const FLAGS: Array<{ icon: IconNode; title: string; body: string; bn: string }> = [
  { icon: Trophy, title: "“100% visa / admission / scholarship guaranteed”", body: "No one can guarantee a sovereign government's visa decision or a university's admission. Guarantees are the #1 sign of a fake agent.", bn: "“১০০% ভিসা গ্যারান্টি” — এটি প্রতারণার সবচেয়ে বড় লক্ষণ।" },
  { icon: Banknote, title: "Advance or “processing” fees paid to a person", body: "Real universities and scholarship bodies take fees through their official portal — never to a personal bKash/Nagad number.", bn: "ব্যক্তিগত বিকাশ/নগদ নম্বরে আগাম টাকা কখনো নয়।" },
  { icon: FileText, title: "“We can arrange your bank statement or documents”", body: "This is document fraud. It can get you a permanent visa ban and criminal charges.", bn: "ব্যাংক স্টেটমেন্ট বা কাগজ “বানিয়ে দেওয়া” মানেই জালিয়াতি।" },
  { icon: Clock, title: "Pressure and urgency", body: "“Only 2 seats left, pay today” is a pressure tactic. Real deadlines are published on official sites.", bn: "“আজই টাকা দিন” — চাপ দেওয়াই প্রতারকের কৌশল।" },
  { icon: MessageCircle, title: "Move to WhatsApp, Telegram or imo", body: "Scammers move you off-platform so there's no record and no protection. Keep conversations here.", bn: "হোয়াটসঅ্যাপ/টেলিগ্রামে নিয়ে যেতে চাইলে সতর্ক হোন।" },
  { icon: Gift, title: "You were “selected” for something you never applied to", body: "Unsolicited awards that require a fee to release the money are advance-fee fraud.", bn: "আবেদন না করেই “নির্বাচিত” — এবং টাকা চাইছে? প্রতারণা।" },
  { icon: Plane, title: "Overseas jobs with a “package cost”", body: "Paying lakhs for a job abroad is how students are trafficked into forced labour and scam compounds. Check licences with BMET.", bn: "বিদেশে চাকরির “প্যাকেজ” — মানবপাচারের ঝুঁকি।" },
  { icon: ShieldAlert, title: "IELTS or exam “proxy”, leaked questions", body: "Exam fraud leads to permanent bans from testing bodies and visa refusals.", bn: "প্রক্সি পরীক্ষা বা প্রশ্নফাঁস — স্থায়ী নিষেধাজ্ঞার কারণ।" },
  { icon: KeyRound, title: "Someone asks for your OTP, password or NID photo", body: `${BRAND.name} staff will never ask for these. Nobody legitimate needs your OTP.`, bn: "OTP, পাসওয়ার্ড বা এনআইডির ছবি কাউকে দেবেন না।" },
];

const CHECKLIST = [
  ["Find it yourself", "Open the organisation's official website yourself — don't use the link you were sent."],
  ["Confirm by email", "Email the university's official admissions address (from their website) to confirm any offer letter."],
  ["Check the agency", "Is it licensed, with a physical office? Ask other students who used it — here, publicly."],
  ["Pay officially", "Only through official portals, with a receipt in your own name."],
  ["Stop if it's rushed", "If something feels rushed or secret, stop and ask the community: “Is this real?” That question is always welcome."],
] as const;

export default function SafetyPage() {
  return (
    <>
      <PageHeader eyebrow="Safety centre" title="Scam red flags, and how to stay safe" subtitle="Bangladeshi students lose life savings to fake agents every year. Share this page — it might save someone a year and their family's money." />

      <section className="band-brand mb-12 flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
          <Icon icon={Lock} className="h-7 w-7" />
        </span>
        <div>
          <p className="text-xl font-bold text-white sm:text-2xl">{BRAND.goldenRule}</p>
          <p lang="bn" className="mt-1 text-[#cfe9db]">
            {BRAND.goldenRuleBn}
          </p>
        </div>
      </section>

      <section aria-labelledby="flags" className="mb-14">
        <h2 id="flags" className="text-2xl font-bold tracking-tight">
          Nine red flags
        </h2>
        <p className="mt-1 text-muted">If you see any of these, stop. One is enough.</p>
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FLAGS.map((f) => (
            <li key={f.title} className="card flex flex-col p-5">
              <span className="icon-tile icon-tile-danger">
                <Icon icon={f.icon} />
              </span>
              <h3 className="mt-4 font-bold leading-snug">{f.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{f.body}</p>
              <p lang="bn" className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
                {f.bn}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="before" className="card p-6 sm:p-8">
          <h2 id="before" className="text-xl font-bold tracking-tight">
            Before you pay anyone for anything
          </h2>
          <ol className="mt-6 space-y-5">
            {CHECKLIST.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800">{i + 1}</span>
                <span>
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-6">
          <section id="support" aria-labelledby="support-h" className="card scroll-mt-24 p-6">
            <span className="icon-tile icon-tile-info">
              <Icon icon={LifeBuoy} />
            </span>
            <h2 id="support-h" className="mt-4 text-lg font-bold">
              If you&apos;re struggling
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Exams, admissions and family expectations can feel overwhelming. You are not alone, and talking helps.</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-2.5">
                <Icon icon={Siren} className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-ink)]" />
                <span>
                  <strong>Emergency:</strong> call <strong>999</strong> (National Emergency Service, Bangladesh).
                </span>
              </li>
              <li className="flex gap-2.5">
                <Icon icon={Phone} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <span>
                  <strong>Kaan Pete Roi</strong> — free, confidential emotional support in Bangla and English. Search “Kaan Pete Roi” for their current helpline hours and numbers.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Icon icon={MessageCircle} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <span>Talk to someone you trust — a friend, family member, teacher or your university counselling centre.</span>
              </li>
            </ul>
            <p className="mt-4 rounded-lg bg-subtle px-3.5 py-2.5 text-xs leading-relaxed text-muted">If you see a post where someone may be at risk, use “Report → Someone may be at risk of self-harm”. Our team reaches out privately with support — never with punishment.</p>
          </section>

          <section aria-labelledby="report-h" className="card p-6">
            <span className="icon-tile">
              <Icon icon={Flag} />
            </span>
            <h2 id="report-h" className="mt-4 text-lg font-bold">
              Report something
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              On any post, answer, profile or session, choose <strong className="text-ink">Report</strong>. Scam and safety reports are reviewed first. Not a member? Use the <Link href="/report-concern">public report form</Link>. If you have already lost money, also report to the police and keep every receipt and message.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
