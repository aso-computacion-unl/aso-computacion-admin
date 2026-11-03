import { createEvent } from "@/interface/admin/events/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { EventForm } from "../_components/event-form";

export default function NewEventPage() {
  return (
    <FormLayout
      backHref="/admin/events"
      backLabel="Volver a eventos"
      title="Nuevo evento"
      status="sin guardar"
      description="Después de crearlo podrá agregar fotos: hasta 12, de al menos 1200 px de ancho."
    >
      <Panel>
        <EventForm action={createEvent} submitLabel="Crear evento" />
      </Panel>
    </FormLayout>
  );
}
