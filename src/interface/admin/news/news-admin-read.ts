import "server-only";

import { NotFoundError } from "@/application";

import { getNewsUseCases } from "./news-container";

/** Admin list: every news item, drafts included, newest publication date first. */
export function getAdminNewsItems() {
  return getNewsUseCases().list.execute();
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
