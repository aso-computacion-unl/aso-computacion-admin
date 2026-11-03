import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getAdminEventRegistrations } from "@/interface/admin/event-registrations/registrations-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";

import { BackLink, PageHead, Panel } from "../../../_components/page-head";
import { EmptyState } from "../../../_components/timeline-parts";
import { RegistrationDeleteButton } from "./_components/registration-delete-button";

// Personal data that changes with every registration: never prerendered.
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });
const MODE_LABELS = { none: "Sin inscripción", unl: "Cuenta UNL", open: "Formulario abierto" } as const;

export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getAdminEventRegistrations(id);

  if (!page) notFound();

  const { event, registrations, canManage } = page;
  const seats = event.registrationCapacity === null ? "sin límite de cupos" : `${registrations.length} de ${pluralize(event.registrationCapacity, "cupo", "cupos")}`;

  return (
    <div>
      <BackLink href={`/admin/events/${id}/edit`}>Volver al evento</BackLink>
      <PageHead
        title="Inscripciones"
        meta={`${event.title} · ${MODE_LABELS[event.registrationMode]} · ${pluralize(registrations.length, "inscrito", "inscritos")} · ${seats}`}
        action={
          canManage ? (
            <Button asChild variant="line">
              <a href={`/admin/events/${id}/registrations/export`} download>
                <Icon name="down" className="size-4" />
                Exportar CSV
              </a>
            </Button>
          ) : undefined
        }
      />
      <p className="mt-4 max-w-2xl text-mist">
        Estos son datos personales: úselos solo para organizar el evento.
        {canManage ? "" : " Solo un administrador puede exportar o eliminar inscripciones."}
      </p>

      {registrations.length === 0 ? (
        <EmptyState action={<Link href={`/admin/events/${id}/edit`} className="font-semibold underline underline-offset-4">Editar el evento</Link>}>
          Todavía no hay inscripciones.
        </EmptyState>
      ) : (
        <Panel className="mt-6 overflow-x-auto" aria-label="Lista de inscripciones">
          <table className="w-full min-w-176 border-collapse text-left text-sm">
            <caption className="sr-only">Inscripciones de {event.title}</caption>
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
                  <td className="py-3 pr-4 whitespace-nowrap">{WHEN.format(registration.createdAt)}</td>
                  {canManage ? (
                    <td className="py-3">
                      <RegistrationDeleteButton eventId={id} registrationId={registration.id} name={registration.name} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
