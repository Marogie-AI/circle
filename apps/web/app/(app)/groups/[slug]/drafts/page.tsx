import Link from "next/link";
import { getDrafts } from "@/lib/queries/feed";
import { requireMember } from "@/lib/guard";

type DraftsPageProps = { params: Promise<{ slug: string }> };

function fullDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function DraftsPage({ params }: DraftsPageProps) {
  const { slug } = await params;
  const { group, user } = await requireMember(slug);
  const drafts = await getDrafts(group.id, user.id);

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <header>
        <Link
          href={`/groups/${slug}`}
          className="text-sm font-medium text-muted transition hover:text-ink"
        >
          ← Back to {group.name}
        </Link>
      </header>

      <section className="pt-8 pb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Your drafts</h1>
        <p className="mt-2 text-sm text-muted">
          Only you can see these. Publish one to share it with the group.
        </p>

        {drafts.length ? (
          <ul className="mt-6 divide-y divide-hairline rounded-2xl border border-line bg-surface shadow-sm">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/groups/${slug}/p/${draft.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-hover"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">
                    {draft.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{fullDate(draft.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <h2 className="font-semibold tracking-tight text-ink">No drafts</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Start a post and choose “Save draft” to keep it here until you’re ready.
            </p>
            <div className="mt-5 flex justify-center">
              <Link
                href={`/groups/${slug}/new`}
                className="rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90"
              >
                New post
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
