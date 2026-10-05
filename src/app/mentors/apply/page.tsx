import Link from "next/link";
import { Form } from "@/components/form";
import { Card, Checkbox, Flash, Notice, PageHeader, TextArea, TextField } from "@/components/ui";
import { requirePermission } from "@/lib/auth/current";
import { listTopics } from "@/lib/content/topics";
import { getMentorProfile } from "@/lib/mentors/service";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Become a mentor" };

export default async function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("mentor.apply", "/mentors/apply");
  const [topics, existing] = await Promise.all([listTopics(), getMentorProfile(actor.user.id)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Become a verified mentor" subtitle="Help students the way you wish someone had helped you. Mentoring is free in this phase." />
      <Flash searchParams={await searchParams} />
      {existing?.status === "pending" ? <Notice tone="info">Your application is under review. Submitting again replaces it.</Notice> : null}
      {existing?.status === "approved" ? (
        <Notice tone="success">
          You&apos;re already a mentor. <Link href="/mentor">Go to your mentor dashboard →</Link>
        </Notice>
      ) : null}
      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">How verification works</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Tell us what you can help with and link evidence (official university/employer pages, LinkedIn, publications, admission letters with personal data hidden).</li>
          <li>A moderator reviews it by hand — usually within 5 days. We may ask you for a short video call.</li>
          <li>Once approved, turn on two-factor login. Only then do you appear in the directory.</li>
          <li>Your mentor badge shows what was verified and when. It can be revoked for misconduct.</li>
        </ol>
        <p className="muted mt-2 text-sm">Never upload ID documents here. We don&apos;t need your NID number, and we will never ask for it.</p>
      </Card>
      <Card>
        <Form action="/api/mentors/apply" back="/mentors/apply">
          <TextField label="Headline" name="headline" required minLength={10} maxLength={120} placeholder="MSc Informatics, TU Munich · ex-BUET CSE" defaultValue={existing?.headline} />
          <fieldset className="mb-4">
            <legend className="mb-1 font-medium">Topics you can help with (up to 5)</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {topics.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="topicIds[]" value={t.id} defaultChecked={existing?.topics.some((x) => x.id === t.id)} /> {t.nameEn}
                </label>
              ))}
            </div>
          </fieldset>
          <TextArea label="Your relevant experience and credentials" name="credentials" required minLength={40} maxLength={3000} rows={6} defaultValue={existing?.credentials} hint="Where did you study or work, when, and what did you go through that others can learn from?" />
          <TextArea label="Evidence links (one https:// link per line)" name="evidenceLinks" rows={3} maxLength={1500} defaultValue={existing?.evidenceLinks.join("\n")} />
          <TextArea label="Scope of your advice" name="scopeStatement" required minLength={30} maxLength={1000} rows={3} defaultValue={existing?.scopeStatement} hint="What you CAN and CANNOT advise on. Example: “I can advise on German master's admissions and student life. I am not an immigration lawyer and can't advise on visa refusals or appeals.”" />
          <TextArea label="Conflict of interest declaration (shown publicly)" name="conflictOfInterest" required minLength={4} maxLength={1000} rows={2} defaultValue={existing?.conflictOfInterest} hint="Do you receive money, commission or benefits from any university, agency, consultancy or employer you might recommend? Write “None” if not." />
          <TextField label="Maximum free sessions per week" name="weeklyCapacity" type="number" min={1} max={20} defaultValue={existing?.weeklyCapacity ?? 3} required />
          <Checkbox
            name="agreeMentorCode"
            required
            label={
              <>
                I agree to the mentor code in the <Link href="/guidelines#mentors">Community Guidelines</Link>: I will never ask a student for money, documents or contact outside the platform, never promise outcomes, and always disclose conflicts of interest.
              </>
            }
          />
          <button className="btn btn-primary" type="submit">
            Submit application
          </button>
        </Form>
      </Card>
    </div>
  );
}
