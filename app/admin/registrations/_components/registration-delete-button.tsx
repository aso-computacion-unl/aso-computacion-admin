"use client";

import { deleteEventRegistration } from "@/interface/admin/event-registrations/actions";

import { DeleteButton } from "../../_components/row-actions";

/** Deleting a registration is permanent and ADMIN only: it frees the seat and cannot be undone. */
export function RegistrationDeleteButton({ eventId, registrationId, name }: { eventId: string; registrationId: string; name: string }) {
  return (
    <DeleteButton
      label={`inscripción de ${name}`}
      triggerLabel="Eliminar"
      confirmLabel="Sí, eliminar"
      warning={`Se borrarán los datos de ${name} y se liberará su cupo.`}
      note="Esta acción no se puede deshacer."
      successMessage="Inscripción eliminada."
      action={() => deleteEventRegistration(eventId, registrationId)}
    />
  );
}
