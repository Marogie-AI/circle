import Link from "next/link";
import { createCollection, deleteCollection } from "@/app/(app)/saved/actions";
import { CollectionFilter } from "@/components/collection-filter";
import { CollectionPicker } from "@/components/collection-picker";
import { BookmarkIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { SavedPostActions } from "@/components/saved-post-actions";
import { SavedStateFilter } from "@/components/saved-state-filter";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/guard";
import {
  listCollections,
  listSavedPosts,
  parseSavedState,
} from "@/lib/queries/saved";
import { isUuid } from "@/lib/post";

type SavedPageProps = {
  searchParams: Promise<{ c?: string | string[]; state?: string | string[] }>;
};

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const session = await requireSession();
  const query = await searchParams;
  const active = first(query.c);
  const activeId = active && isUuid(active) ? active : undefined;
  const state = parseSavedState(first(query.state));

  const [collections, saved] = await Promise.all([
    listCollections(session.user.id),
    listSavedPosts(session.user.id, activeId, state),
  ]);
  const activeCollection = collections.find((c) => c.id === activeId);

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeader
        title="Saved"
        meta={
          <span>
            {saved.length === 1 ? "1 post" : `${saved.length} posts`}
            {activeCollection ? ` in ${activeCollection.name}` : ", across all your groups"}.
          </span>
        }
      />

      {/* State + collection filters, create */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SavedStateFilter activeState={state} collectionId={activeId} />
        {collections.length ? (
          <CollectionFilter
            collections={collections}
            activeId={activeId}
            activeState={state}
          />
        ) : null}
        <form action={createCollection} className="flex items-center gap-2">
          <input
            name="name"
            required
            maxLength={50}
            placeholder="New collection"
            className="w-44 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10"
          />
          <SubmitButton
            pendingLabel="Adding…"
            className="rounded-lg bg-inverse px-3 py-1.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
          >
            Create
          </SubmitButton>
        </form>
        {activeCollection ? (
          <form action={deleteCollection.bind(null, activeCollection.id)}>
            <SubmitButton
              pendingLabel="Deleting…"
              className="rounded-full px-2.5 py-1 text-sm font-medium text-muted transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
            >
              Delete “{activeCollection.name}”
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {saved.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-rail text-muted">
            <BookmarkIcon size={22} />
          </span>
          <h2 className="mt-4 font-semibold tracking-tight text-ink">
            {activeCollection ? `Nothing in ${activeCollection.name}` : "Nothing saved yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {activeCollection
              ? "Use the dropdown on any saved post to file it here."
              : "Hit the bookmark on any post and it will wait for you here."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
          {saved.map((post) => (
            <li
              key={post.id}
              className={`flex items-center gap-3 pr-5 ${post.readAt && !post.archivedAt ? "opacity-60" : ""}`}
            >
              <Link
                href={`/groups/${post.groupSlug}/p/${post.id}`}
                className="flex min-w-0 flex-1 items-center gap-4 py-4 pl-5 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverse"
              >
                {post.ogImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.ogImage}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="hidden size-12 shrink-0 rounded-lg object-cover sm:block"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{post.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    {post.groupName} · {post.authorName} · saved {shortDate(post.savedAt)}
                  </span>
                </span>
              </Link>
              <SavedPostActions
                postId={post.id}
                read={Boolean(post.readAt)}
                archived={Boolean(post.archivedAt)}
              />
              <CollectionPicker
                postId={post.id}
                current={post.collectionId}
                collections={collections}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
