import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { groups, memberships, posts, user } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/guard";

type ProfilePageProps = {
  params: Promise<{ id: string }>;
};

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  const session = await requireSession();

  const [target] = await db
    .select({ id: user.id, name: user.name, bio: user.bio })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!target) notFound();

  // SECURITY: the membership join is the authorization check. A post is listed only when
  // the VIEWER (session.user.id) is a member of the post's group AND the TARGET authored
  // it. Joining memberships on the viewer — not the author — is what stops this from
  // leaking a user's posts out of groups the viewer isn't in. Mirrors listSavedPosts.
  const authored = await db
    .select({
      id: posts.id,
      title: posts.title,
      tags: posts.tags,
      createdAt: posts.createdAt,
      groupSlug: groups.slug,
      groupName: groups.name,
    })
    .from(posts)
    .innerJoin(groups, eq(groups.id, posts.groupId))
    .innerJoin(
      memberships,
      and(
        eq(memberships.groupId, posts.groupId),
        eq(memberships.userId, session.user.id),
      ),
    )
    .where(
      and(eq(posts.authorId, target.id), eq(posts.status, "published")),
    )
    .orderBy(desc(posts.createdAt))
    .limit(200);

  const displayName = target.name;
  const isSelf = target.id === session.user.id;

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeader eyebrow="Profile" title={displayName} />

      <div className="max-w-xl pt-8">
        <div className="flex items-start gap-4">
          <Avatar name={displayName} size="lg" />
          <div className="min-w-0 pt-1">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {displayName}
            </h2>
            {target.bio ? (
              <p className="mt-1 whitespace-pre-line text-sm text-muted">
                {target.bio}
              </p>
            ) : (
              <p className="mt-1 text-sm text-faint">No bio yet.</p>
            )}
          </div>
        </div>

        <section className="mt-10 border-t border-hairline pt-8">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            Posts
          </h3>
          <p className="mt-1 text-sm text-muted">
            {isSelf ? "Your posts" : `Posts by ${displayName}`} in groups you share.
          </p>

          {authored.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
              <p className="text-sm text-muted">
                No posts in any group you both belong to.
              </p>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
              {authored.map((post) => (
                <li key={post.id} className="border-b border-hairline last:border-b-0">
                  <Link
                    href={`/groups/${post.groupSlug}/p/${post.id}`}
                    className="flex min-w-0 items-center gap-4 px-5 py-4 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverse"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {post.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {post.groupName} · {shortDate(post.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
