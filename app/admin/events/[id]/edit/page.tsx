import { notFound } from "next/navigation";

import { EVENT_PHOTO_MIN_WIDTH } from "@/application";
import { updateEvent } from "@/interface/admin/events/actions";
import { eventToFormValues } from "@/interface/admin/events/event-form-values";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";

import { BackLink, PageHead, Panel } from "../../../_components/page-head";
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
    <>
      <BackLink href="/admin/events">Volver a eventos</BackLink>
      <PageHead title="Editar evento" meta={`${event.slug} · ${event.isPublished ? "publicado" : "borrador"}`} />
      <div className="mt-6 grid gap-6">
        <Panel aria-label="Datos del evento" className="max-w-3xl">
          <EventForm action={updateEvent.bind(null, id)} submitLabel="Guardar cambios" initialValues={eventToFormValues(event)} />
        </Panel>
        <PhotoGallery
          eventId={id}
          minWidth={EVENT_PHOTO_MIN_WIDTH}
          photos={event.photos.map(({ id: photoId, url, alt, width, height }) => ({ id: photoId, url, alt, width, height }))}
        />
      </div>
    </>
  );
}
