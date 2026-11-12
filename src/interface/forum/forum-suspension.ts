import { cookies } from "next/headers";

import { FORUM_COOKIE_NAME, ForumSecretError, verifyForumSession } from "@/infrastructure/forum/forum-session-jwt";
import { reportError } from "@/infrastructure/observability/report-error";

import { getForumServices } from "./forum-container";
import { isFrameworkSignal } from "./require-forum-member";

/**
 * Whether this request carries the signed forum cookie of a member the moderation suspended, so the landing can say
 * "your account is suspended" instead of the sign-in. It is NOT a guard and nothing may use it as one: it decides
 * only which words /foro shows, never what the request may read or do (that stays `requireForumMember`, which
 * refuses the same cookie). It tells only the holder of the cookie, which only that member's browser got from us
 * and which carries our signature; a missing, forged, expired or foreign cookie, a missing secret and any error
 * all answer false (the plain sign-in), so nothing can be learned about an account from outside.
 */
export async function hasSuspendedForumSession(): Promise<boolean> {
  try {
    const token = (await cookies()).get(FORUM_COOKIE_NAME)?.value;
    const result = token ? await verifyForumSession(token) : undefined;

    return result?.valid ? await getForumServices().checkSuspension.execute({ sessionId: result.payload.sid, memberId: result.payload.memberId }) : false;
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    // No usable secret: the guard already says so, once; here it only means "no notice".
    if (error instanceof ForumSecretError) {
      return false;
    }

    console.error("The forum suspension check failed; the plain sign-in is shown.");
    reportError(error, { action: "forum-suspension-notice" });

    return false;
  }
}
