import type { ReactNode } from "react";

/**
 * One header shape for every app page: eyebrow, title, optional meta line, actions.
 * Pages used to each roll their own, which is how the feed ended up with a lone
 * floating button above a separate title row.
 */
export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: string;
  /** A plain string for most pages; a node when the title is a breadcrumb. */
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-wide text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/* Shared motion: 200ms with the ease-out-quart token, a 1px hover lift with a soft
   shadow, and a press-down scale. Transform/shadow are listed explicitly so the lift
   animates; motion-reduce drops the transforms but keeps the color transitions. */
export const buttonMotion =
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out-quart hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:scale-[0.97] motion-reduce:transform-none";

export const buttonStyles = {
  primary: `inline-flex items-center justify-center rounded-lg bg-inverse px-3.5 py-2 text-sm font-medium text-inverse-ink ${buttonMotion} hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2`,
  secondary: `inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink ${buttonMotion} hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2`,
} as const;
