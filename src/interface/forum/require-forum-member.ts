import { cookies } from "next/headers";
import { cache } from "react";

import type { ForumActor } from "@/application";
import { FORUM_COOKIE_NAME, ForumSecretError, verifyForumSession } from "@/infrastructure/forum/forum-session-jwt";
import { reportError } from "@/infrastructure/observability/report-error";

import { getForumServices } from "./forum-container";

/** One database check per session per request: a page renders several reads that each ask the guard. */
const resolveActor = cache((sessionId: string, memberId: string) => getForumServices().validateSession.execute({ sessionId, memberId }));

/** Next signals redirects, 404s and "this render needs the request" by throwing; none of those is a session failure. */
function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;

  return typeof digest === "string" && (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_"));
}

let reportedMisconfiguration = false;

export class ForumUnauthorizedError extends Error {
  constructor() {
    super("Forum sign-in required");
    this.name = "ForumUnauthorizedError";
  }
}

/**
 * Server-side guard for every forum server action and member-only page; returns who is acting.
 *
 * It reads only the `forum_session` cookie: an `admin_session` is not a forum member, however valid, and
 * a forum cookie never reaches (or passes) the admin guard. The cookie only names the session; the
 * `ForumSession` row and the member's status decide whether it is still good, so a revoke or a
 * suspension takes effect on the next request. It fails closed: a missing, malformed, expired or wrongly
 * signed cookie, an unknown or revoked session, a suspended member, a missing forum secret, a database
 * error or any other unexpected error all end in `ForumUnauthorizedError`.
 */
export async function requireForumMember(): Promise<ForumActor> {
  try {
    const token = (await cookies()).get(FORUM_COOKIE_NAME)?.value;
    const result = token ? await verifyForumSession(token) : undefined;

    if (result?.valid) {
      const actor = await resolveActor(result.payload.sid, result.payload.memberId);

      if (actor) {
        return actor;
      }
    }
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    if (error instanceof ForumSecretError) {
      if (!reportedMisconfiguration) {
        reportedMisconfiguration = true;
        console.error("FORUM_SESSION_SECRET is invalid; the forum sign-in is unavailable.");
      }
    } else {
      console.error("The forum session check failed; access is denied.");
      reportError(error, { action: "forum-session-guard" });
    }
  }

  throw new ForumUnauthorizedError();
}

/** The signed-in member, or null: for pages that offer the login instead of failing. */
export async function getForumMember(): Promise<ForumActor | null> {
  try {
    return await requireForumMember();
  } catch (error) {
    if (error instanceof ForumUnauthorizedError) {
      return null;
    }

    throw error;
  }
}
