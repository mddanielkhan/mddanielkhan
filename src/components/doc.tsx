import type { ReactNode } from "react";
import { PageHeader } from "./ui";

/** Long-form document layout: sticky table of contents, readable measure, consistent headings. */
export function DocLayout({
  eyebrow,
  title,
  intro,
  meta,
  toc,
  summary,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  meta?: ReactNode;
  toc: Array<{ id: string; label: string }>;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] xl:gap-14">
      <aside className="hidden lg:block">
        <nav aria-label="On this page" className="sticky top-24">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">On this page</p>
          <ol className="space-y-1 border-l border-line text-sm">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="-ml-px block border-l-2 border-transparent py-1 pl-4 font-medium text-muted no-underline hover:border-brand-500 hover:text-ink">
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <article className="min-w-0 max-w-3xl">
        <PageHeader eyebrow={eyebrow} title={title} subtitle={intro} className="mb-6" />
        {meta ? <p className="mb-8 text-sm text-muted">{meta}</p> : null}
        {summary ? <div className="mb-10">{summary}</div> : null}
        <div className="prose">{children}</div>
      </article>
    </div>
  );
}

/** A plain-language summary box at the top of a policy. */
export function Summary({ title, children, bn }: { title: string; children: ReactNode; bn?: string }) {
  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:p-6">
      <h2 className="text-base font-bold text-brand-800">{title}</h2>
      <div className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{children}</div>
      {bn ? (
        <p lang="bn" className="mt-3 border-t border-brand-200 pt-3 text-sm text-ink-soft">
          {bn}
        </p>
      ) : null}
    </section>
  );
}
