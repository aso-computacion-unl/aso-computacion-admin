import "server-only";

import { getForumServices } from "../../forum/forum-container";
import { requirePageSession } from "../../auth/require-page-session";

/** The forum categories in display order with their visible thread counts. ADMIN only. */
export async function getAdminForumCategories() {
  await requirePageSession("ADMIN");
  return getForumServices().listCategories.execute();
}

/** One category with its thread count, or null when it does not exist. ADMIN only. */
export async function getAdminForumCategory(id: string) {
  await requirePageSession("ADMIN");
  return (await getForumServices().listCategories.execute()).find((category) => category.id === id) ?? null;
}
