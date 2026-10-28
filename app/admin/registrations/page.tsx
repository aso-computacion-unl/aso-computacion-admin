import Link from "next/link";

import type { RegistrationOverviewRow } from "@/application";
import { Button } from "@/components/ui/button";
import { getAdminRegistrationOverview } from "@/interface/admin/event-registrations/registrations-overview-admin-read";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { pluralize } from "@/interface/admin/publication-summary";

import { EmptyState } from "../_components/empty-state";
import { Panel, PageFrame } from "../_components/form-layout";
import { PageHeader } from "../_components/page-header";
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

function RegistrationTable({ id, heading, rows }: { id: string; heading: string; rows: RegistrationOverviewRow[] }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-[0.8125rem] font-bold font-stretch-[118%] tracking-[0.04em] text-mist uppercase">
        {heading}
      </h2>

      <Panel className="mt-3 overflow-x-auto" aria-labelledby={id}>
        <table className="w-full min-w-208 border-collapse text-left text-sm">
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
                  {row.publication === "live" ? null : (
                    <span className="mt-1 block font-mono text-xs font-normal text-mist">{NOT_PUBLIC_LABELS[row.publication]}: no está en el sitio</span>
                  )}
                </th>
                <td className="py-3 pr-4 whitespace-nowrap">{formatEventDate(row.date, row.datePrecision)}</td>
                <td className="py-3 pr-4">{MODE_LABELS[row.mode]}</td>
                <td className="py-3 pr-4 font-mono text-[0.8125rem] whitespace-nowrap">{seats(row)}</td>
                <td className="py-3 pr-4 whitespace-nowrap">{row.deadline ? WHEN.format(row.deadline) : "Con el día del evento"}</td>
                <td className="py-3 pr-4">
                  <Stamp solid={row.state === "open"}>{STATE_LABELS[row.state]}</Stamp>
                </td>
                <td className="py-3">
                  <Button asChild variant="line" size="sm">
                    <Link href={`/admin/events/${row.id}/registrations`}>
                      Ver inscritos<span className="sr-only"> de {row.title}</span>
                    </Link>
                  </Button>
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
