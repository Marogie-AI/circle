"use client";

import { useActionState } from "react";
import { createPost } from "@/app/(app)/groups/[slug]/actions";
import type { PostActionState } from "@/app/(app)/groups/[slug]/actions";

const initialState: PostActionState = { error: null };

export function PostForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    async (_previous: PostActionState, formData: FormData) =>
      createPost(slug, formData),
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-neutral-900">Title</label>
        <input id="title" name="title" type="text" required minLength={1} maxLength={200} disabled={pending} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50" placeholder="What’s worth sharing?" />
      </div>
      <div>
        <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-neutral-900">Body</label>
        <textarea id="body" name="body" required minLength={1} maxLength={10000} rows={12} disabled={pending} className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50" placeholder="Add context, a takeaway, or a note for the group…" />
        <p className="mt-1.5 text-xs text-neutral-500">Markdown is supported.</p>
      </div>
      <div>
        <label htmlFor="url" className="mb-1.5 block text-sm font-medium text-neutral-900">Link <span className="font-normal text-neutral-400">(optional)</span></label>
        <input id="url" name="url" type="url" disabled={pending} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50" placeholder="https://example.com" />
      </div>
      <div>
        <label htmlFor="tags" className="mb-1.5 block text-sm font-medium text-neutral-900">Tags <span className="font-normal text-neutral-400">(optional)</span></label>
        <input id="tags" name="tags" type="text" list="tag-suggestions" disabled={pending} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50" placeholder="engineering, tools, books" />
        <datalist id="tag-suggestions">
          {[
            "engineering", "music", "life", "health", "money", "tools", "books", "career",
          ].map((tag) => <option key={tag} value={tag} />)}
        </datalist>
        <p className="mt-1.5 text-xs text-neutral-500">Comma separated, up to five tags.</p>
      </div>

      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "Publishing…" : "Publish post"}
      </button>
    </form>
  );
}
