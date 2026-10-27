import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { Icon } from "@/components/icons";
import { threadStatus } from "@/interface/forum/forum-display";
import { categoryHref } from "@/interface/forum/forum-links";
import { orNotFound } from "@/interface/forum/forum-page-errors";
import { getForumReactions } from "@/interface/forum/forum-reactions-read";
import { getForumThread } from "@/interface/forum/forum-read";

import { BestAnswerButton } from "../../_components/best-answer-button";
import { PostCard } from "../../_components/post-card";
import { PostTime } from "../../_components/post-time";
import { ReactionButton } from "../../_components/reaction-button";
import { ReplyForm } from "../../_components/reply-form";
import { ReportButton } from "../../_components/report-button";

// A visitor is sent to the sign-in with this path, so signing in brings them back to the thread.
const threadPath = (id: string) => `/foro/hilo/${encodeURIComponent(id)}`;

// The title and the page share one read per request.
const loadThread = cache((id: string) => orNotFound(getForumThread(id, threadPath(id))));

interface ThreadPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ThreadPageProps): Promise<Metadata> {
  const { thread } = await loadThread((await params).id);

  return { title: thread.title };
}

// Reads the session cookie: never prerendered.
export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { id } = await params;
  const [{ category, thread, replies }, reactions] = await Promise.all([loadThread(id), orNotFound(getForumReactions(id, threadPath(id)))]);
  const now = new Date();
  const status = threadStatus({ hasBestAnswer: thread.bestReplyId !== null, locked: thread.locked });

  return (
    <>
      <Link href={categoryHref(category.slug)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mist hover:text-foreground">
        <Icon name="left" className="size-4" />
        {category.name}
      </Link>

      <header className="mt-1 mb-8">
        <h1 className="mb-3 text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight wrap-anywhere">{thread.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm text-mist">
          {status === "open" ? (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-ok/60 bg-ok/10 px-3 font-bold text-ok">
              <Icon name="dot" className="size-4" />
              Abierto
            </span>
          ) : null}
          {status === "solved" ? (
            <a href="#mejor" className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-sky px-3 font-bold text-primary-foreground no-underline hover:bg-sky-bright">
              <Icon name="merge" className="size-4" />
              Resuelto
            </a>
          ) : null}
          {thread.locked ? (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-card px-3 font-bold text-foreground">
              <Icon name="lock" className="size-4" />
              Cerrado
            </span>
          ) : null}
          <span>
            <strong className="font-semibold text-foreground">{thread.authorName}</strong>
            {thread.mine ? " (usted)" : null} abrió este hilo <PostTime date={thread.createdAt} now={now} /> · {replies.length} {replies.length === 1 ? "respuesta" : "respuestas"}
          </span>
        </div>
      </header>

      <ol className="lane">
        <PostCard authorName={thread.authorName} mine={thread.mine} tag="Inició el hilo"
          createdAt={thread.createdAt}
          editedAt={thread.editedAt}
          body={thread.body}
          now={now}
          footer={thread.mine ? null : <ReportButton target={{ kind: "thread", id: thread.id }} />}
        />
        {replies.map((reply) => (
          <PostCard
            key={reply.id}
            id={reply.isBest ? "mejor" : `respuesta-${reply.id}`}
            authorName={reply.authorName}
            mine={reply.mine}
            createdAt={reply.createdAt}
            editedAt={reply.editedAt}
            body={reply.body}
            now={now}
            best={reply.isBest}
            footer={
              <>
                {/* Keyed by what the server last said, so a refresh resets the control to it. */}
                <ReactionButton key={`${reactions.replies[reply.id]?.count ?? 0}:${reactions.replies[reply.id]?.mine ?? false}`} replyId={reply.id} count={reactions.replies[reply.id]?.count ?? 0} mine={reactions.replies[reply.id]?.mine ?? false} />
                {thread.mine && !thread.locked ? <BestAnswerButton threadId={thread.id} replyId={reply.id} isBest={reply.isBest} /> : null}
                {reply.mine ? null : <ReportButton target={{ kind: "reply", id: reply.id }} />}
              </>
            }
          />
        ))}
        <li>
          <span
            aria-hidden="true"
            className="z-1 grid size-7 place-items-center justify-self-center rounded-full border-2 border-sky bg-card text-foreground shadow-[0_0_0_4px_var(--color-navy)] sm:size-8"
          >
            <Icon name={thread.locked ? "lock" : "reply"} className="size-3.5" />
          </span>
          {thread.locked ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3.5 text-mist">
              <strong className="block text-foreground">Hilo cerrado por la moderación</strong>
              Se puede leer, pero ya no admite respuestas nuevas.
            </div>
          ) : (
            <ReplyForm threadId={thread.id} />
          )}
        </li>
      </ol>
    </>
  );
}
