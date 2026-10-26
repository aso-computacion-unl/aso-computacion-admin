import "server-only";

import { getTrashUseCases } from "./trash-container";

/** Everything in the trash, whatever its type, most recently deleted first. */
export function getAdminTrash() {
  return getTrashUseCases().list.execute();
}
