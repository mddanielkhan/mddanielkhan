import { Form } from "@/components/form";
import { Checkbox, Flash, Notice, PageHeader, SelectField, TextArea, TextField } from "@/components/ui";
import { Icon, LifeBuoy, Siren } from "@/components/icons";
import { REASON_LABELS } from "@/lib/reports/service";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Report a concern" };

export default async function ReportConcernPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Report a concern" subtitle="For anyone — you don't need an account. Report a scam, unlawful content, impersonation or a safety risk on this site." />
      <Flash searchParams={await searchParams} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="card p-5 sm:p-7">
          <Form action="/api/reports/public" back="/report-concern">
            <TextField label="Link to the post or profile" name="url" required maxLength={500} placeholder="https://…/posts/… or https://…/u/…" />
            <SelectField label="What's the problem?" name="reason" options={Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }))} />
            <TextArea label="What happened?" name="details" required minLength={20} maxLength={3000} rows={6} hint="Include dates and what you were asked to do. Don't include passwords or ID numbers." />
            <TextField label="Your email" name="contact" type="email" required maxLength={254} hint="So we can tell you what we did. It's never shown to the person you report." />
            <Checkbox name="goodFaith" required label="I believe this report is accurate and I'm making it in good faith." />
            <button className="btn btn-primary mt-2" type="submit">
              Send report
            </button>
          </Form>
        </div>
        <aside className="space-y-4">
          <Notice tone="danger" title="In danger right now?" icon={Siren} className="">
            Call <strong>999</strong> (National Emergency Service, Bangladesh).
          </Notice>
          <div className="card p-5 text-sm leading-relaxed text-muted">
            <p className="flex items-center gap-2 font-bold text-ink">
              <Icon icon={LifeBuoy} className="h-4.5 w-4.5 text-brand-ink" />
              Lost money?
            </p>
            <p className="mt-1.5">Report to the police as well, and keep every receipt, number and message. We can preserve evidence on our side when you report here.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
