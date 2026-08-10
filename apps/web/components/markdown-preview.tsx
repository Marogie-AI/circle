"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Extracted so the compose form can pull it in with next/dynamic.
 *
 * react-markdown + remark-gfm is ~144 KB of client JS. Importing it at module scope in
 * post-form.tsx meant every visit to compose or edit downloaded the whole markdown
 * pipeline, even though most posts are written without ever opening Preview. As its own
 * chunk it loads on first Preview click and never for anyone who doesn't use it.
 *
 * Still deliberately no rehype-raw — that would reopen raw HTML injection.
 */
export function MarkdownPreview({ body }: { body: string }) {
  if (!body.trim()) {
    return <p className="text-sm text-faint">Nothing to preview yet.</p>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h2 className="mb-2 mt-5 text-xl font-semibold text-ink">{children}</h2>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-5 text-lg font-semibold text-ink">{children}</h2>
        ),
        p: ({ children }) => <p className="my-3">{children}</p>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink underline underline-offset-4"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="md-bullets my-3 space-y-1 pl-6">{children}</ul>,
        ol: ({ children }) => (
          <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>
        ),
        code: ({ children }) => (
          <code className="rounded bg-rail px-1.5 py-0.5 text-sm">{children}</code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-2 border-line pl-4 text-muted">
            {children}
          </blockquote>
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
