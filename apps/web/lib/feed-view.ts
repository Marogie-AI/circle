/**
 * How the feed is laid out. Lives in the URL like every other feed control, so the choice
 * survives a refresh, a shared link and the back button without any client state.
 */
export const FEED_VIEWS = ["cards", "table"] as const;

export type FeedView = (typeof FEED_VIEWS)[number];

export const DEFAULT_FEED_VIEW: FeedView = "cards";

export const FEED_VIEW_LABELS: Record<FeedView, string> = {
  cards: "Cards",
  table: "Table",
};

/** Anything that is not a known view becomes the default — never trust the URL. */
export function parseFeedView(value: string | null | undefined): FeedView {
  return FEED_VIEWS.includes(value as FeedView)
    ? (value as FeedView)
    : DEFAULT_FEED_VIEW;
}
