/**
 * Structured logging with no vendor.
 *
 * Vercel parses single-line JSON on stdout/stderr into structured, filterable log
 * entries, so this is the whole observability story until there is a reason for more.
 * The important field is `digest`: Next replaces a server error's message with an opaque
 * digest in production, and that digest is the only thread from what the user saw back
 * to the line that caused it. Always pass it through when you have one.
 *
 * Log retention on Vercel's Hobby plan is about an hour. Fine at zero users; revisit
 * with a log drain when there is something worth keeping.
 */

type Meta = Record<string, unknown>;

function emit(level: "error" | "warn" | "info", event: string, meta: Meta) {
  const line = JSON.stringify({ level, event, ...meta });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logError(event: string, error: unknown, meta: Meta = {}) {
  emit("error", event, {
    ...meta,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function logWarn(event: string, meta: Meta = {}) {
  emit("warn", event, meta);
}
