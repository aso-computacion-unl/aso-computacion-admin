import { redirect } from "next/navigation";

import type { ForumActor } from "@/application";

import { forumSignInHref } from "./forum-return-path";
import { ForumUnauthorizedError, requireForumMember } from "./require-forum-member";

/**
 * The guard for forum pages and the reads that feed them (a server action has `requireForumMember`,
 * which throws). A page cannot answer with an error result, so a visitor without a session is sent to
 * the forum landing, which offers the Google login. With `returnTo` (the page's own path) the landing
 * carries it, so signing in brings the student back instead of leaving them at the forum home.
 */
export async function requireForumPageMember(returnTo?: string): Promise<ForumActor> {
  try {
    return await requireForumMember();
  } catch (error) {
    if (error instanceof ForumUnauthorizedError) {
      redirect(forumSignInHref(returnTo));
    }

    throw error;
  }
}
