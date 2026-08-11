"use client";

import { useRef, useState } from "react";
import type { Mentionable } from "@/lib/mentions";

type Props = {
  members: Mentionable[];
  name?: string;
  id?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
};

const MAX_SUGGESTIONS = 6;

/**
 * Textarea with an @mention autocomplete. Typing "@" (at the start or after whitespace)
 * opens a member picker filtered by what follows; choosing one inserts "@Full Name ".
 * The mention set is derived server-side from the body text, so this component only has
 * to insert the right name — it carries no hidden id field.
 *
 * Works controlled (pass value + onValueChange, as the post composer does) or
 * uncontrolled (defaultValue + name, as the comment box does — a controlled input with a
 * name still submits its value).
 */
export function MentionTextarea({
  members,
  value,
  defaultValue,
  onValueChange,
  className,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [internal, setInternal] = useState(value ?? defaultValue ?? "");
  const text = value ?? internal;

  const [menu, setMenu] = useState<{ at: number; query: string } | null>(null);
  const [active, setActive] = useState(0);

  const suggestions = menu
    ? members
        .filter((m) => m.name.toLowerCase().startsWith(menu.query.toLowerCase()))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  function update(next: string) {
    setInternal(next);
    onValueChange?.(next);
  }

  function syncMenu(next: string, caret: number) {
    const before = next.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1) return setMenu(null);
    const boundaryOk = at === 0 || /\s/.test(before[at - 1]);
    const query = before.slice(at + 1);
    if (!boundaryOk || query.includes("\n")) return setMenu(null);
    setMenu({ at, query });
    setActive(0);
  }

  function pick(member: Mentionable) {
    const el = ref.current;
    if (!el || !menu) return;
    const caret = el.selectionStart ?? text.length;
    const next = `${text.slice(0, menu.at)}@${member.name} ${text.slice(caret)}`;
    update(next);
    setMenu(null);
    const pos = menu.at + 1 + member.name.length + 1;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={ref}
        value={text}
        className={className}
        onChange={(e) => {
          update(e.target.value);
          syncMenu(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (!menu || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setMenu(null);
          }
        }}
        onBlur={() => {
          // let a click on a suggestion land before the menu closes
          setTimeout(() => setMenu(null), 120);
        }}
      />
      {menu && suggestions.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded-lg border border-line bg-elevated p-1 shadow-lg">
          {suggestions.map((member, index) => (
            <li key={member.id}>
              <button
                type="button"
                // onMouseDown, not onClick: fires before the textarea blur closes the menu
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(member);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                  index === active ? "bg-hover text-ink" : "text-muted"
                }`}
              >
                <span className="truncate">{member.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
