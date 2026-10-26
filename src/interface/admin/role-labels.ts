import type { Role } from "@/domain/user";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
};

export const BREAK_GLASS_NOTICE =
  "Está usando el acceso de emergencia con contraseña. Úselo solo si el acceso con Google no está disponible y cierre la sesión al terminar.";

export const RESTRICTED_NOTICE = "Esa sección es solo para administradores.";

/** Who the sidebar says is signed in. */
export function sessionLabel(actor: { kind: "user" | "break_glass"; name: string; role: Role }): string {
  return actor.kind === "break_glass" ? "Acceso de emergencia" : `${actor.name} · ${ROLE_LABELS[actor.role]}`;
}
