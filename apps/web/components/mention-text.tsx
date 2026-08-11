import Link from "next/link";
import { type Mentionable, splitMentions } from "@/lib/mentions";

/**
 * Renders plain text (comment bodies) with @mentions linked to profiles. Server
 * component — no hooks — so it drops straight into the post page's comment list.
 * Preserves whitespace/newlines the way the old <p> did.
 */
export function MentionText({
  text,
  members,
  className,
}: {
  text: string;
  members: Mentionable[];
  className?: string;
}) {
  // Key by running character offset (stable, unique) rather than array index.
  let offset = 0;
  const keyed = splitMentions(text, members).map((part) => {
    const key =
      part.type === "mention"
        ? `m${offset}-${part.member.id}`
        : `t${offset}`;
    offset += part.type === "mention" ? part.member.name.length + 1 : part.value.length;
    return { part, key };
  });

  return (
    <p className={className}>
      {keyed.map(({ part, key }) =>
        part.type === "mention" ? (
          <Link
            key={key}
            href={`/u/${part.member.id}`}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            @{part.member.name}
          </Link>
        ) : (
          <span key={key}>{part.value}</span>
        ),
      )}
    </p>
  );
}
