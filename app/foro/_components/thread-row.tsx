import Link from "next/link";

import { Icon } from "@/components/icons";
import type { ForumThreadListItemResult } from "@/application";
import { threadStatus, type ThreadStatus } from "@/interface/forum/forum-display";

import { CategoryChip } from "./category-chip";
import { PostTime } from "./post-time";
import { ThreadStatusIcon } from "./thread-status-icon";

// The status in words next to the icon: open and solved are said, never left to a colour.
const STATUS_WORD: Record<ThreadStatus, string> = { open: "abierto", solved: "resuelto", locked: "cerrado por la moderación" };

interface ThreadRowProps {
  thread: ForumThreadListItemResult;
  now: Date;
  /** The category chip, on a list that mixes categories; a category's own page leaves it out. */
  category?: { slug: string; name: string } | null;
}

/** One thread of a list: the whole row is the link, like an issue in a tracker. */
export function ThreadRow({ thread, now, category }: ThreadRowProps) {
  const status = threadStatus(thread);
  // A solved thread can also be locked; that is worth saying too.
  const closed = status === "solved" && thread.locked ? ` · ${STATUS_WORD.locked}` : "";

  return (
    <li>
      <Link
        href={`/foro/hilo/${thread.id}`}
        className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-3.5 transition-colors hover:bg-card focus-visible:-outline-offset-3 sm:px-4"
      >
        <span className="row-span-2 pt-0.5">
          <ThreadStatusIcon status={status} />
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <strong className="font-semibold leading-[1.35] wrap-anywhere text-foreground">{thread.title}</strong>
          {category ? <CategoryChip category={category} /> : null}
        </span>
        <span className="row-span-2 inline-flex items-center gap-1.5 self-center font-mono text-sm text-mist">
          <Icon name="msg" className="size-4" />
          {thread.replyCount}
          <span className="sr-only"> {thread.replyCount === 1 ? "respuesta" : "respuestas"}</span>
        </span>
        <span className="col-start-2 text-[0.8125rem] text-mist">
          {thread.authorName}
          {thread.mine ? " (usted)" : null} · actividad <PostTime date={thread.lastActivityAt} now={now} /> · {STATUS_WORD[status]}
          {closed}
        </span>
      </Link>
    </li>
  );
}
