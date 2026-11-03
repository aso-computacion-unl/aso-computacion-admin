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

/**
 * One thread of a list: the whole row is the link, like an issue in a tracker. On phones the author, the activity and
 * the state share one line under the title; from lg up each has its own column, under the header of the list.
 */
export function ThreadRow({ thread, now, category }: ThreadRowProps) {
  const status = threadStatus(thread);
  // A solved thread can also be locked; that is worth saying too.
  const closed = status === "solved" && thread.locked ? ` · ${STATUS_WORD.locked}` : "";

  return (
    <li>
      <Link
        href={`/foro/hilo/${thread.id}`}
        className="thread-cols group gap-y-0.5 py-3.5 transition-colors hover:bg-card focus-visible:-outline-offset-3 xl:py-4 2xl:py-5"
      >
        {/* On the history graph's line: the glyph covers it, in the colour of the row under it. */}
        <span className="relative z-10 row-span-2 h-6 self-start rounded-full bg-background pt-0.5 transition-colors group-hover:bg-card">
          <ThreadStatusIcon status={status} />
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <strong className="font-semibold leading-[1.35] wrap-anywhere text-foreground xl:text-[1.0625rem]">{thread.title}</strong>
          {category ? <CategoryChip category={category} /> : null}
        </span>
        <span className="row-span-2 inline-flex items-center gap-1.5 self-center font-mono text-sm text-mist xl:col-start-5 xl:row-start-1 xl:justify-self-end">
          <Icon name="msg" className="size-4" />
          {thread.replyCount}
          <span className="sr-only"> {thread.replyCount === 1 ? "respuesta" : "respuestas"}</span>
        </span>
        <span className="col-start-2 text-[0.8125rem] text-mist xl:contents">
          <span className="xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-center xl:truncate xl:text-sm">
            {thread.authorName}
            {thread.mine ? " (usted)" : null}
          </span>
          <span className="xl:hidden"> · </span>
          <span className="xl:col-start-4 xl:row-span-2 xl:row-start-1 xl:self-center xl:text-sm">
            <span className="xl:hidden">actividad </span>
            <PostTime date={thread.lastActivityAt} now={now} />
          </span>
          <span className="xl:hidden"> · </span>
          <span className="xl:col-start-2 xl:row-start-2">
            {STATUS_WORD[status]}
            {closed}
          </span>
        </span>
      </Link>
    </li>
  );
}
