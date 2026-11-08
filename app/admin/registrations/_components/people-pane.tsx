import Link from "next/link";

import type { RegistrationOverviewRow } from "@/application";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { getAdminEventRegistrations } from "@/interface/admin/event-registrations/registrations-admin-read";

import { Panel } from "../../_components/form-layout";
import { SectionTitle } from "../../_components/section-title";
import { RegistrationDeleteButton } from "./registration-delete-button";
import { RegistrationsEmptyState } from "./registrations-empty-state";
import { closing, formatWhen, MODE_LABELS, seats, seatsSpoken } from "./registration-format";

type EventRegistrations = NonNullable<Awaited<ReturnType<typeof getAdminEventRegistrations>>>;

function PeopleTable({ eventId, title, registrations, canManage }: { eventId: string; title: string; registrations: EventRegistrations["registrations"]; canManage: boolean }) {
  return (
    // `relative` keeps the screen-reader-only text inside the scroll area instead of widening the page.
    <Panel className="relative mt-3 overflow-x-auto" aria-label="Lista de inscripciones">
      <table className="w-full min-w-176 border-collapse text-left text-sm">
        <caption className="sr-only">Inscripciones de {title}</caption>
        <thead>
          <tr className="border-b border-border text-mist">
            <th scope="col" className="py-2 pr-4 font-semibold">Nombre</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Correo</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Forma</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Carrera</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Ciclo</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Inscrito</th>
            {canManage ? <th scope="col" className="py-2 font-semibold"><span className="sr-only">Acciones</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {registrations.map((registration) => (
            <tr key={registration.id} className="border-b border-border/60 align-top">
              <th scope="row" className="py-3 pr-4 font-semibold wrap-anywhere">{registration.name}</th>
              <td className="py-3 pr-4 font-mono text-[0.8125rem] wrap-anywhere">{registration.email}</td>
              <td className="py-3 pr-4">{MODE_LABELS[registration.mode]}</td>
              <td className="py-3 pr-4">{registration.career ?? "—"}</td>
              <td className="py-3 pr-4">{registration.semester ?? "—"}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{formatWhen(registration.createdAt)}</td>
              {canManage ? (
                <td className="py-3">
                  <RegistrationDeleteButton eventId={eventId} registrationId={registration.id} name={registration.name} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** The people registered for the selected event: its facts, the actions the role has, and the table or why it is empty. */
export function PeoplePane({ row, page }: { row: RegistrationOverviewRow; page: EventRegistrations }) {
  const { event, registrations, canManage, adminOrigin } = page;

  return (
    <section aria-labelledby="registrations-people" className="grid content-start gap-3">
      <Link href="/admin/registrations" className="inline-flex min-h-11 items-center font-semibold text-mist hover:text-foreground xl:hidden">
        ← Eventos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <SectionTitle id="registrations-people" className="wrap-anywhere">
            {row.title}
          </SectionTitle>
          <p className="mt-1.5 font-mono text-[0.8125rem] wrap-anywhere text-mist">
            {MODE_LABELS[row.mode]} ·{" "}
            <span aria-hidden="true">{seats(row)}</span>
            <span className="sr-only">{seatsSpoken(row)}</span> · Cierre: {closing(row)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button asChild variant="line">
              <a href={`/admin/events/${event.id}/registrations/export`} download>
                <Icon name="down" className="size-4" />
                Exportar CSV
              </a>
            </Button>
          ) : null}
          <Button asChild variant="quiet" size="sm">
            <Link href={`/admin/events/${event.id}/edit`}>Editar evento</Link>
          </Button>
        </div>
      </div>

      <p className="text-sm text-mist">Datos personales: úselos solo para organizar el evento.{canManage ? "" : " Solo un administrador puede exportar o eliminar."}</p>

      {registrations.length === 0 ? (
        <RegistrationsEmptyState eventId={event.id} slug={event.slug} mode={event.registrationMode} isPublished={event.isPublished} adminOrigin={adminOrigin} />
      ) : (
        <PeopleTable eventId={event.id} title={row.title} registrations={registrations} canManage={canManage} />
      )}
    </section>
  );
}
