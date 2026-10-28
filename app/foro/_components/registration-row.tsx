import Link from "next/link";

import { Icon } from "@/components/icons";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import type { OpenUnlEvent } from "@/interface/forum/event-registration-read";

function seatsText(seatsLeft: number | null): string {
  if (seatsLeft === null) return "Sin límite de cupos";

  return seatsLeft === 1 ? "Queda 1 cupo" : `Quedan ${seatsLeft} cupos`;
}

/**
 * One event open for registration: the whole row is the link to its page, like a thread in the list. It lives in
 * `.thread-graph` (forum.css), so it hangs on the same branch line and uses the same columns.
 */
export function RegistrationRow({ event }: { event: OpenUnlEvent }) {
  return (
    <li>
      <Link
        href={`/foro/eventos/${event.slug}`}
        className="thread-cols group gap-y-0.5 py-3.5 transition-colors hover:bg-card focus-visible:-outline-offset-3 xl:py-4 2xl:py-5"
      >
        <span className="relative z-10 row-span-2 h-6 self-start rounded-full bg-background pt-0.5 text-sky transition-colors group-hover:bg-card">
          <Icon name="events" />
        </span>
        <strong className="font-semibold leading-[1.35] wrap-anywhere text-foreground xl:text-[1.0625rem]">{event.title}</strong>
        <span className="row-span-2 inline-flex items-center gap-1.5 self-center text-sm font-semibold text-sky xl:col-start-5 xl:row-start-1 xl:justify-self-end">
          <span className="sr-only">Ver la inscripción</span>
          <Icon name="right" className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="col-start-2 text-[0.8125rem] text-mist xl:contents">
          <span className="xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-center xl:text-sm">{formatEventDate(event.date, event.datePrecision)}</span>
          <span className="xl:hidden"> · </span>
          <span className="xl:col-start-4 xl:row-span-2 xl:row-start-1 xl:self-center xl:text-sm">{seatsText(event.seatsLeft)}</span>
        </span>
      </Link>
    </li>
  );
}
