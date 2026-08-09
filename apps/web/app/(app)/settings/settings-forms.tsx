"use client";

import { useActionState } from "react";
import {
  changePassword,
  updateDisplayName,
  type SettingsState,
} from "@/app/(app)/settings/actions";

const EMPTY: SettingsState = {};

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10";
const submitClass =
  "rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function Feedback({ state }: { state: SettingsState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-lg bg-rail px-3 py-2 text-sm text-ink">
        {state.ok}
      </p>
    );
  return null;
}

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(updateDisplayName, EMPTY);

  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink">
          Display name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={1}
          maxLength={60}
          defaultValue={initialName}
          disabled={pending}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-muted">
          Shown on your posts, comments and avatar.
        </p>
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, EMPTY);

  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <label
          htmlFor="currentPassword"
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="newPassword"
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
