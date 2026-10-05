import { requireActor } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { SettingsNav } from "@/components/settings-nav";
import { Card, Checkbox, Flash, PageHeader, TextField } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Privacy & data", robots: { index: false } };

export default async function PrivacySettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireActor("/settings/privacy");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Privacy & your data" subtitle="Your rights under Bangladesh's Personal Data Protection Act 2026: access, portability, correction and erasure." />
      <SettingsNav current="privacy" />
      <Flash searchParams={await searchParams} />
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Download your data</h2>
        <p className="muted mb-3 text-sm">A machine-readable JSON file with everything we hold about you: account, profile, posts, answers, sessions, feedback, notifications, consents, reputation history and moderation decisions.</p>
        <Form action="/api/account/export" back="/settings/privacy">
          <button className="btn btn-secondary" type="submit">
            Download my data
          </button>
        </Form>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-danger-ink)]">Delete your account</h2>
        <p className="muted mb-3 text-sm">
          Your personal data is erased immediately. Your posts and answers stay in their threads as “Deleted member” so other students don&apos;t lose answers — unless you choose to delete them too. Open sessions are cancelled. Encrypted backups roll off within 30 days.
        </p>
        <Form action="/api/account/delete" back="/settings/privacy">
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
          <TextField label='Type "DELETE" to confirm' name="confirm" required pattern="DELETE" />
          <Checkbox name="deleteContent" label="Also delete my posts and answers" />
          <button className="btn btn-danger" type="submit">
            Permanently delete my account
          </button>
        </Form>
      </Card>
    </div>
  );
}
