import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { PostForm } from "@/app/(app)/groups/[slug]/new/post-form";
import { BackIcon } from "@/components/icons";
import { requireMember } from "@/lib/guard";
import { listGroupMembers } from "@/lib/queries/groups";
import { isUuid } from "@/lib/post";

type EditPageProps = { params: Promise<{ slug: string; id: string }> };

export default async function EditPostPage({ params }: EditPageProps) {
  const { slug, id } = await params;
  const { group, user, role } = await requireMember(slug);
  if (!isUuid(id)) notFound();

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      url: posts.url,
      tags: posts.tags,
      authorId: posts.authorId,
    })
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.groupId, group.id)))
    .limit(1);

  if (!post) notFound();
  const members = await listGroupMembers(group.id);

  // Same rule the updatePost action enforces in its WHERE clause. Checked here too so
  // a non-author never even sees the form — but the action is what actually protects it.
  if (role !== "owner" && post.authorId !== user.id) notFound();

  return (
    <main className="mx-auto min-h-full w-full max-w-4xl px-6 pb-10 pt-9 sm:pb-12">
      <header>
        <Link
          href={`/groups/${slug}/p/${post.id}`}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
        >
          <BackIcon size={16} className="transition group-hover:-translate-x-0.5" />
          Back to post
        </Link>
      </header>
      <section className="py-8">
        <p className="text-sm font-medium text-muted">{group.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          Edit post
        </h1>
        <PostForm slug={slug} post={post} members={members} />
      </section>
    </main>
  );
}
