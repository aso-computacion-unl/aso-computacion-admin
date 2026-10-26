import { TRASH_KINDS, type TrashKind } from "@/application/dto/trash-result.dto";

/** The admin list each kind comes from, refreshed when an item leaves or returns to it. */
export const LIST_PATH_BY_KIND: Record<TrashKind, string> = {
  event: "/admin/events",
  news: "/admin/news",
  faq: "/admin/faqs",
  command: "/admin/commands",
  social: "/admin/socials",
  pillar: "/admin/pillars",
  board: "/admin/board",
};

/** A server action receives whatever the client sends: anything but a known kind is refused. */
export function parseTrashKind(value: unknown): TrashKind | null {
  return TRASH_KINDS.find((kind) => kind === value) ?? null;
}
