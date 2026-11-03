import "server-only";

import { getForumServices } from "../../forum/forum-container";
import { requirePageSession } from "../../auth/require-page-session";

/** The forum categories in display order with their visible thread counts. ADMIN only. */
export async function getAdminForumCategories() {
  await requirePageSession("ADMIN");
  return getForumServices().listCategories.execute();
}
