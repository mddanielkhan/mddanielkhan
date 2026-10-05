import { Form } from "@/components/form";
import { Card, Checkbox, Flash, PageHeader, SelectField, TextArea, TextField } from "@/components/ui";
import { REASON_LABELS } from "@/lib/reports/service";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Report a concern" };

export default async function ReportConcernPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Report a concern" subtitle="For anyone — you don't need an account. Use this to report a scam, unlawful content, impersonation or a safety risk on this site." />
      <Flash searchParams={await searchParams} />
      <Card>
        <Form action="/api/reports/public" back="/report-concern">
          <TextField label="Link to the post or profile" name="url" required maxLength={500} placeholder="https://…/posts/… or https://…/u/…" />
          <SelectField label="What's the problem?" name="reason" options={Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }))} />
          <TextArea label="What happened?" name="details" required minLength={20} maxLength={3000} rows={6} hint="Include dates and what you were asked to do. Don't include passwords or ID numbers." />
          <TextField label="Your email (so we can respond)" name="contact" type="email" required maxLength={254} />
          <Checkbox name="goodFaith" required label="I believe this report is accurate and I'm making it in good faith." />
          <button className="btn btn-primary" type="submit">
            Send report
          </button>
        </Form>
        <p className="muted mt-3 text-sm">If you are in danger, call 999. If you lost money, also report to the police and keep every receipt and message.</p>
      </Card>
    </div>
  );
}
