import "server-only";

import { NotFoundError, type ListCriteria } from "@/application";

import { getEventUseCases } from "./events-container";

/** Admin list: every event, drafts included unless the criteria narrows it, with its active photo count. */
export function getAdminEvents(criteria?: ListCriteria) {
  return getEventUseCases().list.execute(criteria);
}

/** Published and draft totals, whatever the list is filtered by. */
export function getAdminEventCounts() {
  return getEventUseCases().count.execute();
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
