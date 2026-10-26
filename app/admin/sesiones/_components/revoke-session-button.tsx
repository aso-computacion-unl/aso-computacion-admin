"use client";

import { revokeSession } from "@/interface/admin/sessions/actions";

import { DeleteButton } from "../../_components/row-actions";

interface RevokeSessionButtonProps {
  sessionId: string;
  /** Names the session for assistive tech, e.g. "Chrome en Linux". */
  label: string;
  isCurrent: boolean;
}

export function RevokeSessionButton({ sessionId, label, isCurrent }: RevokeSessionButtonProps) {
  return (
    <DeleteButton
      label={label}
      warning={isCurrent ? "Es la sesión de este navegador: se cerrará y deberá iniciar sesión de nuevo." : "Ese dispositivo tendrá que iniciar sesión de nuevo."}
      note="Se puede volver a entrar cuando quiera."
      triggerLabel="Cerrar sesión"
      confirmLabel="Sí, cerrar la sesión"
      successMessage="Sesión cerrada."
      compactOnMobile={false}
      action={() => revokeSession(sessionId)}
    />
  );
}
