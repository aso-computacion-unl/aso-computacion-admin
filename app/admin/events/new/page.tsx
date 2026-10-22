import { createEvent } from "@/interface/admin/events/actions";

import { BackLink, PageHead, Panel } from "../../_components/page-head";
import { EventForm } from "../_components/event-form";

export default function NewEventPage() {
  return (
    <div className="max-w-3xl">
      <BackLink href="/admin/events">Volver a eventos</BackLink>
      <PageHead title="Nuevo evento" meta="Después de crearlo podrá agregar fotos." />
      <Panel className="mt-6">
        <EventForm action={createEvent} submitLabel="Crear evento" />
      </Panel>
    </div>
  );
}
