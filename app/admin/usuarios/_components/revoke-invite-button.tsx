"use client";

import { revokeAdminInvite } from "@/interface/admin/users/actions";

import { DeleteButton } from "../../_components/row-actions";

export function RevokeInviteButton({ id, email }: { id: string; email: string }) {
  return (
    <DeleteButton
      label={`invitación de ${email}`}
      triggerLabel="Revocar"
      confirmLabel="Sí, revocar"
      warning={`El link enviado a ${email} dejará de funcionar.`}
      note="Podrá crear otra invitación cuando quiera."
      successMessage="Invitación revocada."
      action={() => revokeAdminInvite(id)}
    />
  );
}
