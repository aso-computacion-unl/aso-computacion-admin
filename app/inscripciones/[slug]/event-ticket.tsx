import type { ReactNode } from "react";

import type { RegistrationState } from "@/application";
import { deadlineLabel, seatsOf, ticketDate } from "@/interface/event-registration/event-ticket";
import type { EventFacts } from "@/interface/forum/event-registration-read";

/** The registration side of an event; absent for one that takes none. */
export interface TicketRegistration {
  state: RegistrationState;
  capacity: number | null;
  registered: number;
  deadline: Date | null;
}

const KICKERS: Record<RegistrationState, { text: string; off: boolean }> = {
  open: { text: "Inscripciones abiertas", off: false },
  full: { text: "Cupos agotados", off: true },
  closed: { text: "Inscripciones cerradas", off: true },
};

const FREE_KICKER = { text: "Evento", off: false };

interface EventTicketProps {
  event: EventFacts;
  /** What decides the stub and the seats column: the three ways an event takes (or does not take) registrations. */
  mode: "unl" | "open" | "none";
  registration?: TicketRegistration;
  /** The tear-off: the action that depends on the mode. */
  children: ReactNode;
}

/** The seats column: how many are left with a meter, or "Entrada libre"; null when there is nothing to say. */
function seatsColumn(registration: TicketRegistration | undefined, free: boolean): ReactNode {
  if (free) {
    return (
      <div className="ticket-seats">
        <p className="ticket-chip">Entrada libre</p>
        <small>Sin cupos ni inscripción previa</small>
      </div>
    );
  }

  const seats = registration ? seatsOf(registration) : null;
  const closing = registration?.state === "open" && registration.deadline ? `${deadlineLabel(registration.deadline)} (hora de Ecuador)` : null;
  const note = seats ? [seats.summary, closing ? `cierra el ${closing}` : null].filter(Boolean).join(" · ") : closing ? `Cierra el ${closing}` : null;

  if (!seats && !note) return null;

  return (
    <div className="ticket-seats">
      {seats ? (
        <>
          <p className="ticket-left" aria-live="polite">
            {seats.left}
          </p>
          <div className="ticket-meter" aria-hidden="true">
            <i style={{ width: `${seats.filled}%` }} />
          </div>
        </>
      ) : null}
      <small>{note}</small>
    </div>
  );
}

/**
 * The event as a landing-style ticket: the date on a red stub, then the title and the facts people plan around, the
 * seats, a perforation and the navy tear-off where the visitor acts. It is the page's first and only heading.
 */
export function EventTicket({ event, mode, registration, children }: EventTicketProps) {
  const date = ticketDate(event.date, event.datePrecision);
  const kicker = registration ? KICKERS[registration.state] : FREE_KICKER;
  const seats = seatsColumn(registration, mode === "none");

  return (
    <>
      <p className="ticket-kicker" data-tone={kicker.off ? "off" : undefined}>
        <i aria-hidden="true" />
        {kicker.text}
      </p>

      <div className="ticket" data-mode={mode}>
        <section className="ticket-top" aria-labelledby="event-title" data-seats={seats ? undefined : "none"}>
          <div className="ticket-date" aria-hidden="true">
            {date.weekday ? <span className="ticket-dow">{date.weekday}</span> : null}
            <span className="ticket-day">{date.main}</span>
            <span className="ticket-mon">{date.sub}</span>
            {event.hora ? <span className="ticket-time">{event.hora}</span> : null}
          </div>

          <div className="ticket-event">
            <p className="ticket-num">
              <time dateTime={date.iso ?? undefined}>{date.label}</time>
            </p>
            <h1 id="event-title" className="ticket-title">
              {event.title}
            </h1>
            {event.description ? (
              <p data-slot="event-description" className="ticket-desc">
                {event.description}
              </p>
            ) : null}
            {event.hora || event.lugar ? (
              <ul className="ticket-facts">
                {event.hora ? (
                  <li className="ticket-fact-time">
                    <b>{event.hora}</b>
                  </li>
                ) : null}
                {event.lugar ? <li>{event.lugar}</li> : null}
              </ul>
            ) : null}
          </div>

          {seats}
        </section>

        <div className="ticket-perf" aria-hidden="true" />

        <section className="ticket-stub" aria-label="Inscripción">
          {children}
        </section>
      </div>
    </>
  );
}
