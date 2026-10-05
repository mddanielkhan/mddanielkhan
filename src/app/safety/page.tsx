import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { BRAND } from "@/lib/config/brand";

export const metadata = { title: "Safety & scam red flags", description: "How to spot study-abroad, scholarship and job scams targeting Bangladeshi students — and how to stay safe." };

const FLAGS = [
  ["“100% visa / admission / scholarship guaranteed”", "No one can guarantee a sovereign government's visa decision or a university's admission. Guarantees are the #1 sign of a fake agent.", "“১০০% ভিসা গ্যারান্টি” — এটি প্রতারণার সবচেয়ে বড় লক্ষণ।"],
  ["Advance or “processing” fees paid to a person", "Real universities and scholarship bodies take fees through their official portal — never to a personal bKash/Nagad number.", "ব্যক্তিগত বিকাশ/নগদ নম্বরে আগাম টাকা কখনো নয়।"],
  ["“We can arrange your bank statement / solvency / documents”", "This is document fraud. It can get you a permanent visa ban and criminal charges.", "ব্যাংক স্টেটমেন্ট বা কাগজ “বানিয়ে দেওয়া” মানেই জালিয়াতি।"],
  ["Pressure and urgency", "“Only 2 seats left, pay today” is a pressure tactic. Real deadlines are published on official sites.", "“আজই টাকা দিন” — চাপ দেওয়াই প্রতারকের কৌশল।"],
  ["Move to WhatsApp / Telegram / imo", "Scammers move you off-platform so there's no record and no protection. Keep conversations here.", "হোয়াটসঅ্যাপ/টেলিগ্রামে নিয়ে যেতে চাইলে সতর্ক হোন।"],
  ["You were “selected” for something you never applied to", "Unsolicited awards that require a fee to release the money are advance-fee fraud.", "আবেদন না করেই “নির্বাচিত” — এবং টাকা চাইছে? প্রতারণা।"],
  ["Overseas jobs with a “package cost”", "Paying lakhs for a job abroad is how students are trafficked into forced labour and scam compounds. Check licences with BMET.", "বিদেশে চাকরির “প্যাকেজ” — মানবপাচারের ঝুঁকি।"],
  ["IELTS/exam “proxy” or leaked questions", "Exam fraud leads to permanent bans from testing bodies and visa refusals.", "প্রক্সি পরীক্ষা বা প্রশ্নফাঁস — স্থায়ী নিষেধাজ্ঞার কারণ।"],
  ["Someone asks for your OTP, password or NID photo", `${BRAND.name} staff will never ask for these. Nobody legitimate needs your OTP.`, "OTP, পাসওয়ার্ড বা এনআইডির ছবি কাউকে দেবেন না।"],
];

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Safety & scam red flags" subtitle="Bangladeshi students lose life savings to fake agents every year. Share this page — it might save someone a year and their family's money." />
      <Card className="mb-6 bg-[var(--color-brand-50)]">
        <p className="text-lg font-semibold">🔒 {BRAND.goldenRule}</p>
        <p className="mt-1">{BRAND.goldenRuleBn}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {FLAGS.map(([title, body, bn]) => (
          <Card key={title}>
            <h2 className="font-semibold">🚩 {title}</h2>
            <p className="mt-1 text-sm">{body}</p>
            <p lang="bn" className="muted mt-1 text-sm">
              {bn}
            </p>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-10 text-xl font-bold">Before you pay anyone for anything</h2>
      <Card>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Find the opportunity on the organisation&apos;s <strong>official website</strong> yourself — don&apos;t use the link you were sent.</li>
          <li>Email the university&apos;s official admissions address (from their website) to confirm any offer letter.</li>
          <li>Check that any agency is licensed and has a physical office; ask other students who used them — here, publicly.</li>
          <li>Pay only through official portals, with a receipt in your own name.</li>
          <li>If something feels rushed or secret, stop. Ask the community: “Is this real?” — that question is always welcome here.</li>
        </ol>
      </Card>
      <h2 id="support" className="mb-3 mt-10 text-xl font-bold">
        If you&apos;re struggling
      </h2>
      <Card>
        <p>Exams, admissions and family expectations can feel overwhelming. You are not alone, and talking helps.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Emergency:</strong> call <strong>999</strong> (National Emergency Service, Bangladesh).
          </li>
          <li>
            <strong>Kaan Pete Roi</strong> — free, confidential emotional support (Bangla & English). Search “Kaan Pete Roi” for their current helpline hours and numbers.
          </li>
          <li>Talk to someone you trust — a friend, family member, teacher or your university counselling centre.</li>
        </ul>
        <p className="muted mt-3 text-sm">If you see a post where someone may be at risk, use “Report → Someone may be at risk of self-harm”. Our team reaches out privately with support — never with punishment.</p>
      </Card>
      <h2 className="mb-3 mt-10 text-xl font-bold">Report something</h2>
      <Card>
        <p>
          On any post, answer, profile or session, choose <strong>Report</strong>. Scam and safety reports are reviewed first. Not a member? Use the <Link href="/report-concern">public report form</Link>. If you have already lost money, also report to the police and keep every receipt and message.
        </p>
      </Card>
    </div>
  );
}
