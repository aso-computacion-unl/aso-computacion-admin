import { notFound, redirect } from "next/navigation";

import { updateEventRegistration } from "@/interface/admin/event-registrations/actions";
import { REGISTRATIONS_PATH, registrationsPanelPath } from "@/interface/admin/event-registrations/saved-flag";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";
import { windowEndToFormValue } from "@/interface/admin/publication-window-fields";

import { FormLayout, Panel } from "../../../_components/form-layout";
import { RegistrationEventSummary } from "../../_components/registration-event-summary";
import { RegistrationForm } from "../../_components/registration-form";

export const dynamic = "force-dynamic";

/** «Configurar inscripción»: change or turn off the registration of an event, its other fields read-only (S1). */
export default async function EditRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getAdminEvent(id);

  if (!event) notFound();
  // Editing never opens a registration: an announcement never takes one, so it goes back to the panel.
  if (event.registrationMode === "none") redirect(REGISTRATIONS_PATH);

  return (
    <FormLayout backHref={registrationsPanelPath(id)} backLabel="Volver a inscripciones" title="Configurar inscripción" status={event.title}>
      <RegistrationEventSummary event={event} />
      <Panel aria-label="Inscripción">
        <RegistrationForm
          action={updateEventRegistration.bind(null, id)}
          initialValues={{
            registrationMode: event.registrationMode,
            registrationCapacity: event.registrationCapacity === null ? "" : String(event.registrationCapacity),
            registrationDeadline: windowEndToFormValue(event.registrationDeadline),
          }}
          submitLabel="Guardar cambios"
          registeredCount={event.registeredCount}
        />
      </Panel>
    </FormLayout>
  );
}
