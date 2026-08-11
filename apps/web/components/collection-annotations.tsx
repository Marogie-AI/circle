"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deleteCollectionAnnotation,
  saveCollectionAnnotation,
  type CollectionAnnotationState,
} from "@/app/(app)/groups/[slug]/collection-actions";

type Annotation = {
  authorId: string;
  authorName: string;
  body: string;
};

const EMPTY: CollectionAnnotationState = { error: null, saved: false };

const actionClass =
  "rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The collection page owns the data read; this compact client island owns each
 * member's one note plus the edit/delete controls that need local pending state.
 */
export function CollectionAnnotations({
  slug,
  collectionId,
  postId,
  annotations,
  currentUserId,
  canModerate,
}: {
  slug: string;
  collectionId: string;
  postId: string;
  annotations: Annotation[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const ownAnnotation = annotations.find((annotation) => annotation.authorId === currentUserId);
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDeleteTransition] = useTransition();
  const [state, formAction, pending] = useActionState(
    async (_previous: CollectionAnnotationState, formData: FormData) =>
      saveCollectionAnnotation(slug, collectionId, postId, formData),
    EMPTY,
  );

  // Server Actions return fresh RSC props after revalidation. Once that response has
  // landed, close the editor so the newly rendered note is what the author sees.
  useEffect(() => {
    if (state.saved) setEditing(false);
  }, [state]);

  const remove = (authorId: string) => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      try {
        await deleteCollectionAnnotation(slug, collectionId, postId, authorId);
      } catch {
        setDeleteError("Could not remove this note. Please try again.");
      }
    });
  };

  return (
    <section className="mt-3 border-t border-hairline pt-3" aria-label="Collection notes">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</h2>
        {ownAnnotation && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className={actionClass}>
            Edit your note
          </button>
        ) : null}
      </div>

      {annotations.length ? (
        <ul className="mt-2 space-y-2.5">
          {annotations.map((annotation) => {
            const isOwn = annotation.authorId === currentUserId;
            const canDelete = isOwn || canModerate;

            return (
              <li key={annotation.authorId} className="min-w-0 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{annotation.authorName}</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words leading-6 text-muted">
                      {annotation.body}
                    </p>
                  </div>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => remove(annotation.authorId)}
                      disabled={deleting}
                      className={`${actionClass} shrink-0 hover:text-red-600`}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Add why this is useful to the group.</p>
      )}

      {editing || !ownAnnotation ? (
        <form action={formAction} className="mt-3">
          <label htmlFor={`annotation-${postId}`} className="sr-only">
            {ownAnnotation ? "Edit your note" : "Add your note"}
          </label>
          <textarea
            id={`annotation-${postId}`}
            name="body"
            required
            minLength={1}
            maxLength={500}
            rows={2}
            disabled={pending}
            defaultValue={ownAnnotation?.body ?? ""}
            placeholder="Why is this useful?"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10 disabled:bg-canvas"
          />
          {state.error ? (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {state.error}
            </p>
          ) : null}
          <div className="mt-2 flex items-center justify-end gap-2">
            {ownAnnotation ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(false)}
                className={actionClass}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-inverse px-3 py-1.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : ownAnnotation ? "Save note" : "Add note"}
            </button>
          </div>
        </form>
      ) : null}

      {deleteError ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {deleteError}
        </p>
      ) : null}
    </section>
  );
}
