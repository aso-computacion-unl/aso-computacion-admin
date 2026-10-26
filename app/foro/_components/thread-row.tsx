import Link from "next/link";

import { Icon } from "@/components/icons";
import type { ForumThreadListItemResult } from "@/application";
import { threadStatus } from "@/interface/forum/forum-display";

import { PostTime } from "./post-time";
import { ThreadStatusIcon } from "./thread-status-icon";

/** One thread of a category list: the whole row is the link, like an issue in a tracker. */
export function ThreadRow({ thread, now }: { thread: ForumThreadListItemResult; now: Date }) {
  const status = threadStatus(thread);

  return (
    <li>
      <Link
        href={`/foro/hilo/${thread.id}`}
        className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-3.5 transition-colors hover:bg-card focus-visible:-outline-offset-3 sm:px-4"
      >
        <span className="row-span-2 pt-0.5">
          <ThreadStatusIcon status={status} />
        </span>
        <strong className="font-semibold leading-[1.35] wrap-anywhere text-foreground">{thread.title}</strong>
        <span className="row-span-2 inline-flex items-center gap-1.5 self-center font-mono text-sm text-mist">
          <Icon name="msg" className="size-4" />
          {thread.replyCount}
          <span className="sr-only"> {thread.replyCount === 1 ? "respuesta" : "respuestas"}</span>
        </span>
        <span className="col-start-2 text-[0.8125rem] text-mist">
          {thread.authorName}
          {thread.mine ? " (usted)" : null} · actividad <PostTime date={thread.lastActivityAt} now={now} />
          {status === "solved" ? " · resuelto" : null}
          {thread.locked ? " · cerrado por la moderación" : null}
        </span>
      </Link>
    </li>
  );
}
