import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RegistrationConfirmSecretError, openRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";
import { confirmOutcomeMessage } from "@/interface/event-registration/confirm-registration";
import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";

import { NotFoundState } from "../../../_components/not-found-state";
import { EventTicket } from "../event-ticket";
import { ConfirmRegistration } from "./confirm-registration";
import { ConfirmResult } from "./confirm-result";

// Reads the live seat count and the token: never prerendered.
export const dynamic = "force-dynamic";

// The address carries the token: keep it out of search results and out of the Referer of anything the page links to.
export const metadata: Metadata = { title: "Confirmar inscripción", robots: { index: false }, referrer: "no-referrer" };

/**
 * Where the link of the confirmation email lands. Opening it only shows the event and a button: the seat is taken
 * when the person presses it (a POST), never by the GET, because mail scanners and link previews open every link.
 * An event that no longer takes open-form registrations (mode changed, unpublished, trashed) says so (D11) for a link
 * that is ours; a bad token still says "Este enlace no sirve", and an unknown event with a bad token stays a 404.
 */
export default async function ConfirmRegistrationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const { slug } = await params;
  const { token } = await searchParams;
  const page = await getEventRegistrationPage(slug);
  const value = typeof token === "string" ? token : undefined;
  // Without a usable secret no link can be checked: say the service is down, not that the link is bad (S3).
  const checked = await openRegistrationConfirmToken(value).catch((error: unknown) => {
    if (error instanceof RegistrationConfirmSecretError) return { status: "unavailable" as const };
    throw error;
  });
  const formHref = `/inscripciones/${slug}`;

  // Only an event with the open form has anything to confirm.
  if (!page || page.kind !== "open") {
    if (checked.status === "invalid") {
      // Nothing says an unknown event ever existed; one that is public just has nothing to confirm with this link.
      if (!page) notFound();

      return <ConfirmResult message={{ ...confirmOutcomeMessage({ kind: "invalid" }), backToForm: false }} calendarHref={null} formHref={formHref} />;
    }

    const gone = confirmOutcomeMessage({ kind: "not_found" });

    return (
      <NotFoundState title={gone.title} href="/inscripciones" actionLabel="Ver las inscripciones abiertas" face="forum">
        {gone.detail}
      </NotFoundState>
    );
  }

  return (
    <EventTicket event={page.status.event} mode="open" registration={page.status}>
      {checked.status === "valid" && value ? (
        <ConfirmRegistration slug={slug} token={value} calendarHref={page.calendarHref} formHref={formHref} />
      ) : (
        <ConfirmResult message={confirmOutcomeMessage({ kind: checked.status === "valid" ? "invalid" : checked.status })} calendarHref={null} formHref={formHref} />
      )}
    </EventTicket>
  );
}
