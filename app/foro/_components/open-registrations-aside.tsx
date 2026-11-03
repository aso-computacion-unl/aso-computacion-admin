import Link from "next/link";

import { Icon } from "@/components/icons";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import type { OpenUnlEvent } from "@/interface/forum/event-registration-read";

function seatsText(seatsLeft: number): string {
  return seatsLeft === 1 ? "Queda 1 cupo" : `Quedan ${seatsLeft} cupos`;
}

/** The events that take registration with a UNL account, as links to their pages: the forum's only way into them. */
export function OpenRegistrationsAside({ events }: { events: OpenUnlEvent[] }) {
  return (
    <aside aria-labelledby="open-registrations-title" className="overflow-hidden rounded-xl border border-border bg-muted lg:sticky lg:top-22">
      <h2 id="open-registrations-title" className="flex items-center gap-2 border-b border-border px-3 py-3 text-base font-bold font-stretch-[106%] tracking-tight sm:px-4">
        <Icon name="events" className="size-4 text-sky" />
        Inscripciones abiertas
      </h2>
      <ul className="divide-y divide-border/50">
        {events.map((event) => (
          <li key={event.slug}>
            <Link href={`/foro/eventos/${event.slug}`} className="grid gap-0.5 px-3 py-3 transition-colors hover:bg-card focus-visible:-outline-offset-3 sm:px-4">
              <strong className="font-semibold leading-[1.35] wrap-anywhere text-foreground">{event.title}</strong>
              <span className="text-[0.8125rem] text-mist">
                {formatEventDate(event.date, event.datePrecision)}
                {event.seatsLeft === null ? null : ` · ${seatsText(event.seatsLeft)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
