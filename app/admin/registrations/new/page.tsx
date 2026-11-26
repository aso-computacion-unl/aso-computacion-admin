import { createEventWithRegistration } from "@/interface/admin/events/actions";
import { REGISTRATIONS_PATH } from "@/interface/admin/event-registrations/saved-flag";

import { FormLayout, Panel } from "../../_components/form-layout";
import { EventForm } from "../../events/_components/event-form";

/**
 * «Crear inscripción» (event-kinds S3, S4): one form for a new event and its registration, the kind already fixed.
 * No existing event is picked: an announcement never takes a registration.
 */
export default function NewRegistrationPage() {
  return (
    <FormLayout backHref={REGISTRATIONS_PATH} backLabel="Volver a inscripciones" title="Crear inscripción" status="sin guardar">
      <Panel>
        <EventForm action={createEventWithRegistration} fixedKind="registration" submitLabel="Crear inscripción" />
      </Panel>
    </FormLayout>
  );
}
