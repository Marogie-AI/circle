import Link from "next/link";
import { PostForm } from "@/app/(app)/groups/[slug]/new/post-form";
import { requireMember } from "@/lib/guard";

type NewPostPageProps = { params: Promise<{ slug: string }> };

export default async function NewPostPage({ params }: NewPostPageProps) {
  const { slug } = await params;
  const { group } = await requireMember(slug);

  return (
    // pt-9 puts the back link's optical centre on the sidebar wordmark's:
    // 12px rail padding + 20px card padding + half of the 28px logo.
    <main className="mx-auto min-h-full w-full max-w-4xl px-6 pb-10 pt-9 sm:pb-14">
      <header>
        <Link href={`/groups/${slug}`} className="text-sm font-medium text-muted transition hover:text-ink">← Back to {group.name}</Link>
      </header>
      <section className="pt-8 pb-10">
        <p className="text-sm font-medium text-muted">{group.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">New post</h1>
        <p className="mt-2 text-sm text-muted">Share something useful with your circle.</p>
        <PostForm slug={slug} />
      </section>
    </main>
  );
}
