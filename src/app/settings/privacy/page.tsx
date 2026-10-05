import { requireActor } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { Checkbox, Flash, PageHeader, Panel, TextField } from "@/components/ui";
import { Download, Icon } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Privacy & data", robots: { index: false } };

export default async function PrivacySettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireActor("/settings/privacy");
  return (
    <>
      <PageHeader title="Privacy & your data" subtitle="Your rights under Bangladesh's Personal Data Protection Act 2026: access, portability, correction and erasure." />
      <Flash searchParams={await searchParams} />
      <div className="space-y-6">
        <Panel title="Download your data" description="A machine-readable JSON file with everything we hold about you: account, profile, posts, answers, sessions, feedback, notifications, consents, reputation history and moderation decisions.">
          <Form action="/api/account/export" back="/settings/privacy">
            <button className="btn btn-secondary" type="submit">
              <Icon icon={Download} />
              Download my data
            </button>
          </Form>
        </Panel>
        <Panel
          tone="danger"
          title="Delete your account"
          description="Your personal data is erased immediately. Your posts and answers stay in their threads as “Deleted member” so other students don't lose answers — unless you choose to delete them too. Open sessions are cancelled. Encrypted backups roll off within 30 days."
        >
          <Form action="/api/account/delete" back="/settings/privacy" className="max-w-md">
            <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
            <TextField label='Type "DELETE" to confirm' name="confirm" required pattern="DELETE" autoComplete="off" />
            <Checkbox name="deleteContent" label="Also delete my posts and answers" />
            <button className="btn btn-danger mt-2" type="submit">
              Permanently delete my account
            </button>
          </Form>
        </Panel>
      </div>
    </>
  );
}
