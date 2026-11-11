import type { Metadata } from "next";

import { getOpenRegistrationEvents } from "@/interface/forum/event-registration-read";

import { RegistrationCard } from "./_components/registration-card";

// The layout's title template covers the pages below this segment, not the page of the segment itself.
export const metadata: Metadata = { title: { absolute: "Inscripciones — ASO Computación" } };

// Reads the live seat counts: never prerendered.
export const dynamic = "force-dynamic";

/**
 * The public list of the events that take registrations right now, UNL or open form (D8). It asks for no sign-in:
 * a student proves their UNL account only when they reserve, on the event's page.
 */
export default async function RegistrationsListPage() {
  const events = await getOpenRegistrationEvents();
  const kicker = events.length === 0 ? "Sin inscripciones abiertas" : `${events.length} ${events.length === 1 ? "evento con inscripción abierta" : "eventos con inscripción abierta"}`;

  return (
    <>
      <p className="ticket-kicker" data-tone={events.length === 0 ? "off" : undefined}>
        <i aria-hidden="true" />
        {kicker}
      </p>
      <h1 className="reg-title">Inscripciones</h1>
      <p className="reg-lead">Elija un evento para ver los detalles e inscribirse. Algunos piden su cuenta @unl.edu.ec; otros están abiertos al público.</p>

      {events.length === 0 ? (
        <div className="reg-empty">
          <h2 className="reg-empty-title">No hay inscripciones abiertas.</h2>
          <p>Cuando la directiva abra una, la verá aquí.</p>
        </div>
      ) : (
        <ul className="reg-list">
          {events.map((event) => (
            <RegistrationCard key={event.slug} event={event} />
          ))}
        </ul>
      )}
    </>
  );
}
