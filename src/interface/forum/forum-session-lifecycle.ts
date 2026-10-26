import { headers } from "next/headers";

import { NotFoundError } from "@/application";
import { clearForumSessionCookie, readForumSessionCookie, setForumSessionCookie } from "@/infrastructure/forum/forum-cookies";
import { hashForumClientIp } from "@/infrastructure/forum/forum-ip-hash";
import { ForumSecretError, signForumSession, verifyForumSession } from "@/infrastructure/forum/forum-session-jwt";
import { clientKeyFromHeaders, UNKNOWN_CLIENT_KEY } from "@/infrastructure/http/client-ip";
import { reportError } from "@/infrastructure/observability/report-error";

import { getForumServices } from "./forum-container";
import { ForumUnauthorizedError, requireForumMember } from "./require-forum-member";

/** The session id the browser presented, if its cookie is a well-formed, correctly signed token. */
async function presentedSessionId(): Promise<string | undefined> {
  try {
    const token = await readForumSessionCookie();
    const result = token ? await verifyForumSession(token) : undefined;

    return result?.valid ? result.payload.sid : undefined;
  } catch (error) {
    if (error instanceof ForumSecretError) throw error;

    return undefined;
  }
}

async function hashedClientIp(): Promise<string | null> {
  const key = clientKeyFromHeaders(await headers());

  return key === UNKNOWN_CLIENT_KEY ? null : hashForumClientIp(key);
}

/**
 * Logs a member in: opens a new `ForumSession` row and sets its signed cookie. The session the browser
 * already presented is revoked, so a login never keeps an old session id alive. Throws
 * `ForumSecretError` when the signing secret is unusable.
 */
export async function openForumSession(memberId: string): Promise<{ sessionId: string }> {
  const [ipHash, replaces] = await Promise.all([hashedClientIp(), presentedSessionId()]);
  const { sessionId } = await getForumServices().openSession.execute({ memberId, userAgent: (await headers()).get("user-agent"), ipHash, replaces });

  try {
    await setForumSessionCookie(await signForumSession({ sid: sessionId, memberId }));
  } catch (error) {
    // No cookie was issued, so nobody holds this session: revoke it rather than leave a live orphan row.
    await getForumServices().closeSession.execute({ sessionId }).catch((revokeError: unknown) => {
      console.error("Could not revoke the forum session left behind by a failed login.");
      reportError(revokeError, { action: "forum-login-orphan-session" });
    });
    throw error;
  }

  return { sessionId };
}

/** Logs out: revokes this browser's session (when it still has a valid one) and clears the cookie. */
export async function closeForumSession(): Promise<void> {
  try {
    const actor = await requireForumMember();

    await getForumServices().closeSession.execute({ sessionId: actor.sessionId });
  } catch (error) {
    // No valid session (or one already revoked) means nothing to revoke; anything else is a real failure.
    if (!(error instanceof ForumUnauthorizedError || error instanceof NotFoundError)) {
      console.error("Could not revoke the forum session on logout.");
      reportError(error, { action: "forum-logout-revoke" });
    }
  } finally {
    await clearForumSessionCookie();
  }
}
