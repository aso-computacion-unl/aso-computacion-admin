import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getOpenRegistrationEvents } from "@/interface/forum/event-registration-read";
import { parseForumLoginError } from "@/interface/forum/forum-login-errors";
import { orNotFound } from "@/interface/forum/forum-page-errors";
import { getForumCategories, getForumFeed } from "@/interface/forum/forum-read";
import { getForumMember } from "@/interface/forum/require-forum-member";

import { ForumRail } from "../_components/forum-rail";
import { ForumShell } from "../_components/forum-shell";
import { RegistrationRow } from "../_components/registration-row";
import { SignInGate } from "../_components/sign-in-gate";
import { ThreadListEmpty } from "../_components/thread-list-empty";

export const metadata: Metadata = { title: "Inscripciones" };

// Reads the session cookie and the live seat counts: never prerendered.
export const dynamic = "force-dynamic";

const PATH = "/foro/eventos";

type Param = string | string[] | undefined;

export default async function ForumRegistrationsPage({ searchParams }: { searchParams: Promise<{ error?: Param }> }) {
  const [member, { error }] = await Promise.all([getForumMember(), searchParams]);

  // Same gate as the forum home: a visitor signs in and comes back here.
  if (!member) return <SignInGate problem={parseForumLoginError(error)} next={PATH} />;

  // The rail is the forum's: it carries the thread counts too, so the page reads what the home reads for it.
  const [events, feed, categories] = await Promise.all([
    getOpenRegistrationEvents(),
    orNotFound(getForumFeed({ state: "open", page: 1 }, PATH)),
    orNotFound(getForumCategories(PATH)),
  ]);

  return (
    <ForumShell rail={<ForumRail section="registrations" filter={null} counts={feed.counts} categories={categories} category={null} registrationsCount={events.length} />}>
      <div className="mx-auto max-w-[100rem]">
        <Link href="/foro" className="-mt-2 mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-mist hover:text-foreground lg:hidden">
          <Icon name="left" className="size-4" />
          Hilos
        </Link>
        <div className="mb-5 grid max-w-[65ch] gap-2 lg:mb-6">
          <h1 className="text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.15] font-bold font-stretch-[106%] tracking-tight">Inscripciones</h1>
          <p className="text-mist">Los eventos que reciben inscripciones ahora, con su cuenta institucional @unl.edu.ec. Elija uno para ver los detalles e inscribirse.</p>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted">
            <ThreadListEmpty
              title="No hay inscripciones abiertas."
              action={
                <Button asChild variant="line" size="sm">
                  <Link href="/foro">Volver a los hilos</Link>
                </Button>
              }
            >
              Cuando la directiva abra una, la verá aquí.
            </ThreadListEmpty>
          </div>
        ) : (
          <div className="thread-graph">
            <div aria-hidden="true" className="thread-cols hidden border-b border-border pb-2.5 text-xs font-semibold text-mist xl:grid">
              <span className="col-start-2">Evento</span>
              <span>Fecha</span>
              <span>Cupos</span>
              <span className="justify-self-end" />
            </div>
            <ul>
              {events.map((event) => (
                <RegistrationRow key={event.slug} event={event} />
              ))}
            </ul>
            <div className="thread-graph-end flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border/50 py-5 pr-(--row-px) pl-[calc(var(--row-px)+2.25rem)] xl:pl-[calc(var(--row-px)+3rem)]">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">¿Una duda sobre un evento?</p>
                <p className="text-sm text-mist">Pregunte en el foro y otros estudiantes le responderán.</p>
              </div>
              <Button asChild variant="line" size="sm">
                <Link href="/foro">Ver los hilos</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </ForumShell>
  );
}
