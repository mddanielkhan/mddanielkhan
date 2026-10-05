import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { getMentorProfile, listPendingApplications } from "@/lib/mentors/service";
import { Form } from "@/components/form";
import { Avatar, Checkbox, EmptyState, Flash, Notice, PageHeader, Pill, TextArea, TextField, formatDateTime } from "@/components/ui";
import { CircleCheck, ExternalLink, GraduationCap, Icon, MailCheck, TriangleAlert } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Mentor applications", robots: { index: false } };

export default async function MentorApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod/mentors");
  const apps = await listPendingApplications();
  const withTopics = await Promise.all(apps.map(async (a) => ({ ...a, topics: (await getMentorProfile(a.user.id))?.topics ?? [] })));
  return (
    <>
      <PageHeader title="Mentor applications" subtitle="Verify evidence against independent sources (official university or employer pages). When in doubt, ask for a short video call. Never request ID documents or NID numbers." />
      <Flash searchParams={await searchParams} />
      {withTopics.length === 0 ? (
        <EmptyState title="No pending applications" icon={GraduationCap}>
          New applications appear here for review.
        </EmptyState>
      ) : null}
      <div className="space-y-5">
        {withTopics.map(({ mentor: m, user: u, topics }) => (
          <article key={u.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-start gap-4 border-b border-line p-5">
              <Avatar name={u.displayName} size={48} />
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">
                  <Link href={`/u/${u.username}`} className="text-ink">
                    {u.displayName}
                  </Link>{" "}
                  <span className="font-normal text-muted">— {m.headline}</span>
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Pill>TL{u.trustLevel}</Pill>
                  {u.emailVerifiedAt ? (
                    <Pill tone="brand" icon={MailCheck}>
                      Email verified
                    </Pill>
                  ) : (
                    <Pill tone="danger" icon={TriangleAlert}>
                      Email NOT verified
                    </Pill>
                  )}
                  <span>Account since {formatDateTime(u.createdAt)}</span>
                  <span>· Submitted {formatDateTime(m.submittedAt)}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((t) => (
                    <Pill key={t.id}>{t.name}</Pill>
                  ))}
                </div>
                {(
                  [
                    ["Credentials", m.credentials],
                    ["Scope of advice", m.scopeStatement],
                    ["Conflict of interest", m.conflictOfInterest],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{k}</h3>
                    <p className="prose-user mt-1 leading-relaxed text-ink-soft">{v}</p>
                  </div>
                ))}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Evidence links</h3>
                  {m.evidenceLinks.length ? (
                    <ul className="mt-1 space-y-1">
                      {m.evidenceLinks.map((l) => (
                        <li key={l} className="break-all">
                          <a href={l} rel="nofollow noopener noreferrer" target="_blank" className="inline-flex items-center gap-1">
                            {l} <Icon icon={ExternalLink} className="h-3 w-3 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-muted">None provided.</p>
                  )}
                </div>
                {m.reviewNote ? <Notice tone="warn">{m.reviewNote}</Notice> : null}
              </div>
              <div className="panel-subtle p-4">
                <h3 className="text-sm font-bold">Your decision</h3>
                <Form action="/api/mod/mentors/review" back="/mod/mentors" className="mt-3">
                  <input type="hidden" name="userId" value={u.id} />
                  <TextField id={`label-${u.id}`} label="Badge label (what you verified)" name="credentialLabel" maxLength={120} placeholder="MSc Informatics, TU Munich (2024)" />
                  <TextArea id={`note-${u.id}`} label="Note to the applicant" name="note" required minLength={5} maxLength={1000} rows={3} />
                  <Checkbox name="founding" label="Founding mentor" />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary btn-sm" type="submit" name="decision" value="approve">
                      <Icon icon={CircleCheck} />
                      Approve
                    </button>
                    <button className="btn btn-secondary btn-sm" type="submit" name="decision" value="reject">
                      Reject
                    </button>
                  </div>
                </Form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
