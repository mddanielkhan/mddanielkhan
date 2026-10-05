import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { BRAND } from "@/lib/config/brand";
import { Award, Ban, GraduationCap, HeartHandshake, Icon, MessageSquareText, type IconNode } from "@/components/icons";

export const metadata = { title: "About" };

const HOW: Array<[IconNode, string, string]> = [
  [MessageSquareText, "Ask and share", "A structured community — questions, guides with official sources, verified opportunities and deadlines."],
  [GraduationCap, "Find a verified mentor", "People whose credentials a moderator checked by hand, with public scope and conflict-of-interest statements."],
  [HeartHandshake, "Book a free session", "Both of you confirm it happened; only then can you leave feedback that counts."],
  [Award, "Earn trust by helping", "Trust levels, reputation by topic and badges are computed from what actually happened — never bought."],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="About" title={BRAND.name} subtitle="A link to peers who have already walked the path — verified people, never paid agents." />

      <section className="mb-12">
        <h2 className="text-xl font-bold tracking-tight">Why we exist</h2>
        <p className="mt-3 max-w-3xl text-[1.0625rem] leading-8 text-ink-soft">
          Bangladeshi students rely on unmoderated groups and paid agents for life-changing decisions about admissions, scholarships, visas and careers. Too many lose money and years to fake agents. {BRAND.name} is built around one promise: every trust signal here is earned and checkable, and nobody may ask you for money.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HOW.map(([icon, title, body]) => (
            <li key={title} className="card p-5">
              <span className="icon-tile">
                <Icon icon={icon} />
              </span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
        <span className="icon-tile icon-tile-danger">
          <Icon icon={Ban} />
        </span>
        <div>
          <h2 className="text-lg font-bold">What we will never do</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">Sell data, run ads, let anyone pay for ranking or badges, or ask you for your NID, password or OTP.</p>
          <p className="mt-3 text-sm text-muted">
            See our <Link href="/transparency">transparency report</Link> and <Link href="/security">security practices</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
