"use client";

import { revokeOtherSessions } from "@/interface/admin/sessions/actions";

import { DeleteButton } from "../../_components/row-actions";

interface RevokeOthersButtonProps {
  userId: string;
  /** Who the sessions belong to, for assistive tech and the confirmation: the person's name. */
  label: string;
  /** How many sessions will be closed. */
  count: number;
  /** The group holds this browser's session: it stays open and the button reads "las demás". */
  isOwn: boolean;
}

export function RevokeOthersButton({ userId, label, count, isOwn }: RevokeOthersButtonProps) {
  const sessions = count === 1 ? "1 sesión" : `${count} sesiones`;

  return (
    <DeleteButton
      label={label}
      warning={isOwn ? `Se cerrarán ${sessions} en otros dispositivos. Esta sesión sigue abierta.` : `Se cerrarán ${sessions} de ${label}. Tendrá que iniciar sesión de nuevo.`}
      note="Se puede volver a entrar cuando quiera."
      triggerLabel={isOwn ? "Cerrar las demás" : "Cerrar todas"}
      confirmLabel={isOwn ? "Sí, cerrar las demás" : "Sí, cerrar todas"}
      successMessage="Sesiones cerradas."
      compactOnMobile={false}
      action={() => revokeOtherSessions(userId)}
    />
  );
}
