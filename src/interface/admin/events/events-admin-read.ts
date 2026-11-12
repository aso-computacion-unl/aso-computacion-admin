import "server-only";

import { NotFoundError, type ListCriteria } from "@/application";

import { PAGE_SIZE } from "../list-params";
import { getEventUseCases } from "./events-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every event, drafts included unless the criteria narrows it, with its active photo count. */
export async function getAdminEvents(criteria?: ListCriteria) {
  await requirePageSession();
  return getEventUseCases().list.execute(criteria);
}

/** One page of the admin list, narrowed by status and search; `page` is clamped to the last page that exists. */
export async function getAdminEventsPage(criteria: ListCriteria, page: number) {
  await requirePageSession();
  return getEventUseCases().list.executePage(criteria, { page, pageSize: PAGE_SIZE });
}

/** Published and draft totals, whatever the list is filtered by. */
export async function getAdminEventCounts() {
  await requirePageSession();
  return getEventUseCases().count.execute();
}

/**
 * One event with its active photos and the people registered and confirmed in it, or null when it does not exist. The
 * count is what the edit form's warning compares a mode or seats change against (D14): a pending registration holds no
 * seat and is not counted.
 */
export async function getAdminEvent(id: string) {
  await requirePageSession();
  try {
    const useCases = getEventUseCases();
    const event = await useCases.get.execute({ id });

    return { ...event, registeredCount: await useCases.registeredCount(id) };
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
