import {
  ArticleIcon,
  NoteIcon,
  ToolIcon,
  VideoIcon,
} from "@/components/icons";
import type { PostKind } from "@/lib/kind";

/**
 * One glyph per category, shared by the sidebar quick-add menu (client) and the feed
 * card (server) so a kind never gets two different icons depending on where you see it.
 */
export const KIND_ICONS: Record<PostKind, typeof VideoIcon> = {
  video: VideoIcon,
  article: ArticleIcon,
  tool: ToolIcon,
  note: NoteIcon,
};

/**
 * Chip colour per kind. Semi-transparent fill + a mid-tone text colour so it reads on any
 * surface and in either theme (the rest of the UI is intentionally near-monochrome; the
 * kind chip is the one deliberate spot of colour).
 */
export const KIND_CHIP: Record<PostKind, string> = {
  video: "bg-red-500/10 text-red-600",
  article: "bg-blue-500/10 text-blue-600",
  tool: "bg-emerald-500/10 text-emerald-600",
  note: "bg-amber-500/10 text-amber-600",
};

export function KindIcon({
  kind,
  size = 16,
  className,
}: {
  kind: PostKind;
  size?: number;
  className?: string;
}) {
  const Icon = KIND_ICONS[kind];
  return <Icon size={size} className={className} />;
}
