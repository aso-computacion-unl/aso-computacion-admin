/** The kinds of content that can be in the trash. */
export type TrashKind = "event" | "news" | "faq" | "command" | "social" | "pillar" | "board";

/** One row of the trash view: what it was, how to find it again, and when it was deleted. */
export interface TrashItemResult {
  kind: TrashKind;
  id: string;
  /** What the admin knows the item by: the title, question, command, label or name. */
  title: string;
  deletedAt: Date;
}
