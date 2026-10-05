import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { BRAND } from "@/lib/config/brand";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`About ${BRAND.name} (${BRAND.nameBn})`} subtitle="শিকড় means “roots”: a place where students put down roots and grow." />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-2 font-semibold">Why we exist</h2>
          <p>
            Bangladeshi students rely on unmoderated groups and paid agents for life-changing decisions about admissions, scholarships, visas and careers. Too many lose money and years to fake agents. {BRAND.name} is built around one promise: every trust signal here is earned and checkable, and nobody may ask you for money.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">How it works</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li><strong>Ask and share</strong> in a structured community — questions, guides with official sources, verified opportunities and deadlines.</li>
            <li><strong>Find a verified mentor</strong>: people whose credentials a moderator checked by hand, with public scope and conflict-of-interest statements.</li>
            <li><strong>Book a free session</strong>. Both of you confirm it happened; only then can you leave feedback that counts.</li>
            <li><strong>Earn trust</strong> by helping: trust levels, reputation by topic and badges are computed from what actually happened — never bought.</li>
          </ol>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">What we will never do</h2>
          <p>Sell data, run ads, let anyone pay for ranking or badges, or ask you for your NID, password or OTP.</p>
          <p className="mt-2">
            See our <Link href="/transparency">transparency report</Link> and <Link href="/security">security practices</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}
