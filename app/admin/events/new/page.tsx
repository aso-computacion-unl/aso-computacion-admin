import { createEvent } from "@/interface/admin/events/actions";

import { AsideNote, FormPage, Panel } from "../../_components/page-head";
import { EventForm } from "../_components/event-form";

export default function NewEventPage() {
  return (
    <FormPage
      backHref="/admin/events"
      backLabel="Volver a eventos"
      title="Nuevo evento"
      meta="Después de crearlo podrá agregar fotos."
      aside={<AsideNote title="Fotos">Se agregan al guardar el evento, en la pantalla de edición: hasta 12, de al menos 1200 px de ancho.</AsideNote>}
    >
      <Panel>
        <EventForm action={createEvent} submitLabel="Crear evento" />
      </Panel>
    </FormPage>
  );
}
