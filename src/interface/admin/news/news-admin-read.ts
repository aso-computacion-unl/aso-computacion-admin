import "server-only";

import { NotFoundError, type ListCriteria } from "@/application";

import { getNewsUseCases } from "./news-container";

/** Admin list: every news item, drafts included unless the criteria narrows it, newest publication date first. */
export function getAdminNewsItems(criteria?: ListCriteria) {
  return getNewsUseCases().list.execute(criteria);
}

/** Published and draft totals, whatever the list is filtered by. */
export function getAdminNewsCounts() {
  return getNewsUseCases().count.execute();
}

/** One news item, or null when it does not exist. */
export async function getAdminNewsItem(id: string) {
  try {
    return await getNewsUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
