import { Form } from "@/components/form";
import { Card, Flash, Notice, PageHeader, SelectField, TextArea, TextField } from "@/components/ui";
import { requirePermission } from "@/lib/auth/current";
import { listTopics } from "@/lib/content/topics";
import { isStaffRole } from "@/lib/policy/policy";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Ask or share" };

export default async function NewPostPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requirePermission("post.create", "/posts/new");
  const topics = await listTopics();
  const staff = isStaffRole(actor.user.role);
  const types = [
    { value: "question", label: "Question — ask the community" },
    { value: "discussion", label: "Discussion" },
    { value: "guide", label: "Guide — a how-to with official sources" },
    { value: "opportunity", label: "Opportunity — scholarship, internship, competition, job" },
    { value: "story", label: "Success story" },
    ...(staff ? [{ value: "safety_alert", label: "Safety alert (staff only)" }] : []),
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ask or share" subtitle="Clear titles get better answers. Write in English or Bangla — both are welcome." />
      <Flash searchParams={params} />
      <Notice tone="info">
        Never post phone numbers, payment details or ID documents. Posts asking for money, promising guaranteed visas/admissions, or steering people to WhatsApp/Telegram are held for review.
      </Notice>
      <Card>
        <Form action="/api/posts" back="/posts/new">
          <SelectField label="Type" name="type" options={types} defaultValue={sp(params.type) ?? "question"} />
          <SelectField label="Topic" name="topicId" options={topics.map((t) => ({ value: t.id, label: `${t.nameEn} · ${t.nameBn}` }))} />
          <TextField label="Title" name="title" required minLength={8} maxLength={160} placeholder="e.g. Which documents do I need for a German student visa from Dhaka?" />
          <TextArea label="Details" name="body" required minLength={20} maxLength={20000} rows={10} hint="Share context: your background, what you've tried, deadlines. Don't include personal contact details." />
          <TextField label="Tags (optional, comma separated)" name="tags" maxLength={120} placeholder="germany, masters, cse" />
          <fieldset className="mb-4 rounded-lg border border-[var(--color-line)] p-4">
            <legend className="px-1 font-semibold">For opportunities only</legend>
            <p className="muted mb-3 text-sm">Opportunities need the organisation, an official https:// link and an honest answer about fees. Newer members&apos; opportunities are checked by a moderator first.</p>
            <TextField label="Organisation" name="orgName" maxLength={120} placeholder="e.g. DAAD, University of Tokyo, BRAC" />
            <TextField label="Official link (https://)" name="officialUrl" type="url" maxLength={500} placeholder="https://www.daad.de/…" />
            <TextField label="Deadline (optional)" name="deadline" type="date" />
            <SelectField label="Does it involve any fee?" name="involvesFee" options={[{ value: "", label: "— choose —" }, { value: "no", label: "No — completely free to apply" }, { value: "yes", label: "Yes — there is an application or other fee" }]} />
          </fieldset>
          <fieldset className="mb-4 rounded-lg border border-[var(--color-line)] p-4">
            <legend className="px-1 font-semibold">For guides only</legend>
            <TextArea label="Official sources (one https:// link per line)" name="sources" rows={3} maxLength={1500} hint="Guides about rules, fees or deadlines must cite the embassy, university or ministry source. We show a 'last verified' date." />
          </fieldset>
          <button type="submit" className="btn btn-primary">
            Publish
          </button>
        </Form>
      </Card>
    </div>
  );
}
