import Link from "next/link";
import { notFound } from "next/navigation";

import { EVENT_PHOTO_MIN_WIDTH } from "@/application";
import { Button } from "@/components/ui/button";
import type { EventRegistrationMode } from "@/domain/event-registration";
import { updateEvent } from "@/interface/admin/events/actions";
import { CREATED_FLAG, PHOTOS_SECTION_ID } from "@/interface/admin/events/created-flag";
import { eventToFormValues } from "@/interface/admin/events/event-form-values";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";

import { recordStatus } from "../../../_components/page-header";
import { FormLayout, Panel } from "../../../_components/form-layout";
import { SectionJumps } from "../../../_components/section-jumps";
import { formatWhen, MODE_LABELS } from "../../../registrations/_components/registration-format";
import { EventCreatedArrival } from "../../_components/event-created-arrival";
import { EventForm } from "../../_components/event-form";
import { PhotoGallery } from "../../_components/photo-gallery";

export const dynamic = "force-dynamic";

interface RegistrationSettings {
  registrationMode: EventRegistrationMode;
  registrationCapacity: number | null;
  registrationDeadline: Date | null;
}

/** S3: the registration as the event page reads it («Inscripción: Formulario abierto · 40 cupos · cierra …»); it is set only in Inscripciones. */
function registrationSummary({ registrationMode, registrationCapacity, registrationDeadline }: RegistrationSettings): string {
  if (registrationMode === "none") return "Sin inscripción";

  const seats = registrationCapacity === null ? "sin límite de cupos" : `${registrationCapacity} cupos`;
  const closes = registrationDeadline ? [`cierra ${formatWhen(registrationDeadline)}`] : [];

  return [`Inscripción: ${MODE_LABELS[registrationMode]}`, seats, ...closes].join(" · ");
}

interface EditEventPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [CREATED_FLAG]?: string | string[] }>;
}

export default async function EditEventPage({ params, searchParams }: EditEventPageProps) {
  const { id } = await params;
  const justCreated = (await searchParams)[CREATED_FLAG] === "1";
  const event = await getAdminEvent(id);

  if (!event) notFound();

  const takesRegistrations = event.registrationMode !== "none";
  const manageRegistrationHref = `/admin/registrations/${id}/edit`;
  // The sections sit under the 56px top bar when a jump lands on them.
  const anchor = "scroll-mt-18";

  return (
    <FormLayout
      backHref="/admin/events"
      backLabel="Volver a eventos"
      title={event.title}
      status={recordStatus(event.isPublished, "m", event.slug)}
    >
      {justCreated ? <EventCreatedArrival /> : null}
      <SectionJumps
        label="Secciones del evento"
        items={[
          { href: "#datos", label: "Datos" },
          { href: `#${PHOTOS_SECTION_ID}`, label: `Fotos (${event.photos.length})` },
          ...(takesRegistrations ? [{ href: "#inscripciones" as const, label: "Inscripciones" }] : []),
        ]}
      />
      <Panel id="datos" aria-label="Datos del evento" className={anchor}>
        <EventForm action={updateEvent.bind(null, id)} autosave submitLabel="Guardar cambios" initialValues={eventToFormValues(event)} registrationHref={takesRegistrations ? manageRegistrationHref : undefined} />
      </Panel>
      <div id={PHOTOS_SECTION_ID} className={anchor}>
        <PhotoGallery
          eventId={id}
          minWidth={EVENT_PHOTO_MIN_WIDTH}
          photos={event.photos.map(({ id: photoId, url, alt, width, height }) => ({ id: photoId, url, alt, width, height }))}
        />
      </div>
      <Panel id="inscripciones" aria-label="Inscripción" className={`${anchor} grid gap-3`}>
        <p className="text-sm wrap-anywhere">{registrationSummary(event)}</p>
        {takesRegistrations ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="line">
              <Link href={manageRegistrationHref}>Gestionar inscripción</Link>
            </Button>
            <Button asChild variant="quiet">
              <Link href={`/admin/events/${id}/registrations`}>Ver inscripciones</Link>
            </Button>
          </div>
        ) : null}
      </Panel>
    </FormLayout>
  );
}
