"use client";

import { useRouter } from "next/navigation";

import { deleteEventRegistration } from "@/interface/admin/event-registrations/actions";

import { DeleteButton } from "../../_components/row-actions";

/** Deleting a registration is permanent and ADMIN only: it frees the seat and cannot be undone. */
export function RegistrationDeleteButton({ eventId, registrationId, name }: { eventId: string; registrationId: string; name: string }) {
  const router = useRouter();

  return (
    <DeleteButton
      label={`inscripción de ${name}`}
      triggerLabel="Eliminar"
      confirmLabel="Sí, eliminar"
      warning={`Se borrarán los datos de ${name} y se liberará su cupo.`}
      note="Esta acción no se puede deshacer."
      successMessage="Inscripción eliminada."
      action={async () => {
        const result = await deleteEventRegistration(eventId, registrationId);

        // The action refreshes the old per-event path; the list and the counts live on this screen now.
        if (result.success) router.refresh();

        return result;
      }}
    />
  );
}
