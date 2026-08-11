"use client";

import { useActionState, useState } from "react";
import {
  changePassword,
  updateBio,
  updateDisplayName,
  type SettingsState,
} from "@/app/(app)/settings/actions";
import { ClearIcon, TickIcon } from "@/components/icons";

const EMPTY: SettingsState = {};

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10";
const submitClass =
  "rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

// ✓ save / ✕ reset icon buttons that sit next to a field.
const iconBtn =
  "inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";
const saveBtn = `${iconBtn} bg-inverse text-inverse-ink hover:opacity-90`;
const resetBtn = `${iconBtn} border border-line bg-surface text-muted hover:bg-hover hover:text-ink`;

function Feedback({ state }: { state: SettingsState }) {
  // Compact inline confirmation — a full-width filled slab read as heavier than the
  // action it was confirming.
  if (state.error)
    return (
      <p role="alert" className="text-sm text-red-600">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
        <span aria-hidden>✓</span>
        {state.ok}
      </p>
    );
  return null;
}

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(updateDisplayName, EMPTY);
  const [value, setValue] = useState(initialName);
  const unchanged = value === initialName;

  return (
    <form action={action} className="mt-5 space-y-2">
      <label htmlFor="name" className="block text-sm font-medium text-ink">
        Display name
      </label>
      <div className="flex items-center gap-2">
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={1}
          maxLength={60}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          aria-label="Save name"
          disabled={pending || unchanged}
          className={saveBtn}
        >
          <TickIcon size={18} />
        </button>
        <button
          type="button"
          aria-label="Discard changes"
          disabled={pending || unchanged}
          onClick={() => setValue(initialName)}
          className={resetBtn}
        >
          <ClearIcon size={18} />
        </button>
      </div>
      <p className="text-xs text-muted">Shown on your posts, comments and avatar.</p>
      <Feedback state={state} />
    </form>
  );
}

export function BioForm({ initialBio }: { initialBio: string }) {
  const [state, action, pending] = useActionState(updateBio, EMPTY);
  const [value, setValue] = useState(initialBio);
  const unchanged = value === initialBio;

  return (
    <form action={action} className="mt-5 space-y-2">
      <label htmlFor="bio" className="block text-sm font-medium text-ink">
        Bio
      </label>
      <div className="flex items-start gap-2">
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={200}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className={`${inputClass} min-w-0 flex-1 resize-none`}
        />
        <button
          type="submit"
          aria-label="Save bio"
          disabled={pending || unchanged}
          className={saveBtn}
        >
          <TickIcon size={18} />
        </button>
        <button
          type="button"
          aria-label="Discard changes"
          disabled={pending || unchanged}
          onClick={() => setValue(initialBio)}
          className={resetBtn}
        >
          <ClearIcon size={18} />
        </button>
      </div>
      <p className="text-xs text-muted">
        A short line about you, shown on your profile. Up to 200 characters.
      </p>
      <Feedback state={state} />
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
