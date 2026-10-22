import Link from "next/link";

import { createEvent } from "@/interface/admin/events/actions";

import { EventForm } from "../_components/event-form";

export default function NewEventPage() {
  return (
    <section>
      <p>
        <Link href="/admin/events">← Volver a eventos</Link>
      </p>
      <h1>Crear evento</h1>
      <p>Después de crearlo podrá agregar fotos.</p>
      <EventForm action={createEvent} submitLabel="Crear evento" />
    </section>
  );
}
