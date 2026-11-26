import Link from "next/link";

import type { EventResult } from "@/application";
import { formatEventDate } from "@/interface/admin/events/event-timeline";

import { Panel } from "../../_components/form-layout";
import { Stamp } from "../../_components/timeline-parts";

/**
 * The event a registration belongs to, read-only: its title, date and place come from the event (S1), so they are
 * changed by editing the event, never typed again here.
 */
export function RegistrationEventSummary({ event }: { event: Pick<EventResult, "id" | "title" | "date" | "datePrecision" | "lugar" | "isPublished"> }) {
  return (
    <Panel aria-label="Evento" className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <p className="min-w-0 text-lg font-semibold wrap-anywhere">{event.title}</p>
        {event.isPublished ? null : <Stamp>Borrador</Stamp>}
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-mist">Fecha</dt>
        <dd>{formatEventDate(event.date, event.datePrecision)}</dd>
        <dt className="text-mist">Lugar</dt>
        <dd className="wrap-anywhere">{event.lugar ?? "Sin lugar"}</dd>
      </dl>
      <p className="text-sm text-mist">
        Estos datos vienen del evento.{" "}
        <Link href={`/admin/events/${event.id}/edit`} className="font-semibold text-foreground underline underline-offset-4">
          Editar el evento
        </Link>
        {event.isPublished ? null : <> La inscripción de un borrador aparece en el sitio cuando el evento se publica.</>}
      </p>
    </Panel>
  );
}
