"use server";

import { revalidatePath } from "next/cache";

import { parseRole } from "@/domain/user";
import { publicOrigin } from "@/infrastructure/auth/auth-config";

import { recordAudit } from "../../audit/record-audit";
import { getAuthServices } from "../../auth/auth-container";
import { requireRole } from "../../auth/require-session";
import { mapActionError as mapError, type ActionResult } from "../action-result";
import { ROLE_LABELS } from "../role-labels";

// Every action starts with the session guard, before it reads any input or touches a use case (a
// server action can be POSTed to any page). Managing users is ADMIN only. A deactivated user is
// signed out everywhere, and the last active admin can be neither demoted nor deactivated.
// Audit summaries carry the role and the user's or invite's id, never the email or an invite token.

const PAGE_PATH = "/admin/usuarios";

const USER_FIELD_MESSAGES = {
  role: "Elija un rol de la lista.",
  name: "El nombre admite hasta 120 caracteres.",
};

/** `link` is the invite's whole secret: it is shown once to the ADMIN and kept nowhere. */
export interface CreateInviteResult extends ActionResult {
  link?: string;
}

const MISSING_ORIGIN_MESSAGE = "No se puede generar el link: falta configurar AUTH_URL con la dirección pública del panel.";

export async function createAdminInvite(_prevState: CreateInviteResult | null, formData: FormData): Promise<CreateInviteResult> {
  try {
    const actor = await requireRole("ADMIN");
    const origin = publicOrigin(process.env.AUTH_URL);

    // Checked before anything is stored: an invite whose link cannot be built would only be an orphan.
    if (!origin) {
      return { error: MISSING_ORIGIN_MESSAGE };
    }

    const { invite, token, supersededInviteIds } = await getAuthServices().createInvite.execute({
      email: String(formData.get("email") ?? ""),
      role: parseRole(formData.get("role")),
      createdById: actor.userId,
    });
    await recordAudit(actor, { action: "invite.create", entityType: "invite", entityId: invite.id, summary: `Invitación creada con el rol ${ROLE_LABELS[invite.role]}` });

    for (const supersededId of supersededInviteIds) {
      await recordAudit(actor, { action: "invite.revoke", entityType: "invite", entityId: supersededId, summary: "Invitación anterior revocada al generar una nueva" });
    }

    revalidatePath(PAGE_PATH);
    return { success: true, link: `${origin}/invitacion/${token}` };
  } catch (error) {
    return mapError(error, USER_FIELD_MESSAGES);
  }
}

export async function revokeAdminInvite(id: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");

    await getAuthServices().revokeInvite.execute(String(id));
    await recordAudit(actor, { action: "invite.revoke", entityType: "invite", entityId: String(id), summary: "Invitación revocada" });
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return mapError(error);
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
