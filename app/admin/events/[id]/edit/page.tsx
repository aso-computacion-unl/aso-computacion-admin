import { notFound } from "next/navigation";

import { EVENT_PHOTO_MIN_WIDTH } from "@/application";
import { updateEvent } from "@/interface/admin/events/actions";
import { eventToFormValues } from "@/interface/admin/events/event-form-values";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";

import { FormPage, Panel } from "../../../_components/page-head";
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
    <FormPage
      backHref="/admin/events"
      backLabel="Volver a eventos"
      title="Editar evento"
      meta={`${event.slug} · ${event.isPublished ? "publicado" : "borrador"}`}
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
    </FormPage>
  );
}
