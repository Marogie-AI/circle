"use client";

import { useState } from "react";
import {
  BookmarkIcon,
  ChevronDownIcon,
  PlusIcon,
  TickIcon,
} from "@/components/icons";

const collections = ["Design inspiration", "Developer tools", "Weekend plans"];

type Variant = "label" | "split" | "chip" | "icon" | "popover";

function CollectionMenu({
  onChoose,
}: {
  onChoose: (collection: string) => void;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-10 w-56 overflow-hidden rounded-xl border border-line bg-elevated p-1.5 shadow-lg">
      <p className="px-2.5 pb-1 pt-1 text-xs font-medium text-faint">Add to collection</p>
      {collections.map((collection) => (
        <button
          key={collection}
          type="button"
          onClick={() => onChoose(collection)}
          className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-ink transition hover:bg-hover"
        >
          {collection}
        </button>
      ))}
    </div>
  );
}

function Control({ variant }: { variant: Variant }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const choose = (collection: string) => {
    setSelected(collection);
    setOpen(false);
  };

  const triggerClass =
    "inline-flex h-9 items-center gap-2 rounded-lg text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2";
  const isAdded = Boolean(selected);

  return (
    <div className="relative inline-flex min-h-9 items-center gap-2">
      {variant === "label" ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`${triggerClass} border border-line bg-surface px-3 text-ink hover:bg-hover`}
        >
          {isAdded ? <TickIcon size={16} className="text-emerald-600" /> : <BookmarkIcon size={16} />}
          <span>{selected ?? "Add to collection"}</span>
          <ChevronDownIcon size={16} className="text-muted" />
        </button>
      ) : null}

      {variant === "split" ? (
        <div className="inline-flex overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 items-center gap-2 px-3 text-sm font-medium text-ink transition hover:bg-hover focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
          >
            {isAdded ? <TickIcon size={16} className="text-emerald-600" /> : <PlusIcon size={16} />}
            {isAdded ? "Added" : "Add"}
          </button>
          <button
            type="button"
            aria-label="Choose a collection"
            onClick={() => setOpen((value) => !value)}
            className="flex w-9 items-center justify-center border-l border-line text-muted transition hover:bg-hover hover:text-ink focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
          >
            <ChevronDownIcon size={16} />
          </button>
        </div>
      ) : null}

      {variant === "chip" ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={`${triggerClass} border border-dashed border-line bg-surface px-2.5 text-muted hover:border-muted hover:text-ink`}
          >
            <PlusIcon size={15} />
            Add
          </button>
          {selected ? (
            <span className="inline-flex h-8 max-w-44 items-center gap-1.5 truncate rounded-full bg-emerald-50 px-3 text-xs font-medium text-emerald-700">
              <TickIcon size={14} />
              <span className="truncate">{selected}</span>
            </span>
          ) : null}
        </>
      ) : null}

      {variant === "icon" ? (
        <>
          <button
            type="button"
            aria-label="Add to collection"
            onClick={() => setOpen((value) => !value)}
            className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
          >
            {isAdded ? <TickIcon size={17} className="text-emerald-600" /> : <BookmarkIcon size={17} />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-sm font-medium text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
          >
            {selected ?? "Collect"}
          </button>
        </>
      ) : null}

      {variant === "popover" ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`${triggerClass} bg-inverse px-3 text-inverse-ink hover:opacity-90`}
        >
          {isAdded ? <TickIcon size={16} /> : <BookmarkIcon size={16} />}
          {selected ? "Saved to collection" : "Save to collection"}
          <ChevronDownIcon size={16} className="opacity-70" />
        </button>
      ) : null}

      {open ? <CollectionMenu onChoose={choose} /> : null}
    </div>
  );
}

function VariantCard({
  number,
  title,
  note,
  variant,
  emphasis = false,
}: {
  number: string;
  title: string;
  note: string;
  variant: Variant;
  emphasis?: boolean;
}) {
  return (
    <article
      className={`min-w-0 rounded-2xl border p-5 shadow-sm ${
        emphasis ? "border-ink bg-surface" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-faint">{number}</p>
          <h2 className="mt-1 font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {emphasis ? (
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-inverse-ink">
            Recommended
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 min-h-10 text-sm leading-5 text-muted">{note}</p>
      <div className="mt-6 border-t border-hairline pt-5">
        <Control variant={variant} />
      </div>
    </article>
  );
}

/** A visual comparison route only; it makes no collection mutations. */
export function CollectionControlMock() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-2xl">
          <p className="text-sm font-medium text-muted">Component exploration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Collection controls, without the native select
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            Five ways to make “save this for the group” feel intentional. Click a control to
            preview its selected state; nothing on this route writes data.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">In context</p>
          <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold tracking-tight text-ink">
                Building calmer interfaces with fewer controls
              </p>
              <p className="mt-1 text-sm text-muted">A shared link from Priya · 4 min read</p>
            </div>
            <span className="shrink-0 text-sm text-muted">42 comments</span>
          </div>
        </section>

        <section className="mt-6 grid min-w-0 gap-4 md:grid-cols-2">
          <VariantCard
            number="01"
            title="Clear label"
            note="A readable, self-contained button. Familiar and calm, without shouting status beside it."
            variant="label"
          />
          <VariantCard
            number="02"
            title="Split action"
            note="The lightest option for a busy post toolbar: one action, with collection choice on demand."
            variant="split"
            emphasis
          />
          <VariantCard
            number="03"
            title="Add + collection chip"
            note="Keeps the action and its result visibly separate—best when posts can belong to several collections."
            variant="chip"
          />
          <VariantCard
            number="04"
            title="Icon-first"
            note="For compact metadata rows where “Collect” is useful, but should not compete with the post title."
            variant="icon"
          />
          <VariantCard
            number="05"
            title="Primary save"
            note="A decisive treatment for a detail page, where filing a link is the dominant secondary action."
            variant="popover"
          />
        </section>
      </div>
    </main>
  );
}
