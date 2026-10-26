import { headers } from "next/headers";

import { clearForumSessionCookie, readForumSessionCookie, setForumSessionCookie } from "@/infrastructure/forum/forum-cookies";
import { hashForumClientIp } from "@/infrastructure/forum/forum-ip-hash";
import { ForumSecretError, signForumSession, verifyForumSession } from "@/infrastructure/forum/forum-session-jwt";
import { clientKeyFromHeaders, UNKNOWN_CLIENT_KEY } from "@/infrastructure/http/client-ip";
import { reportError } from "@/infrastructure/observability/report-error";

import { getForumServices } from "./forum-container";

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

/**
 * Logs out: revokes the session this browser presented and clears the cookie. The signed cookie names the
 * session, so it is revoked even when the guard would refuse it (a member suspended since, say): the row
 * is never left live behind a cleared cookie.
 */
export async function closeForumSession(): Promise<void> {
  try {
    const sessionId = await presentedSessionId();

    if (sessionId) {
      await getForumServices().closeSession.execute({ sessionId });
    }
  } catch (error) {
    // Without a usable secret no cookie can be verified, so there is nothing to revoke; anything else is a real failure.
    if (!(error instanceof ForumSecretError)) {
      console.error("Could not revoke the forum session on logout.");
      reportError(error, { action: "forum-logout-revoke" });
    }
  } finally {
    await clearForumSessionCookie();
  }
}
