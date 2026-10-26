import "server-only";

import { getTrashUseCases } from "./trash-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Everything in the trash, whatever its type, most recently deleted first. */
export async function getAdminTrash() {
  await requirePageSession();
  return getTrashUseCases().list.execute();
}
