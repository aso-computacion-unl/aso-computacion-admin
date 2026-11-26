import Link from "next/link";

import type { RegistrationCandidate } from "@/application";
import { Button } from "@/components/ui/button";
import { openEventRegistration } from "@/interface/admin/event-registrations/actions";
import { getAdminRegistrationCandidates } from "@/interface/admin/event-registrations/registration-candidates-admin-read";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";
import { formatEventDate } from "@/interface/admin/events/event-timeline";

import { EmptyState } from "../../_components/empty-state";
import { FormLayout, Panel } from "../../_components/form-layout";
import { Stamp } from "../../_components/timeline-parts";
import { RegistrationEventSummary } from "../_components/registration-event-summary";
import { RegistrationForm } from "../_components/registration-form";

// The events that can take a registration change with every save of an event and with the day.
export const dynamic = "force-dynamic";

const NEW_PATH = "/admin/registrations/new";
const NO_REGISTRATION = { registrationMode: "none", registrationCapacity: "", registrationDeadline: "" } as const;

function CandidateList({ candidates }: { candidates: RegistrationCandidate[] }) {
  return (
    <nav aria-label="Eventos próximos sin inscripción">
      <ul className="grid gap-2">
        {candidates.map((event) => (
          <li key={event.id}>
            <Link
              href={`${NEW_PATH}?evento=${encodeURIComponent(event.id)}`}
              className="grid min-h-11 gap-1.5 rounded bg-card p-3 transition-colors duration-150 ease-out hover:bg-foreground/6"
            >
              <span className="font-semibold wrap-anywhere">{event.title}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-mist">
                <span>{formatEventDate(event.date, event.datePrecision)}</span>
                {event.lugar ? <span className="wrap-anywhere">{event.lugar}</span> : null}
                {event.isPublished ? null : <Stamp>Borrador</Stamp>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * «Crear inscripción» (S1, S2): first pick an upcoming event without registration, then set how people register.
 * The event's title, date and place are read from the event; an id that is not a candidate shows the picker again
 * (the server action refuses it too).
 */
export default async function NewRegistrationPage({ searchParams }: { searchParams: Promise<{ evento?: string | string[] }> }) {
  const { evento } = await searchParams;
  const candidates = await getAdminRegistrationCandidates();
  const chosen = typeof evento === "string" ? candidates.find((event) => event.id === evento) : undefined;

  if (chosen) {
    // People registered under a registration that was turned off are still there: reopening asks first (D14).
    const registeredCount = (await getAdminEvent(chosen.id))?.registeredCount ?? 0;

    return (
      <FormLayout backHref={NEW_PATH} backLabel="Elegir otro evento" title="Crear inscripción" status="sin guardar">
        <RegistrationEventSummary event={chosen} />
        <Panel aria-label="Inscripción">
          <RegistrationForm
            action={openEventRegistration.bind(null, chosen.id)}
            initialValues={{ ...NO_REGISTRATION, registrationMode: "unl" }}
            storedValues={NO_REGISTRATION}
            registeredCount={registeredCount}
            submitLabel="Crear inscripción"
          />
        </Panel>
      </FormLayout>
    );
  }

  return (
    <FormLayout
      backHref="/admin/registrations"
      backLabel="Volver a inscripciones"
      title="Crear inscripción"
      status="sin guardar"
      description="Elija el evento: uno próximo, publicado o borrador, que aún no pida inscripción."
    >
      {candidates.length === 0 ? (
        <EmptyState
          icon="events"
          action={
            <Button asChild variant="line">
              <Link href="/admin/events/new">Crear un evento</Link>
            </Button>
          }
        >
          No hay eventos próximos sin inscripción.
        </EmptyState>
      ) : (
        <CandidateList candidates={candidates} />
      )}
    </FormLayout>
  );
}
