import "server-only";

import { NotFoundError, type ListCriteria } from "@/application";

import { getNewsUseCases } from "./news-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every news item, drafts included unless the criteria narrows it, newest publication date first. */
export async function getAdminNewsItems(criteria?: ListCriteria) {
  await requirePageSession();
  return getNewsUseCases().list.execute(criteria);
}

/** Published and draft totals, whatever the list is filtered by. */
export async function getAdminNewsCounts() {
  await requirePageSession();
  return getNewsUseCases().count.execute();
}

/** One news item, or null when it does not exist. */
export async function getAdminNewsItem(id: string) {
  await requirePageSession();
  try {
    return await getNewsUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
