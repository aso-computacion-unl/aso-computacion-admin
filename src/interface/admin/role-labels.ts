import type { Role } from "@/domain/user";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
};

/** What the identity chip says for the password session, which has no account, name or role of its own. */
export const EMERGENCY_LABEL = "Acceso de emergencia";

export const BREAK_GLASS_NOTICE =
  "Está usando el acceso de emergencia con contraseña. Úselo solo si el acceso con Google no está disponible y cierre la sesión al terminar.";

export const RESTRICTED_NOTICE = "Esa sección es solo para administradores.";

/** Who is signed in, in one line (the accessible name of the identity chip). */
export function sessionLabel(actor: { kind: "user" | "break_glass"; name: string; role: Role }): string {
  return actor.kind === "break_glass" ? EMERGENCY_LABEL : `${actor.name} · ${ROLE_LABELS[actor.role]}`;
}
