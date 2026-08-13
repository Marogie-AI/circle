import Link from "next/link";
import { PostForm } from "@/app/(app)/groups/[slug]/new/post-form";
import { requireMember } from "@/lib/guard";
import { DEFAULT_POST_KIND, parsePostKind } from "@/lib/kind";
import { listGroupMembers } from "@/lib/queries/groups";

type NewPostPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kind?: string | string[] }>;
};

export default async function NewPostPage({
  params,
  searchParams,
}: NewPostPageProps) {
  const { slug } = await params;
  const { group } = await requireMember(slug);
  const members = await listGroupMembers(group.id);

  // The sidebar quick-add menu links here with ?kind=. An unrecognised value just falls
  // back to the default rather than 404ing — all it does is preselect a dropdown.
  const requestedKind = (await searchParams).kind;
  const initialKind =
    parsePostKind(Array.isArray(requestedKind) ? requestedKind[0] : requestedKind) ??
    DEFAULT_POST_KIND;

  return (
    // pt-9 puts the back link's optical centre on the sidebar wordmark's:
    // 12px rail padding + 20px card padding + half of the 28px logo.
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-14">
      <header>
        <Link href={`/groups/${slug}`} className="text-sm font-medium text-muted transition hover:text-ink">← Back to {group.name}</Link>
      </header>
      <section className="pt-8 pb-10">
        <p className="text-sm font-medium text-muted">{group.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">New post</h1>
        <p className="mt-2 text-sm text-muted">Share something useful with your circle.</p>
        <PostForm slug={slug} members={members} initialKind={initialKind} />
      </section>
    </main>
  );
}
