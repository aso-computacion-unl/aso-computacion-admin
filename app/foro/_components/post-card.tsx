import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { initialsOf } from "@/interface/forum/forum-display";
import { cn } from "@/lib/utils";

import { MarkdownBody } from "./markdown-body";
import { PostTime } from "./post-time";

interface PostCardProps {
  /** Set on a reply, used as the anchor of links to it. */
  id?: string;
  authorName: string;
  mine: boolean;
  /** "Inició el hilo" on the opening post. */
  tag?: string;
  createdAt: Date;
  editedAt: Date | null;
  body: string;
  now: Date;
  /** The thread's best answer: highlighted and labelled. */
  best?: boolean;
  /** Room for the actions of a later step (react, report, moderate). */
  footer?: ReactNode;
}

/** One post on the lane: a node with the author's initials and the card next to it. */
export function PostCard({ id, authorName, mine, tag, createdAt, editedAt, body, now, best = false, footer }: PostCardProps) {
  return (
    <li>
      <span aria-hidden="true" className="z-1 grid size-7 place-items-center justify-self-center rounded-full bg-card text-[0.6875rem] font-bold text-sky-bright shadow-[0_0_0_4px_var(--color-navy)] sm:size-8 sm:text-xs">
        {initialsOf(authorName)}
      </span>
      <article id={id} className={cn("min-w-0 scroll-mt-20 overflow-hidden rounded-xl border bg-muted", best ? "border-sky" : "border-border")}>
        <header className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border/60 px-3 py-2 text-sm sm:px-4", best ? "bg-sky/15" : "bg-background/40")}>
          <strong className="font-semibold">
            {authorName}
            {mine ? <span className="font-normal text-mist"> (usted)</span> : null}
          </strong>
          {tag ? <span className="rounded border border-border px-1.5 text-xs text-sky-bright">{tag}</span> : null}
          <span className="text-[0.8125rem] text-mist">
            <PostTime date={createdAt} now={now} />
            {editedAt ? (
              <>
                {" · editado "}
                <PostTime date={editedAt} now={now} />
              </>
            ) : null}
          </span>
          {best ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-sky-bright">
              <Icon name="merge" className="size-4" />
              Mejor respuesta
            </span>
          ) : null}
        </header>
        <div className="px-3 py-3.5 sm:px-4">
          <MarkdownBody source={body} />
        </div>
        {footer ? <footer className="flex flex-wrap items-center gap-1 border-t border-border/60 px-2 py-1.5">{footer}</footer> : null}
      </article>
    </li>
  );
}
