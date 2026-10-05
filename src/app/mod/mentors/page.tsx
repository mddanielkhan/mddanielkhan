import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { getMentorProfile, listPendingApplications } from "@/lib/mentors/service";
import { Form } from "@/components/form";
import { ModNav } from "@/components/mod-nav";
import { Card, Checkbox, EmptyState, Flash, Notice, PageHeader, TextArea, TextField, formatDateTime } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Mentor applications", robots: { index: false } };

export default async function MentorApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod/mentors");
  const apps = await listPendingApplications();
  const withTopics = await Promise.all(apps.map(async (a) => ({ ...a, topics: (await getMentorProfile(a.user.id))?.topics ?? [] })));
  return (
    <>
      <PageHeader title="Mentor applications" subtitle="Verify evidence against independent sources (official university/employer pages). When in doubt, ask for a short video call. Never request ID documents or NID numbers." />
      <ModNav current="mentors" />
      <Flash searchParams={await searchParams} />
      {withTopics.length === 0 ? <EmptyState title="No pending applications" /> : null}
      <div className="space-y-4">
        {withTopics.map(({ mentor: m, user: u, topics }) => (
          <Card key={u.id}>
            <h2 className="font-semibold">
              <Link href={`/u/${u.username}`}>{u.displayName}</Link> — {m.headline}
            </h2>
            <p className="muted text-xs">
              TL{u.trustLevel} · account since {formatDateTime(u.createdAt)} · email {u.emailVerifiedAt ? "verified" : "NOT verified"} · submitted {formatDateTime(m.submittedAt)}
            </p>
            <p className="mt-2 text-sm">
              <strong>Topics:</strong> {topics.map((t) => t.name).join(", ")}
            </p>
            <p className="prose-user mt-2 text-sm">
              <strong>Credentials:</strong> {m.credentials}
            </p>
            <p className="prose-user mt-2 text-sm">
              <strong>Scope:</strong> {m.scopeStatement}
            </p>
            <p className="prose-user mt-2 text-sm">
              <strong>Conflict of interest:</strong> {m.conflictOfInterest}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {m.evidenceLinks.map((l) => (
                <li key={l} className="break-all">
                  <a href={l} rel="nofollow noopener noreferrer" target="_blank">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
            {m.reviewNote ? <Notice tone="warn">{m.reviewNote}</Notice> : null}
            <Form action="/api/mod/mentors/review" back="/mod/mentors" className="mt-3">
              <input type="hidden" name="userId" value={u.id} />
              <TextField label="Badge label (what you verified)" name="credentialLabel" maxLength={120} placeholder="MSc Informatics, TU Munich (2024)" />
              <TextArea label="Note to the applicant (required)" name="note" required minLength={5} maxLength={1000} rows={2} />
              <Checkbox name="founding" label="Founding mentor" />
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit" name="decision" value="approve">
                  Approve
                </button>
                <button className="btn btn-secondary" type="submit" name="decision" value="reject">
                  Reject
                </button>
              </div>
            </Form>
          </Card>
        ))}
      </div>
    </>
  );
}
