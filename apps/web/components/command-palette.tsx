"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserGroup } from "@/lib/queries/groups";
import type { SearchHit } from "@/lib/queries/search";
import { paletteSearch } from "@/app/(app)/search-action";
import { GroupIcon, SearchIcon } from "@/components/icons";

type Item = { key: string; label: string; hint?: string; href: string; kind: "group" | "post" };

export function CommandPalette({ groups }: { groups: UserGroup[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setActive(0);
      // focus after paint, otherwise the input isn't mounted yet
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // debounce so typing doesn't fire a query per keystroke
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          setHits(await paletteSearch(q));
        } catch {
          setHits([]);
        }
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open]);

  const q = query.trim().toLowerCase();
  const groupItems: Item[] = groups
    .filter((g) => !q || g.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map((g) => ({
      key: `g-${g.id}`,
      label: g.name,
      hint: "Group",
      href: `/groups/${g.slug}`,
      kind: "group",
    }));

  const postItems: Item[] = hits.map((h) => ({
    key: `p-${h.id}`,
    label: h.title,
    hint: h.groupName,
    href: `/groups/${h.groupSlug}/p/${h.id}`,
    kind: "post",
  }));

  const items = [...groupItems, ...postItems];
  const clamped = Math.min(active, Math.max(items.length - 1, 0));

  const go = (item?: Item) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-inverse/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4">
          <SearchIcon size={17} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(items[clamped]);
              }
            }}
            placeholder="Search groups and posts…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-faint"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-faint">
              {query.trim().length < 2 ? "Type to search" : "Nothing found"}
            </li>
          ) : (
            items.map((item, index) => (
              <li key={item.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                    index === clamped ? "bg-rail" : "hover:bg-hover"
                  }`}
                >
                  {item.kind === "group" ? (
                    <GroupIcon size={15} className="shrink-0 text-faint" />
                  ) : (
                    <SearchIcon size={15} className="shrink-0 text-faint" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {item.label}
                  </span>
                  {item.hint ? (
                    <span className="shrink-0 text-xs text-faint">{item.hint}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
