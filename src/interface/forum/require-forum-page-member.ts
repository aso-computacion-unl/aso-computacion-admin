import { redirect } from "next/navigation";

import type { ForumActor } from "@/application";

import { ForumUnauthorizedError, requireForumMember } from "./require-forum-member";

/**
 * The guard for forum pages and the reads that feed them (a server action has `requireForumMember`,
 * which throws). A page cannot answer with an error result, so a visitor without a session is sent to
 * the forum landing, which offers the Google login.
 */
export async function requireForumPageMember(): Promise<ForumActor> {
  try {
    return await requireForumMember();
  } catch (error) {
    if (error instanceof ForumUnauthorizedError) {
      redirect("/foro");
    }

    throw error;
  }
}
