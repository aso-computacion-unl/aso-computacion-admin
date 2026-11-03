import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";

import { GoogleButton } from "../../../_components/google-button";
import { EventSummary } from "./event-summary";
import { OpenRegistrationForm } from "./open-registration-form";
import { RegisterButton } from "./register-button";

// Reads the session cookie and the live seat count: never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Evento e inscripción", robots: { index: false } };

/** The form is not offered when its spam check cannot run on this page (operator misconfiguration, already logged). */
const UNAVAILABLE_MESSAGE = "La inscripción no está disponible en este momento. Inténtalo de nuevo en unos minutos.";

const CLOSED_MESSAGES = {
  full: "Ya no quedan cupos para este evento.",
  closed: "Las inscripciones de este evento ya cerraron.",
} as const;

/** The page's two nodes on one branch: the event, then what the visitor can do about it (the sign-in's idiom). */
function Branch({ event, action, hash }: { event: ReactNode; action: ReactNode; hash: string }) {
  return (
    <ol className="reg-branch mt-3">
      <li>
        <span aria-hidden="true" className="mb-2 block font-mono text-sm text-sky">
          evento
        </span>
        {event}
      </li>
      <li>
        <span aria-hidden="true" className="mb-2 block font-mono text-sm text-sky">
          {hash}
        </span>
        {action}
      </li>
    </ol>
  );
}

function CalendarLink({ href }: { href: string }) {
  return (
    <Button asChild variant="line" className="justify-self-start">
      <a href={href}>
        <Icon name="events" />
        Añadir al calendario
      </a>
    </Button>
  );
}

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getEventRegistrationPage(slug);

  if (!page) notFound();

  const back = (
    <Link href="/foro" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mist hover:text-foreground">
      <Icon name="left" className="size-4" />
      Foro
    </Link>
  );

  if (page.kind === "none") {
    return (
      <>
        {back}
        <Branch
          hash="pase-libre"
          event={<EventSummary event={page.event} eyebrow="Evento" />}
          action={
            <aside aria-label="Inscripción" className="grid gap-4 rounded-lg border border-border bg-muted p-5">
              <p>Este evento es de pase libre: no necesitas inscribirte, solo llegar.</p>
              {page.calendarHref ? <CalendarLink href={page.calendarHref} /> : null}
            </aside>
          }
        />
      </>
    );
  }

  const { status } = page;
  const summary = <EventSummary event={status.event} eyebrow="Inscripción al evento" registration={status} />;

  if (page.kind === "open") {
    return (
      <>
        {back}
        <Branch
          hash="inscripcion"
          event={summary}
          action={
            <aside aria-label="Inscripción" className="grid gap-4 rounded-lg border border-border bg-muted p-5">
              <h2 className="text-lg font-bold font-stretch-[106%]">Inscríbete</h2>
              {page.captchaMisconfigured ? (
                <p role="status">{UNAVAILABLE_MESSAGE}</p>
              ) : (
                /* Always the form: when it is full or closed it says so, unless this visitor just took the last seat. */
                <OpenRegistrationForm
                  slug={slug}
                  title={status.event.title}
                  siteKey={page.siteKey}
                  calendarHref={page.calendarHref}
                  closedMessage={status.state === "open" ? undefined : CLOSED_MESSAGES[status.state]}
                />
              )}
            </aside>
          }
        />
      </>
    );
  }

  const { member } = page;
  const signIn = `/foro/auth/google/start?next=${encodeURIComponent(`/foro/eventos/${slug}`)}`;

  return (
    <>
      {back}
      <Branch
        hash="inscripcion"
        event={summary}
        action={
          <aside aria-label="Inscripción" className="grid gap-4 rounded-lg border border-border bg-muted p-5">
            {status.alreadyRegistered ? (
              <p role="status" className="flex gap-2.5">
                <Icon name="check" className="mt-0.5 size-4.5 shrink-0 text-ok" />
                Usted ya está inscrito en este evento. No necesita hacer nada más.
              </p>
            ) : status.state !== "open" ? (
              <p role="status">{CLOSED_MESSAGES[status.state]}</p>
            ) : member ? (
              <>
                <p>
                  Se inscribirá como <strong>{member.displayName}</strong> con su cuenta institucional. Solo se guardan su nombre y su correo.
                </p>
                <RegisterButton slug={slug} />
              </>
            ) : (
              <>
                <p>
                  La inscripción es con su cuenta institucional de Google <strong className="font-semibold">@unl.edu.ec</strong>. Al entrar volverá a esta página para confirmarla.
                </p>
                <GoogleButton href={signIn}>Entrar con Google</GoogleButton>
                <p className="text-sm text-mist">La primera vez se crea su cuenta del foro: no hay que registrarse aparte.</p>
              </>
            )}
          </aside>
        }
      />
    </>
  );
}
