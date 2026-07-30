"use client";

import { useActionState, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createPost,
  updatePost,
  type PostActionState,
} from "@/app/(app)/groups/[slug]/actions";

const initialState: PostActionState = { error: null };

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10 disabled:bg-canvas";

const TAG_SUGGESTIONS = [
  "engineering", "music", "life", "health", "money", "tools", "books", "career",
];

export type PostDraft = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  tags: string[];
};

/** Shared by the new-post and edit-post pages so validation and layout can't diverge. */
export function PostForm({ slug, post }: { slug: string; post?: PostDraft }) {
  const [state, formAction, pending] = useActionState(
    async (_previous: PostActionState, formData: FormData) =>
      post ? updatePost(slug, post.id, formData) : createPost(slug, formData),
    initialState,
  );

  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");

  const tabClass = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition ${
      active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
    }`;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="title" className="block text-sm font-medium text-ink">
            Title
          </label>
          <span className={`text-xs tabular-nums ${title.length > 200 ? "text-red-600" : "text-faint"}`}>
            {title.length}/200
          </span>
        </div>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={1}
          maxLength={200}
          disabled={pending}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
          placeholder="What's worth sharing?"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor="body" className="block text-sm font-medium text-ink">
            Body
          </label>
          <div className="flex items-center gap-3">
            <span className={`text-xs tabular-nums ${body.length > 10000 ? "text-red-600" : "text-faint"}`}>
              {body.length.toLocaleString()}/10,000
            </span>
            <div className="flex gap-0.5 rounded-lg bg-rail p-0.5">
              <button type="button" onClick={() => setTab("write")} className={tabClass(tab === "write")}>
                Write
              </button>
              <button type="button" onClick={() => setTab("preview")} className={tabClass(tab === "preview")}>
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* The textarea stays mounted while previewing so its value is still submitted
            and the caret position survives tab switching. */}
        <textarea
          id="body"
          name="body"
          required
          minLength={1}
          maxLength={10000}
          rows={14}
          disabled={pending}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${field} resize-y leading-6 ${tab === "preview" ? "hidden" : ""}`}
          placeholder="Add context, a takeaway, or a note for the group…"
        />

        {tab === "preview" ? (
          <div className="min-h-[22rem] rounded-lg border border-line bg-surface px-4 py-3 text-[0.95rem] leading-7 text-ink">
            {body.trim() ? (
              // same renderer as the post page, and deliberately still no rehype-raw
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h2 className="mb-2 mt-5 text-xl font-semibold text-ink">{children}</h2>,
                  h2: ({ children }) => <h2 className="mb-2 mt-5 text-lg font-semibold text-ink">{children}</h2>,
                  p: ({ children }) => <p className="my-3">{children}</p>,
                  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4">{children}</a>,
                  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
                  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
                  code: ({ children }) => <code className="rounded bg-rail px-1.5 py-0.5 text-sm">{children}</code>,
                  blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-line pl-4 text-muted">{children}</blockquote>,
                }}
              >
                {body}
              </ReactMarkdown>
            ) : (
              <p className="text-sm text-faint">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted">Markdown is supported.</p>
        )}
      </div>

      <div>
        <label htmlFor="url" className="mb-1.5 block text-sm font-medium text-ink">
          Link <span className="font-normal text-faint">(optional)</span>
        </label>
        <input
          id="url"
          name="url"
          type="url"
          disabled={pending}
          defaultValue={post?.url ?? ""}
          className={field}
          placeholder="https://example.com"
        />
        <p className="mt-1.5 text-xs text-muted">
          We'll fetch the title, description and image to build a preview card.
        </p>
      </div>

      <div>
        <label htmlFor="tags" className="mb-1.5 block text-sm font-medium text-ink">
          Tags <span className="font-normal text-faint">(optional)</span>
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          list="tag-suggestions"
          disabled={pending}
          defaultValue={post?.tags.join(", ") ?? ""}
          className={field}
          placeholder="engineering, tools, books"
        />
        <datalist id="tag-suggestions">
          {TAG_SUGGESTIONS.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <p className="mt-1.5 text-xs text-muted">Comma separated, up to five tags.</p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? post
            ? "Saving…"
            : "Publishing…"
          : post
            ? "Save changes"
            : "Publish post"}
      </button>
    </form>
  );
}
