import Link from "next/link";
import { Form } from "@/components/form";
import { Flash, PageHeader, SelectField, TextArea, TextField } from "@/components/ui";
import { BookOpen, Compass, Icon, Lightbulb, MessageSquareText, MessagesSquare, ShieldAlert, Sparkles, TriangleAlert, type IconNode } from "@/components/icons";
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
  const types: Array<{ value: string; label: string; hint: string; icon: IconNode }> = [
    { value: "question", label: "Question", hint: "Ask the community", icon: MessageSquareText },
    { value: "discussion", label: "Discussion", hint: "Start a conversation", icon: MessagesSquare },
    { value: "guide", label: "Guide", hint: "A how-to with official sources", icon: BookOpen },
    { value: "opportunity", label: "Opportunity", hint: "Scholarship, internship, job", icon: Compass },
    { value: "story", label: "Success story", hint: "Share what worked for you", icon: Sparkles },
    ...(staff ? [{ value: "safety_alert", label: "Safety alert", hint: "Staff only", icon: ShieldAlert }] : []),
  ];
  const requested = sp(params.type);
  const selected = types.some((t) => t.value === requested) ? requested : "question";

  return (
    <>
      <PageHeader eyebrow="Community" title="Ask or share" subtitle="Clear titles get better answers. Write in English or Bangla — both are welcome." breadcrumbs={[{ href: "/feed", label: "Community" }, { label: "New post" }]} />
      <Flash searchParams={params} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="card p-5 sm:p-7">
          <Form action="/api/posts" back="/posts/new" className="composer">
            <fieldset className="mb-6">
              <legend className="label">What are you posting?</legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {types.map((t) => (
                  <label key={t.value} className="choice-card">
                    <input type="radio" name="type" value={t.value} defaultChecked={t.value === selected} className="sr-only" />
                    <Icon icon={t.icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" />
                    <span>
                      <span className="block text-sm font-bold text-ink">{t.label}</span>
                      <span className="block text-xs text-muted">{t.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <SelectField label="Topic" name="topicId" options={topics.map((t) => ({ value: t.id, label: `${t.nameEn} · ${t.nameBn}` }))} />
            <TextField label="Title" name="title" required minLength={8} maxLength={160} placeholder="e.g. Which documents do I need for a German student visa from Dhaka?" hint="One clear question or statement, 8–160 characters." />
            <TextArea label="Details" name="body" required minLength={20} maxLength={20000} rows={10} hint="Share context: your background, what you've tried, deadlines. Don't include phone numbers or other contact details." />
            <TextField label="Tags" name="tags" maxLength={120} placeholder="germany, masters, cse" optional hint="Comma separated — up to a few words that help people find this." />

            <fieldset className="fieldset when-opportunity">
              <legend>Opportunity details</legend>
              <p className="mb-4 text-sm text-muted">Opportunities need the organisation, an official https:// link and an honest answer about fees. Newer members&apos; opportunities are checked by a moderator first.</p>
              <TextField label="Organisation" name="orgName" maxLength={120} placeholder="e.g. DAAD, University of Tokyo, BRAC" />
              <TextField label="Official link" name="officialUrl" type="url" maxLength={500} placeholder="https://www.daad.de/…" hint="Must start with https:// and point to the organisation's own site." />
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <TextField label="Deadline" name="deadline" type="date" optional />
                <SelectField label="Does it involve any fee?" name="involvesFee" options={[{ value: "", label: "— Choose —" }, { value: "no", label: "No — free to apply" }, { value: "yes", label: "Yes — there is a fee" }]} />
              </div>
            </fieldset>

            <fieldset className="fieldset when-guide">
              <legend>Guide sources</legend>
              <TextArea label="Official sources" name="sources" rows={3} maxLength={1500} placeholder="https://…" hint="One https:// link per line. Guides about rules, fees or deadlines must cite the embassy, university or ministry. We show a 'last verified' date." />
            </fieldset>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button type="submit" className="btn btn-primary btn-lg">
                Publish
              </button>
              <p className="text-sm text-muted">
                By posting you agree to the <Link href="/guidelines">community guidelines</Link>.
              </p>
            </div>
          </Form>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <span className="icon-tile">
              <Icon icon={Lightbulb} />
            </span>
            <h2 className="mt-3 font-bold">What makes a great post</h2>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
              <li>Your situation: degree, results, budget, timeline.</li>
              <li>What you already found, with links.</li>
              <li>The one decision you need help with.</li>
            </ul>
          </div>
          <div className="card border-[var(--color-warn-line)] p-5">
            <span className="icon-tile icon-tile-danger">
              <Icon icon={TriangleAlert} />
            </span>
            <h2 className="mt-3 font-bold">Held for review</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Posts asking for money, promising guaranteed visas or admissions, sharing payment numbers, or steering people to WhatsApp/Telegram are held for a moderator — or not published.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
