const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
} as const;

/** Initial-circle avatar. Deterministic, no image upload, no external service. */
export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-inverse font-semibold text-inverse-ink ${SIZES[size]} ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Overlapping avatar stack, e.g. who reacted. Shows +N once past `max`. */
export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size="xs"
          className="ring-2 ring-white -ml-1.5 first:ml-0"
        />
      ))}
      {extra > 0 ? (
        <span className="ml-1.5 text-xs text-muted">+{extra}</span>
      ) : null}
    </span>
  );
}
