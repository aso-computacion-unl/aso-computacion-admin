import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { openRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";
import { confirmOutcomeMessage } from "@/interface/event-registration/confirm-registration";
import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";

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
 */
export default async function ConfirmRegistrationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const { slug } = await params;
  const { token } = await searchParams;
  const page = await getEventRegistrationPage(slug);

  // Only an event with the open form has anything to confirm.
  if (!page || page.kind !== "open") notFound();

  const formHref = `/inscripciones/${slug}`;
  const value = typeof token === "string" ? token : undefined;
  const checked = await openRegistrationConfirmToken(value);

  return (
    <EventTicket event={page.status.event} mode="open" registration={page.status}>
      {checked.status === "valid" && value ? (
        <ConfirmRegistration slug={slug} token={value} calendarHref={page.calendarHref} formHref={formHref} />
      ) : (
        <ConfirmResult message={confirmOutcomeMessage({ kind: checked.status === "expired" ? "expired" : "invalid" })} calendarHref={null} formHref={formHref} />
      )}
    </EventTicket>
  );
}
