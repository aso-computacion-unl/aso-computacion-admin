import Link from "next/link";
import { notFound } from "next/navigation";

import { updateEvent } from "@/interface/admin/events/actions";
import { eventToFormValues } from "@/interface/admin/events/event-form-values";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";

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
    <section>
      <p>
        <Link href="/admin/events">← Volver a eventos</Link>
      </p>
      <h1>Editar evento</h1>
      <EventForm action={updateEvent.bind(null, id)} submitLabel="Guardar cambios" initialValues={eventToFormValues(event)} />
      <PhotoGallery
        eventId={id}
        photos={event.photos.map(({ id: photoId, url, alt, width, height }) => ({ id: photoId, url, alt, width, height }))}
      />
    </section>
  );
}
