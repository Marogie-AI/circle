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
