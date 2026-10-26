"use server";

import { revalidatePath } from "next/cache";

import { parseRole } from "@/domain/user";

import { recordAudit } from "../../audit/record-audit";
import { getAuthServices } from "../../auth/auth-container";
import { requireRole } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { ROLE_LABELS } from "../role-labels";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). Managing users is ADMIN only. A deactivated user is
// signed out everywhere, and the last active admin can be neither demoted nor deactivated.
// Audit summaries carry the role and the user's id, never the email.

const PAGE_PATH = "/admin/usuarios";

const USER_FIELD_MESSAGES = {
  role: "Elija un rol de la lista.",
  name: "El nombre admite hasta 120 caracteres.",
};

export async function inviteUser(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    const user = await getAuthServices().inviteUser.execute({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      role: parseRole(formData.get("role")),
    });
    await recordAudit(actor, { action: "user.invite", entityType: "user", entityId: user.id, summary: `Usuario agregado con el rol ${ROLE_LABELS[user.role]}` });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapError(error, USER_FIELD_MESSAGES);
  }
}

export async function changeUserRole(id: string, role: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    const parsed = parseRole(role);

    await getAuthServices().changeUserRole.execute({ id, role: parsed });
    await recordAudit(actor, { action: "user.role_change", entityType: "user", entityId: id, summary: `Rol cambiado a ${ROLE_LABELS[parsed]}` });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapError(error, USER_FIELD_MESSAGES);
  }
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");

    await getAuthServices().setUserActive.execute({ id, active: active === true });
    await recordAudit(actor, {
      action: active === true ? "user.reactivate" : "user.deactivate",
      entityType: "user",
      entityId: id,
      summary: active === true ? "Usuario reactivado" : "Usuario desactivado y sesiones cerradas",
    });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapError(error);
  }
}
