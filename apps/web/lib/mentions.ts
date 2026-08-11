export type Mentionable = { id: string; name: string };

export type MentionPart =
  | { type: "text"; value: string }
  | { type: "mention"; member: Mentionable };

const WORD = /[A-Za-z0-9]/;

/**
 * Split text into plain runs and @mention runs by matching the group's member names.
 *
 * Longest name first so "@Ada Lovelace" wins over a member also called "Ada", and a
 * trailing word-boundary check so "@Adam" does not match member "Ada". The notified set
 * (extractMentionIds) and the linked set (this) come from the same pass, so they can
 * never disagree.
 */
export function splitMentions(
  text: string,
  members: Mentionable[],
): MentionPart[] {
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);
  const parts: MentionPart[] = [];

  const pushText = (ch: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === "text") last.value += ch;
    else parts.push({ type: "text", value: ch });
  };

  let i = 0;
  while (i < text.length) {
    // "@" only starts a mention at the start or after a non-word char, so "a@Ada" (an
    // email-ish string) never linkifies.
    const prevOk = i === 0 || !WORD.test(text[i - 1]);
    if (text[i] === "@" && prevOk) {
      const rest = text.slice(i + 1);
      const restLower = rest.toLowerCase();
      const match = sorted.find((member) => {
        const name = member.name.toLowerCase();
        if (name.length === 0 || !restLower.startsWith(name)) return false;
        const nextChar = rest.charAt(name.length);
        return nextChar === "" || !WORD.test(nextChar);
      });
      if (match) {
        parts.push({ type: "mention", member: match });
        i += 1 + match.name.length;
        continue;
      }
    }
    pushText(text[i]);
    i += 1;
  }

  return parts;
}

/** Unique member ids mentioned in text — used to fan out mention notifications. */
export function extractMentionIds(
  text: string,
  members: Mentionable[],
): string[] {
  const ids = new Set<string>();
  for (const part of splitMentions(text, members)) {
    if (part.type === "mention") ids.add(part.member.id);
  }
  return [...ids];
}

/**
 * Rewrite @mentions in raw Markdown into Markdown links, so the existing ReactMarkdown
 * `a` renderer styles them — no remark plugin needed. ponytail: this also rewrites a
 * mention typed inside a code span; acceptable, mentioning yourself inside backticks is
 * not a real case. Swap to a remark plugin if it ever bites.
 */
export function linkifyMarkdown(
  body: string,
  members: Mentionable[],
): string {
  return splitMentions(body, members)
    .map((part) =>
      part.type === "mention"
        ? `[@${part.member.name}](/u/${part.member.id})`
        : part.value,
    )
    .join("");
}
