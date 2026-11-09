import Link from "next/link";

import type { OpenRegistrationEvent } from "@/interface/forum/event-registration-read";
import { ticketDate } from "@/interface/event-registration/event-ticket";

import { ArrowGlyph } from "./ticket-parts";

const MODE_LABELS = { unl: "Con cuenta UNL", open: "Abierta al público" } as const satisfies Record<OpenRegistrationEvent["mode"], string>;

function seatsText(seatsLeft: number | null): string {
  if (seatsLeft === null) return "Sin límite de cupos";

  return seatsLeft === 1 ? "Queda 1 cupo" : `Quedan ${seatsLeft} cupos`;
}

/**
 * One event that takes registrations, as a small ticket of the same family as the event's page: the date on a red
 * stub, the title and facts on paper, the seats on the navy tear-off. The whole card is the link to the event's page
 * (the title's link stretches over it), so a heading stays a heading.
 */
export function RegistrationCard({ event }: { event: OpenRegistrationEvent }) {
  const date = ticketDate(event.date, event.datePrecision);
  const facts = [event.hora, event.lugar].filter(Boolean).join(" · ");

  return (
    <li className="reg-card" data-mode={event.mode}>
      <div className="reg-card-date" aria-hidden="true">
        {date.weekday ? <span className="reg-card-dow">{date.weekday}</span> : null}
        <span className="reg-card-day">{date.main}</span>
        <span className="reg-card-mon">{date.sub}</span>
      </div>

      <div className="reg-card-body">
        <p className="reg-card-mode">{MODE_LABELS[event.mode]}</p>
        <h2 className="reg-card-title">
          <Link href={`/inscripciones/${event.slug}`} className="reg-card-link">
            {event.title}
          </Link>
        </h2>
        <p className="reg-card-when">
          <time dateTime={date.iso ?? undefined}>{date.label}</time>
          {facts ? ` · ${facts}` : null}
        </p>
        {event.description ? <p className="reg-card-desc">{event.description}</p> : null}
      </div>

      <div className="reg-card-stub">
        <p className="reg-card-seats">{seatsText(event.seatsLeft)}</p>
        <span className="reg-card-go" aria-hidden="true">
          Ver el evento
          <ArrowGlyph />
        </span>
      </div>
    </li>
  );
}
