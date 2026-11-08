import { createEvent } from "@/interface/admin/events/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { EventForm } from "../_components/event-form";

export default function NewEventPage() {
  return (
    <FormLayout backHref="/admin/events" backLabel="Volver a eventos" title="Nuevo evento" status="sin guardar">
      <Panel>
        <EventForm action={createEvent} submitLabel="Crear evento" />
      </Panel>
    </FormLayout>
  );
}
