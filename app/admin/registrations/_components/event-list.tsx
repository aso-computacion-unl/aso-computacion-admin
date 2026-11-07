import Link from "next/link";

import type { RegistrationOverviewRow } from "@/application";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { cn } from "@/lib/utils";

import { SectionTitle } from "../../_components/section-title";
import { Stamp } from "../../_components/timeline-parts";
import { NOT_PUBLIC_LABELS, seats, seatsSpoken, STATE_LABELS, STATE_MARKS } from "./registration-format";

function EventLink({ row, selected }: { row: RegistrationOverviewRow; selected: boolean }) {
  return (
    <Link
      href={`/admin/registrations?evento=${row.id}`}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "grid min-h-11 gap-1.5 rounded border border-transparent bg-card p-3 transition-colors duration-150 ease-out hover:bg-foreground/6",
        "aria-[current=true]:border-action aria-[current=true]:bg-tint-blue",
      )}
    >
      <span className="font-semibold wrap-anywhere">{row.title}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-mist">
        <span>{formatEventDate(row.date, row.datePrecision)}</span>
        <span className="font-mono text-[0.8125rem] tabular-nums">
          <span aria-hidden="true">{seats(row)}</span>
          <span className="sr-only">{seatsSpoken(row)}</span>
        </span>
        <Stamp solid={row.state === "open"}>
          <span aria-hidden="true" className="mr-1.5">{STATE_MARKS[row.state]}</span>
          {STATE_LABELS[row.state]}
        </Stamp>
      </span>
      {row.publication === "live" ? null : (
        <span className="font-mono text-xs text-mist">{NOT_PUBLIC_LABELS[row.publication]}: no está en el sitio</span>
      )}
    </Link>
  );
}

function EventGroup({ id, heading, rows, selectedId }: { id: string; heading: string; rows: RegistrationOverviewRow[]; selectedId: string | undefined }) {
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <SectionTitle id={id} variant="label">
        {heading}
      </SectionTitle>
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            <EventLink row={row} selected={row.id === selectedId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The events that take registrations, upcoming first: each a real link, so choosing one works without scripts and can be shared. */
export function EventList({ upcoming, past, selectedId }: { upcoming: RegistrationOverviewRow[]; past: RegistrationOverviewRow[]; selectedId: string | undefined }) {
  return (
    <nav aria-label="Eventos con inscripción" className="grid content-start gap-6">
      {upcoming.length > 0 ? <EventGroup id="registrations-upcoming" heading="Próximos" rows={upcoming} selectedId={selectedId} /> : null}
      {past.length > 0 ? <EventGroup id="registrations-past" heading="Pasados" rows={past} selectedId={selectedId} /> : null}
    </nav>
  );
}
