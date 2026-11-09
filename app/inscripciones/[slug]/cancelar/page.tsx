import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { openRegistrationCancelToken } from "@/infrastructure/registration/registration-cancel-token";
import { cancelOutcomeMessage } from "@/interface/event-registration/cancel-registration";
import { getCancelRegistrationPage } from "@/interface/event-registration/cancel-registration-read";

import { NotFoundState } from "../../../_components/not-found-state";
import { EventTicket } from "../event-ticket";
import { CancelRegistration } from "./cancel-registration";
import { CancelResult } from "./cancel-result";

// Reads the live seat count and the token: never prerendered.
export const dynamic = "force-dynamic";

// The address carries the token: keep it out of search results and out of the Referer of anything the page links to.
export const metadata: Metadata = { title: "Cancelar inscripción", robots: { index: false }, referrer: "no-referrer" };

/**
 * Where the cancellation link of the confirmation and reminder emails lands (D7). Opening it only shows the event and a
 * button: the registration is deleted when the person presses it (a POST), never by the GET, because mail scanners and
 * link previews open every link. A closed registration says so instead of offering a button that can only be refused;
 * an event that is not public says it is not available for a link that is ours, and stays a 404 for a bad token.
 */
export default async function CancelRegistrationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const { slug } = await params;
  const { token } = await searchParams;
  const page = await getCancelRegistrationPage(slug);
  const value = typeof token === "string" ? token : undefined;
  const checked = await openRegistrationCancelToken(value);
  const eventHref = `/inscripciones/${slug}`;

  if (!page) {
    // Nothing says an unknown event ever existed to someone without a link of ours.
    if (checked.status === "invalid") notFound();

    const gone = cancelOutcomeMessage({ kind: "not_found" });

    return (
      <NotFoundState title={gone.title} href="/inscripciones" actionLabel="Ver las inscripciones abiertas" face="forum">
        {gone.detail}
      </NotFoundState>
    );
  }

  const message =
    checked.status === "valid"
      ? page.registration?.state === "closed"
        ? cancelOutcomeMessage({ kind: "closed" })
        : null
      : cancelOutcomeMessage({ kind: checked.status });

  return (
    <EventTicket event={page.event} mode={page.mode} registration={page.registration ?? undefined}>
      {message ? <CancelResult message={message} eventHref={eventHref} /> : <CancelRegistration slug={slug} token={value!} eventHref={eventHref} />}
    </EventTicket>
  );
}
