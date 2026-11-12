import "server-only";

import type { ForumMemberFilter } from "@/application/forum/forum-members.use-cases";
import type { ForumReportQueue } from "@/application/ports/forum-moderation.ports";

import { getForumServices } from "../../forum/forum-container";
import { requirePageSession } from "../../auth/require-page-session";

/** A page of the report queue: the open reports oldest first, or the closed ones. ADMIN and EDITOR. */
export async function getAdminForumReports(input: { status: ForumReportQueue; page: number }) {
  await requirePageSession();
  return getForumServices().listReports.execute(input);
}

/** A page of the forum members for moderators: all of them or only the suspended, optionally matching a text. ADMIN and EDITOR. */
export async function getAdminForumMembers(input: { filter: ForumMemberFilter; search: string; page: number }) {
  await requirePageSession();
  return getForumServices().listMembers.execute(input);
}
