import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Form } from "@/components/form";
import { Flash, Notice, PageHeader, TextArea, TextField } from "@/components/ui";
import { requireActor } from "@/lib/auth/current";
import { getPostForViewer } from "@/lib/content/service";
import type { Params, SearchParams } from "@/lib/http/page";

export const metadata = { title: "Edit post", robots: { index: false } };

export default async function EditPostPage({ params, searchParams }: { params: Params<"id">; searchParams: SearchParams }) {
  const { id } = await params;
  const actor = await requireActor(`/posts/${id}/edit`);
  const data = await getPostForViewer(id, actor);
  if (!data) notFound();
  if (!data.isAuthor) redirect(`/posts/${id}`);
  const p = data.post;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit post" breadcrumbs={[{ href: "/feed", label: "Community" }, { href: `/posts/${id}`, label: p.title.length > 48 ? `${p.title.slice(0, 48)}…` : p.title }, { label: "Edit" }]} />
      <Flash searchParams={await searchParams} />
      <Notice tone="info">Edits are screened again. Editing a verified opportunity removes its checkmark until a moderator re-checks it.</Notice>
      <div className="card p-5 sm:p-7">
        <Form action="/api/posts/edit" back={`/posts/${id}/edit`}>
          <input type="hidden" name="id" value={p.id} />
          <TextField label="Title" name="title" required minLength={8} maxLength={160} defaultValue={p.title} />
          <TextArea label="Details" name="body" required minLength={20} maxLength={20000} rows={12} defaultValue={p.body} />
          <TextField label="Tags" name="tags" maxLength={120} defaultValue={p.tags.join(", ")} optional />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <button type="submit" className="btn btn-primary">
              Save changes
            </button>
            <Link href={`/posts/${id}`} className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
