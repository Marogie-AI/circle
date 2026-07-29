import Link from "next/link";
import { PostForm } from "@/app/(app)/groups/[slug]/new/post-form";
import { requireMember } from "@/lib/guard";

type NewPostPageProps = { params: Promise<{ slug: string }> };

export default async function NewPostPage({ params }: NewPostPageProps) {
  const { slug } = await params;
  const { group } = await requireMember(slug);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10 sm:py-14">
      <header className="border-b border-neutral-200 pb-6">
        <Link href={`/groups/${slug}`} className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900">← Back to {group.name}</Link>
      </header>
      <section className="py-10">
        <p className="text-sm font-medium text-neutral-500">{group.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">New post</h1>
        <p className="mt-2 text-sm text-neutral-500">Share something useful with your circle.</p>
        <PostForm slug={slug} />
      </section>
    </main>
  );
}
