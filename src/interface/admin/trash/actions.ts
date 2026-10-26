"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/application";

import { requireAdminSession } from "../../auth/require-admin-session";
import { mapActionError, type ActionResult } from "../action-result";
import { TRASH_PATH } from "./paths";
import { LIST_PATH_BY_KIND, parseTrashKind } from "./trash-kinds";
import { getTrashUseCases } from "./trash-container";

// Every action starts with `await requireAdminSession()`, before it reads any
// input or touches a use case (a server action can be POSTed to any page).
//
// Neither action asks for a landing rebuild: a restored item is a draft and a
// purged one was already out of the public content, so the site does not change.

const INVALID_KIND = { error: "El tipo de elemento no es válido." };
const GONE = { error: "El elemento ya no está en la papelera." };

export async function restoreTrashed(kind: string, id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    const trashKind = parseTrashKind(kind);

    if (!trashKind) {
      return INVALID_KIND;
    }

    await getTrashUseCases().restore[trashKind].execute({ id });
    revalidatePath(TRASH_PATH);
    revalidatePath(LIST_PATH_BY_KIND[trashKind]);
    return { success: true };
  } catch (error) {
    return error instanceof NotFoundError ? GONE : mapActionError(error);
  }
}

export async function purgeTrashed(kind: string, id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    const trashKind = parseTrashKind(kind);

    if (!trashKind) {
      return INVALID_KIND;
    }

    await getTrashUseCases().purge[trashKind].execute({ id });
    revalidatePath(TRASH_PATH);
    return { success: true };
  } catch (error) {
    return error instanceof NotFoundError ? GONE : mapActionError(error);
  }
}
