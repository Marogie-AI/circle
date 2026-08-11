import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteGroupCollection,
  removeFromCollection,
} from "@/app/(app)/groups/[slug]/collection-actions";
import { SubmitButton } from "@/components/submit-button";
import { requireMember } from "@/lib/guard";
import {
  getGroupCollection,
  listCollectionPosts,
} from "@/lib/queries/group-collections";
import { isUuid } from "@/lib/post";

type CollectionPageProps = {
  params: Promise<{ slug: string; id: string }>;
};

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug, id } = await params;
  const { group } = await requireMember(slug);
  if (!isUuid(id)) notFound();

  const collection = await getGroupCollection(id, group.id);
  if (!collection) notFound();
  const items = await listCollectionPosts(id);

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <header className="flex items-center justify-between gap-4">
        <Link
          href={`/groups/${slug}`}
          className="text-sm font-medium text-muted transition hover:text-ink"
        >
          ← {group.name}
        </Link>
        <form action={deleteGroupCollection.bind(null, slug, id)}>
          <SubmitButton
            pendingLabel="Deleting…"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
          >
            Delete collection
          </SubmitButton>
        </form>
      </header>

      <section className="pt-6 pb-10">
        <p className="text-sm font-medium text-muted">Shared collection</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          {collection.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {items.length === 1 ? "1 post" : `${items.length} posts`} — any member can add
          to this from a post.
        </p>

        {items.length ? (
          <ul className="mt-6 divide-y divide-hairline rounded-2xl border border-line bg-surface shadow-sm">
            {items.map((post) => (
              <li key={post.id} className="flex items-center gap-3 pr-3">
                <Link
                  href={`/groups/${slug}/p/${post.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 transition hover:bg-hover"
                >
                  {post.ogImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.ogImage}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="hidden size-9 shrink-0 rounded-md object-cover sm:block"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{post.title}</span>
                  <span className="hidden shrink-0 text-xs text-muted sm:block">
                    {post.authorName} · {shortDate(post.createdAt)}
                  </span>
                </Link>
                <form action={removeFromCollection.bind(null, slug, id, post.id)}>
                  <SubmitButton
                    pendingLabel="…"
                    className="rounded-lg px-2.5 py-1 text-sm text-muted transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
                  >
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <h2 className="font-semibold tracking-tight text-ink">Nothing here yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Open any post in {group.name} and use “Add to collection”.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
