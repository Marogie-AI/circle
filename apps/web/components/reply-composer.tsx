"use client";

import { useRef, useState } from "react";
import { MentionTextarea } from "@/components/mention-textarea";
import { SubmitButton } from "@/components/submit-button";
import type { Mentionable } from "@/lib/mentions";

/**
 * Reply composer for a comment. Two modes:
 *  - Uncontrolled (default): renders its own "Reply" toggle button, opens the form inline.
 *  - Controlled (`open` + `onOpenChange` passed): renders only the form when open, so the
 *    caller can put the "Reply" trigger wherever it wants (e.g. inline in an action row).
 * Closes and clears on submit so a posted reply doesn't leave a stale box open.
 */
export function ReplyComposer({
  action,
  members,
  commentId,
  authorName,
  open: controlledOpen,
  onOpenChange,
}: {
  action: (formData: FormData) => Promise<void>;
  members: Mentionable[];
  commentId: string;
  authorName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) =>
    controlled ? onOpenChange?.(v) : setInternalOpen(v);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    // Controlled callers render their own trigger; only the uncontrolled mode shows one.
    if (controlled) return null;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-normal text-faint transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
      >
        Reply
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
        setOpen(false);
      }}
      className="mt-1"
    >
      <input type="hidden" name="parentId" value={commentId} />
      <label htmlFor={`reply-${commentId}`} className="sr-only">
        Reply to {authorName}
      </label>
      <MentionTextarea
        id={`reply-${commentId}`}
        name="body"
        members={members}
        required
        minLength={1}
        maxLength={5000}
        rows={2}
        placeholder="Reply… use @ to mention"
        className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-faint focus:border-inverse focus:ring-1 focus:ring-inverse/10"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            formRef.current?.reset();
            setOpen(false);
          }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
        >
          Cancel
        </button>
        <SubmitButton
          pendingLabel="Posting…"
          className="rounded-lg bg-inverse px-3.5 py-2 text-sm font-medium text-inverse-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
        >
          Reply
        </SubmitButton>
      </div>
    </form>
  );
}
