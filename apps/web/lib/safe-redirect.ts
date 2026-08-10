const LOCAL_ORIGIN = "https://circle.invalid";

function hasUnsafeSeparator(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 0x1f || code === 0x7f;
  });
}

/**
 * Accept only an absolute-path reference that remains on the same origin after WHATWG
 * normalization. Backslashes matter: `/\\evil.example` starts with one slash, but URL
 * parsing treats the backslash as another separator and turns it into an external URL.
 */
export function safeRedirectTarget(value: string | null, fallback = "/") {
  if (!value?.startsWith("/") || hasUnsafeSeparator(value)) return fallback;

  try {
    const parsed = new URL(value, LOCAL_ORIGIN);
    if (parsed.origin !== LOCAL_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
