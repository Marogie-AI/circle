"use client";

// Throwaway comparison page for action-bar polish options. Not linked from
// anywhere; visit /mock/action-bar directly. Delete once a direction is picked.

import { useEffect, useRef, useState } from "react";
import { BookmarkIcon, MoreIcon, PlusIcon } from "@/components/icons";

const baseButton =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2";

const motionButton =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-[background-color,box-shadow,transform,border-color] duration-200 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-px hover:bg-hover hover:shadow-sm active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2";

/** One interactive replica of the post-detail action row. */
function MockBar({
  treatment,
}: {
  treatment: "baseline" | "motion" | "pop" | "menu" | "tooltip" | "keys";
}) {
  const [saved, setSaved] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);
  const [flashNew, setFlashNew] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Section 5: shortcuts scoped to the focused/hovered section via a keydown
  // listener that only fires while the pointer is over this bar.
  const hovering = useRef(false);
  useEffect(() => {
    if (treatment !== "keys") return;
    const onKey = (e: KeyboardEvent) => {
      if (!hovering.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "s") setSaved((v) => !v);
      if (e.key === "p") setPinned((v) => !v);
      if (e.key === "n") {
        setFlashNew(true);
        setTimeout(() => setFlashNew(false), 400);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [treatment]);

  const btn = treatment === "baseline" ? baseButton : motionButton;
  const popClass = treatment === "pop" || treatment === "keys" ? "mock-pop-target" : "";
  const withTooltip = treatment === "tooltip" || treatment === "keys";

  const tooltip = (label: string) =>
    withTooltip ? (
      <span
        role="tooltip"
        className="mock-tooltip pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-inverse px-2 py-1 text-xs font-medium text-inverse-ink opacity-0 shadow-sm"
      >
        {label}
      </span>
    ) : null;

  return (
    <fieldset
      className="m-0 flex items-center gap-2 border-0 p-0"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
    >
      {/* Save */}
      <span className="relative inline-flex">
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => setSaved((v) => !v)}
          className={`${btn} gap-1.5 mock-tooltip-anchor ${
            saved
              ? "!border-inverse !bg-inverse !text-inverse-ink"
              : ""
          } ${treatment === "pop" || treatment === "keys" ? "duration-300" : ""}`}
        >
          <span key={saved ? "on" : "off"} className={saved ? popClass : ""}>
            <BookmarkIcon size={16} fill={saved ? "currentColor" : "none"} />
          </span>
          {saved ? "Saved" : "Save"}
          {treatment === "keys" ? <Kbd>S</Kbd> : null}
        </button>
        {tooltip("Save · S")}
      </span>

      {/* Pin */}
      <span className="relative inline-flex">
        <button
          type="button"
          aria-pressed={pinned}
          onClick={() => setPinned((v) => !v)}
          className={`${btn} gap-1.5 mock-tooltip-anchor ${
            pinned ? "!border-inverse !bg-inverse !text-inverse-ink" : ""
          }`}
        >
          <span key={pinned ? "on" : "off"} className={pinned ? popClass : ""}>
            {pinned ? "Unpin" : "Pin"}
          </span>
          {treatment === "keys" ? <Kbd>P</Kbd> : null}
        </button>
        {tooltip("Pin · P")}
      </span>

      {/* New post */}
      <span className="relative inline-flex">
        <button
          type="button"
          className={`${btn} gap-1.5 mock-tooltip-anchor ${flashNew ? "!bg-hover ring-2 ring-inverse" : ""}`}
        >
          <PlusIcon size={16} />
          New post
          {treatment === "keys" ? <Kbd>N</Kbd> : null}
        </button>
        {tooltip("New post · N")}
      </span>

      {/* Overflow */}
      <div ref={wrapRef} className="relative">
        <span className="relative inline-flex">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`mock-tooltip-anchor rounded-lg p-1.5 text-faint transition hover:bg-hover hover:text-ink ${
              treatment !== "baseline" ? "active:scale-90 duration-200" : ""
            }`}
          >
            <MoreIcon size={16} />
          </button>
          {tooltip("More")}
        </span>
        {open ? (
          <div
            role="menu"
            className={`absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line shadow-lg ${
              treatment === "menu" || treatment === "keys"
                ? "mock-menu-in origin-top-right bg-surface/95 backdrop-blur-sm"
                : "bg-surface"
            }`}
          >
            {["Edit post", "Copy link", "Delete post"].map((item) => (
              <button
                key={item}
                type="button"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition hover:bg-hover ${
                  item === "Delete post" ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" : "text-ink"
                }`}
              >
                {item}
                {treatment === "keys" && item === "Edit post" ? <Kbd>E</Kbd> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1 rounded border border-line bg-canvas px-1 font-sans text-[10px] font-medium text-faint">
      {children}
    </kbd>
  );
}

const SECTIONS: {
  treatment: "baseline" | "motion" | "pop" | "menu" | "tooltip" | "keys";
  title: string;
  blurb: string;
}[] = [
  {
    treatment: "baseline",
    title: "0 · Baseline (current)",
    blurb: "Exact copy of today's styling for comparison.",
  },
  {
    treatment: "motion",
    title: "1 · Motion tokens + press feedback",
    blurb:
      "Custom easing, 200ms transitions, hover lift with soft shadow, active press-down scale. Tactile without being loud.",
  },
  {
    treatment: "pop",
    title: "2 · Save/Pin micro-interaction",
    blurb:
      "Toggling Save pops the bookmark glyph and the fill sweeps in over 300ms instead of snapping. Same for Pin.",
  },
  {
    treatment: "menu",
    title: "3 · Animated overflow menu",
    blurb:
      "Menu enters with a scaled fade from its top-right origin over a blurred translucent surface. Open the “…” to see it.",
  },
  {
    treatment: "tooltip",
    title: "4 · Tooltips with shortcut hints",
    blurb:
      "CSS-only tooltips on a hover delay, labelled with the action and its shortcut. Hover any control.",
  },
  {
    treatment: "keys",
    title: "5 · Keyboard shortcuts (everything combined)",
    blurb:
      "Hover this bar, then press S to save, P to pin, N to flash New post. Kbd hints inline. Includes all treatments above.",
  },
];

export default function ActionBarMockPage() {
  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-16 pt-9 sm:px-10">
      {/* Scoped styles for the mock only — globals.css untouched. */}
      <style>{`
        @keyframes mock-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .mock-pop-target {
          display: inline-flex;
          animation: mock-pop 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes mock-menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .mock-menu-in {
          animation: mock-menu-in 140ms cubic-bezier(0.25, 1, 0.5, 1);
        }
        .mock-tooltip-anchor:hover + .mock-tooltip,
        .mock-tooltip-anchor:focus-visible + .mock-tooltip {
          opacity: 1;
          transition: opacity 150ms ease-out 400ms;
        }
        @media (prefers-reduced-motion: reduce) {
          .mock-pop-target, .mock-menu-in { animation: none; }
        }
      `}</style>

      <h1 className="text-xl font-semibold text-ink">Action bar: premium treatments</h1>
      <p className="mt-1 text-sm text-muted">
        Five options side by side, each fully interactive. Mock state only — nothing writes to the
        database.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {SECTIONS.map((s) => (
          <section
            key={s.treatment}
            className="rounded-2xl border border-line bg-surface p-6"
          >
            <h2 className="text-sm font-semibold text-ink">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.blurb}</p>
            <div className="mt-5 flex items-center justify-end border-t border-line pt-5">
              <MockBar treatment={s.treatment} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
