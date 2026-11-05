import Link from "next/link";

import type { RegistrationOverviewRow } from "@/application";
import { Button } from "@/components/ui/button";
import { getAdminRegistrationOverview } from "@/interface/admin/event-registrations/registrations-overview-admin-read";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { pluralize } from "@/interface/admin/publication-summary";

import { EmptyState } from "../_components/empty-state";
import { Panel, PageFrame } from "../_components/form-layout";
import { PageHeader } from "../_components/page-header";
import { SectionTitle } from "../_components/section-title";
import { Stamp } from "../_components/timeline-parts";

// Counts that change with every registration: never prerendered.
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });
const MODE_LABELS = { unl: "Cuenta UNL", open: "Formulario abierto" } as const;
const STATE_LABELS = { open: "Abierta", full: "Sin cupos", closed: "Cerrada" } as const;
// A live event shows nothing: the stamp only says why an event with registrants is not on the landing right now.
const NOT_PUBLIC_LABELS = { draft: "Borrador", scheduled: "Programado", expired: "Retirado" } as const;

function seats({ registered, capacity }: RegistrationOverviewRow): string {
  return capacity === null ? `${registered} · sin límite` : `${registered} / ${capacity}`;
}

/** What a screen reader says for the seats: the slash and the dot are not words. */
function seatsSpoken({ registered, capacity }: RegistrationOverviewRow): string {
  return capacity === null ? `${registered}, sin límite` : `${registered} de ${capacity}`;
}

/** When registration ends: the deadline, or what the event itself decides (its day, its month, or never when it has no date). */
function closing(row: RegistrationOverviewRow): string {
  // "p. m." never breaks across two lines.
  if (row.deadline) return WHEN.format(row.deadline).replace(/\s([ap])\. m\./, "\u00a0$1.\u00a0m.");
  if (row.date === null) return "Sin cierre";

  return row.datePrecision === "month" ? "Al terminar el mes" : "Con el día del evento";
}

function Seats({ row }: { row: RegistrationOverviewRow }) {
  return (
    <>
      <span aria-hidden="true">{seats(row)}</span>
      <span className="sr-only">{seatsSpoken(row)}</span>
    </>
  );
}

function NotPublicNote({ row }: { row: RegistrationOverviewRow }) {
  return row.publication === "live" ? null : (
    <span className="mt-1 block font-mono text-xs font-normal text-mist">{NOT_PUBLIC_LABELS[row.publication]}: no está en el sitio</span>
  );
}

function RegistrantsLink({ row, className }: { row: RegistrationOverviewRow; className?: string }) {
  return (
    <Button asChild variant="line" size="sm" className={className}>
      <Link href={`/admin/events/${row.id}/registrations`}>
        Ver inscritos<span className="sr-only"> de {row.title}</span>
      </Link>
    </Button>
  );
}

/** Below 84rem (where the admin's own lists stack too) each event is a block: nothing hides behind a sideways scroll. */
function RegistrationList({ rows }: { rows: RegistrationOverviewRow[] }) {
  return (
    <Panel className="mt-3 min-[84rem]:hidden">
      <ul className="grid divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-semibold wrap-anywhere">
                {row.title}
                <NotPublicNote row={row} />
              </p>
              <Stamp solid={row.state === "open"}>{STATE_LABELS[row.state]}</Stamp>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
              <div>
                <dt className="text-mist">Fecha</dt>
                <dd>{formatEventDate(row.date, row.datePrecision)}</dd>
              </div>
              <div>
                <dt className="text-mist">Forma</dt>
                <dd>{MODE_LABELS[row.mode]}</dd>
              </div>
              <div>
                <dt className="text-mist">Inscritos</dt>
                <dd className="font-mono text-[0.8125rem] tabular-nums">
                  <Seats row={row} />
                </dd>
              </div>
              <div>
                <dt className="text-mist">Cierre</dt>
                <dd>{closing(row)}</dd>
              </div>
            </dl>
            <RegistrantsLink row={row} className="min-h-11 max-md:w-full md:justify-self-start" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RegistrationTable({ id, heading, rows }: { id: string; heading: string; rows: RegistrationOverviewRow[] }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <SectionTitle id={id} variant="label">
        {heading}
      </SectionTitle>

      <RegistrationList rows={rows} />

      {/* `relative` keeps the screen-reader-only text inside the scroll area instead of widening the page. */}
      <Panel className="relative mt-3 hidden overflow-x-auto min-[84rem]:block">
        <table className="w-full min-w-208 table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-28" />
            <col className="w-28" />
          </colgroup>
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr className="border-b border-border text-mist">
              <th scope="col" className="py-2 pr-4 font-semibold">Evento</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Fecha</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Forma</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Inscritos</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Cierre</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Estado</th>
              <th scope="col" className="py-2 font-semibold"><span className="sr-only">Inscripciones</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 align-top">
                <th scope="row" className="py-3 pr-4 font-semibold wrap-anywhere">
                  {row.title}
                  <NotPublicNote row={row} />
                </th>
                <td className="py-3 pr-4 whitespace-nowrap">{formatEventDate(row.date, row.datePrecision)}</td>
                <td className="py-3 pr-4">{MODE_LABELS[row.mode]}</td>
                <td className="py-3 pr-4 font-mono text-[0.8125rem] whitespace-nowrap tabular-nums">
                  <Seats row={row} />
                </td>
                <td className="py-3 pr-4">{closing(row)}</td>
                <td className="py-3 pr-4">
                  <Stamp solid={row.state === "open"}>{STATE_LABELS[row.state]}</Stamp>
                </td>
                <td className="py-3">
                  <RegistrantsLink row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  );
}

export default async function RegistrationsOverviewPage() {
  const { upcoming, past } = await getAdminRegistrationOverview();
  const rows = [...upcoming, ...past];
  const registered = rows.reduce((total, row) => total + row.registered, 0);

  return (
    <PageFrame>
      <PageHeader
        title="Inscripciones"
        status={`${pluralize(rows.length, "evento", "eventos")} · ${pluralize(registered, "inscrito", "inscritos")}`}
        description="Todos los eventos que piden inscripción, de cualquier fecha. Los nombres y correos están en la página de cada evento."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="events"
          action={
            <Button asChild variant="line">
              <Link href="/admin/events">Ir a los eventos</Link>
            </Button>
          }
        >
          Ningún evento pide inscripción todavía. Elija una forma de inscripción al editar un evento.
        </EmptyState>
      ) : (
        <>
          {upcoming.length > 0 ? <RegistrationTable id="registrations-upcoming" heading="Próximos" rows={upcoming} /> : null}
          {past.length > 0 ? <RegistrationTable id="registrations-past" heading="Pasados" rows={past} /> : null}
        </>
      )}
    </PageFrame>
  );
}
