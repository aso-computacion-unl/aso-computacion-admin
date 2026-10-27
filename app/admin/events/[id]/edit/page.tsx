import Link from "next/link";
import { notFound } from "next/navigation";

import { EVENT_PHOTO_MIN_WIDTH } from "@/application";
import { Button } from "@/components/ui/button";
import { updateEvent } from "@/interface/admin/events/actions";
import { eventToFormValues } from "@/interface/admin/events/event-form-values";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";

import { recordStatus } from "../../../_components/page-header";
import { FormLayout, Panel } from "../../../_components/form-layout";
import { EventForm } from "../../_components/event-form";
import { PhotoGallery } from "../../_components/photo-gallery";

export const dynamic = "force-dynamic";

interface EditEventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params;
  const event = await getAdminEvent(id);

  if (!event) notFound();

  return (
    <FormLayout
      backHref="/admin/events"
      backLabel="Volver a eventos"
      title="Editar evento"
      status={recordStatus(event.slug, event.isPublished, "m")}
      aside={
        <PhotoGallery
          eventId={id}
          minWidth={EVENT_PHOTO_MIN_WIDTH}
          photos={event.photos.map(({ id: photoId, url, alt, width, height }) => ({ id: photoId, url, alt, width, height }))}
        />
      }
    >
      <Panel aria-label="Datos del evento">
        <EventForm action={updateEvent.bind(null, id)} submitLabel="Guardar cambios" initialValues={eventToFormValues(event)} />
      </Panel>
      {event.registrationMode === "none" ? null : (
        <Panel aria-label="Inscripciones" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-mist">Las personas inscritas y sus datos están en una página aparte.</p>
          <Button asChild variant="line">
            <Link href={`/admin/events/${id}/registrations`}>Ver inscripciones</Link>
          </Button>
        </Panel>
      )}
    </FormLayout>
  );
}
