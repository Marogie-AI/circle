import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BookmarkIcon } from "@/components/icons";
import { requireSession } from "@/lib/guard";
import { listSavedPosts } from "@/lib/queries/saved";

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function SavedPage() {
  const session = await requireSession();
  const saved = await listSavedPosts(session.user.id);

  return (
    <main className="min-h-screen w-full px-6 py-10 sm:px-10 sm:py-12">
      <PageHeader
        title="Saved"
        meta={
          <span>
            {saved.length === 1 ? "1 post" : `${saved.length} posts`} kept for later,
            across all your groups.
          </span>
        }
      />

      {saved.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-rail text-muted">
            <BookmarkIcon size={22} />
          </span>
          <h2 className="mt-4 font-semibold tracking-tight text-ink">
            Nothing saved yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Hit the bookmark on any post and it will wait for you here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {saved.map((post) => (
            <li
              key={post.id}
              className="border-b border-hairline last:border-b-0"
            >
              <Link
                href={`/groups/${post.groupSlug}/p/${post.id}`}
                className="flex min-w-0 items-center gap-4 px-5 py-4 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverse"
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
                  <span className="block truncate font-medium text-ink">
                    {post.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    {post.groupName} · {post.authorName} · saved {shortDate(post.savedAt)}
                  </span>
                </span>
                {post.tags.length ? (
                  <span className="hidden shrink-0 gap-1 md:flex">
                    {post.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-rail px-2 py-0.5 text-xs font-medium text-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
