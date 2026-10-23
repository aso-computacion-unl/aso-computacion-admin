import "server-only";

import { NotFoundError } from "@/application";

import { getEventUseCases } from "./events-container";

/** Admin list: every event, drafts included, with its active photo count. */
export function getAdminEvents() {
  return getEventUseCases().list.execute();
}

/** One event with its active photos, or null when it does not exist. */
export async function getAdminEvent(id: string) {
  try {
    return await getEventUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
