import Link from "next/link";
import { Form } from "@/components/form";
import { Checkbox, Flash, FormSection, Notice, PageHeader, TextArea, TextField } from "@/components/ui";
import { BadgeCheck, Icon, KeyRound, Lock, ShieldCheck } from "@/components/icons";
import { requirePermission } from "@/lib/auth/current";
import { listTopics } from "@/lib/content/topics";
import { getMentorProfile } from "@/lib/mentors/service";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Become a mentor" };

const STEPS = [
  { icon: ShieldCheck, title: "You share evidence", body: "Official university or employer pages, LinkedIn, publications, admission letters with personal data hidden." },
  { icon: BadgeCheck, title: "A moderator reviews it", body: "By hand, usually within 5 days. We may ask for a short video call." },
  { icon: KeyRound, title: "You turn on 2FA", body: "Only then do you appear in the directory." },
  { icon: Lock, title: "Your badge stays honest", body: "It shows what was verified and when, and can be revoked for misconduct." },
];

export default async function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("mentor.apply", "/mentors/apply");
  const [topics, existing] = await Promise.all([listTopics(), getMentorProfile(actor.user.id)]);
  return (
    <>
      <PageHeader
        eyebrow="Mentoring"
        title="Become a verified mentor"
        subtitle="Help students the way you wish someone had helped you. Mentoring is free in this phase — your reward is reputation and badges that mean something."
        breadcrumbs={[{ href: "/mentors", label: "Mentors" }, { label: "Apply" }]}
      />
      <Flash searchParams={await searchParams} />
      {existing?.status === "pending" ? <Notice tone="info">Your application is under review. Submitting again replaces it.</Notice> : null}
      {existing?.status === "approved" ? (
        <Notice tone="success">
          You&apos;re already a mentor.{" "}
          <Link href="/mentor" className="font-semibold">
            Go to your mentor dashboard →
          </Link>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="card overflow-hidden px-5 sm:px-7">
          <Form action="/api/mentors/apply" back="/mentors/apply">
            <FormSection title="Who you are" description="This becomes your mentor headline.">
              <TextField label="Headline" name="headline" required minLength={10} maxLength={120} placeholder="MSc Informatics, TU Munich · ex-BUET CSE" defaultValue={existing?.headline} />
            </FormSection>
            <FormSection title="What you can help with" description="Choose up to 5 topics.">
              <fieldset>
                <legend className="sr-only">Topics you can help with (up to 5)</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {topics.map((t) => (
                    <label key={t.id} className="choice-card py-2.5 text-sm">
                      <input type="checkbox" name="topicIds[]" value={t.id} defaultChecked={existing?.topics.some((x) => x.id === t.id)} />
                      <span className="font-medium text-ink">{t.nameEn}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </FormSection>
            <FormSection title="Evidence" description="What a moderator checks. Never upload ID documents — we don't need your NID and will never ask for it.">
              <TextArea label="Your relevant experience and credentials" name="credentials" required minLength={40} maxLength={3000} rows={6} defaultValue={existing?.credentials} hint="Where did you study or work, when, and what did you go through that others can learn from?" />
              <TextArea label="Evidence links" name="evidenceLinks" rows={3} maxLength={1500} defaultValue={existing?.evidenceLinks.join("\n")} placeholder="https://…" hint="One https:// link per line." />
            </FormSection>
            <FormSection title="Honesty statements" description="Shown publicly on your profile.">
              <TextArea label="Scope of your advice" name="scopeStatement" required minLength={30} maxLength={1000} rows={3} defaultValue={existing?.scopeStatement} hint="What you CAN and CANNOT advise on. Example: “I can advise on German master's admissions and student life. I am not an immigration lawyer and can't advise on visa refusals or appeals.”" />
              <TextArea label="Conflict of interest declaration" name="conflictOfInterest" required minLength={4} maxLength={1000} rows={2} defaultValue={existing?.conflictOfInterest} hint="Do you receive money, commission or benefits from any university, agency, consultancy or employer you might recommend? Write “None” if not." />
            </FormSection>
            <FormSection title="Availability" last>
              <TextField label="Maximum free sessions per week" name="weeklyCapacity" type="number" min={1} max={20} defaultValue={existing?.weeklyCapacity ?? 3} required fieldClassName="max-w-xs" />
              <Checkbox
                name="agreeMentorCode"
                required
                label={
                  <>
                    I agree to the mentor code in the <Link href="/guidelines#mentors">Community Guidelines</Link>.
                  </>
                }
                description="I will never ask a student for money, documents or contact outside the platform, never promise outcomes, and always disclose conflicts of interest."
              />
            </FormSection>
            <div className="-mx-5 flex justify-end border-t border-line bg-subtle px-5 py-4 sm:-mx-7 sm:px-7">
              <button className="btn btn-primary" type="submit">
                Submit application
              </button>
            </div>
          </Form>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-bold">How verification works</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map((s) => (
                <li key={s.title} className="flex gap-3">
                  <span className="icon-tile h-9 w-9">
                    <Icon icon={s.icon} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{s.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
