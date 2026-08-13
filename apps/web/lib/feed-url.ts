/**
 * One place that writes the feed's URL parameters.
 *
 * Every feed control — the filters, the layout toggle, and whatever comes next — moves
 * state by rewriting the query string, because that keeps the page a server component
 * and makes the state survive a refresh, a shared link and the back button.
 *
 * The one rule that is easy to get wrong is `before`: the keyset cursor is only valid
 * for the ordering that produced it, so a control that changes WHAT is listed must drop
 * it, while a control that only changes how it LOOKS must keep it. Hence the explicit
 * flag rather than a default either way.
 */
export function feedUrl(
  slug: string,
  current: URLSearchParams,
  key: string,
  value: string,
  { resetCursor }: { resetCursor: boolean },
) {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value);
  else next.delete(key);
  if (resetCursor) next.delete("before");

  const query = next.toString();
  return query ? `/groups/${slug}?${query}` : `/groups/${slug}`;
}
