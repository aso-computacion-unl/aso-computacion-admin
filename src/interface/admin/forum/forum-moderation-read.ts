import "server-only";

import type { ForumReportQueue } from "@/application/ports/forum-moderation.ports";

import { getForumServices } from "../../forum/forum-container";
import { requirePageSession } from "../../auth/require-page-session";

/** A page of the report queue: the open reports oldest first, or the closed ones. ADMIN and EDITOR. */
export async function getAdminForumReports(input: { status: ForumReportQueue; page: number }) {
  await requirePageSession();
  return getForumServices().listReports.execute(input);
}
