import Link from "next/link";

import type { OpenRegistrationEvent } from "@/interface/forum/event-registration-read";
import { ticketDate } from "@/interface/event-registration/event-ticket";

/** Who can register, as a tag on the row (S5). */
const MODE_LABELS = { unl: "Cuenta UNL", open: "Abierto al público" } as const satisfies Record<OpenRegistrationEvent["mode"], string>;

function seatsText(seatsLeft: number | null): string {
  if (seatsLeft === null) return "Sin límite de cupos";

  return seatsLeft === 1 ? "Queda 1 cupo" : `Quedan ${seatsLeft} cupos`;
}

/**
 * The row's action (S6). Every row leads to the event's page, which owns the sign-in and the reservation: a visitor is
 * told a UNL event asks them to sign in first, a signed-in student is not.
 */
function actionOf(mode: OpenRegistrationEvent["mode"], signedIn: boolean): { label: string; quiet: boolean } {
  return mode === "unl" && !signedIn ? { label: "Entrar para inscribirme", quiet: true } : { label: "Inscribirme", quiet: false };
}

/**
 * One event that takes registrations, as a compact row of the long list (S5): the date on a small stub, the title
 * with who can register and the facts on paper, and the action on the right. The title and the action both lead to
 * the event's page; the action names its event through the title (`aria-describedby`).
 */
export function RegistrationCard({ event, signedIn = false }: { event: OpenRegistrationEvent; signedIn?: boolean }) {
  const date = ticketDate(event.date, event.datePrecision);
  const facts = [event.hora, event.lugar, seatsText(event.seatsLeft)].filter(Boolean).join(" · ");
  const href = `/inscripciones/${event.slug}`;
  const titleId = `reg-card-${event.slug}`;
  const action = actionOf(event.mode, signedIn);
  const [month] = date.sub.split(" ");
  const stubLine = date.weekday ? `${month} · ${date.weekday}` : date.sub;

  return (
    <li className="reg-card" data-mode={event.mode}>
      <div className="reg-card-date" aria-hidden="true">
        <span className="reg-card-day">{date.main}</span>
        <span className="reg-card-mon">{stubLine}</span>
      </div>

      <div className="reg-card-body">
        <h3 id={titleId} className="reg-card-title">
          <Link href={href} className="reg-card-link">
            {event.title}
          </Link>
        </h3>
        <p className="reg-card-when">
          <span className="reg-card-mode">{MODE_LABELS[event.mode]}</span>
          <span>
            <time className="sr-only" dateTime={date.iso ?? undefined}>
              {`${date.label} · `}
            </time>
            {facts}
          </span>
        </p>
        {event.description ? <p className="reg-card-desc">{event.description}</p> : null}
      </div>

      <Link href={href} className="reg-card-go" data-tone={action.quiet ? "quiet" : undefined} aria-describedby={titleId}>
        {action.label}
      </Link>
    </li>
  );
}
