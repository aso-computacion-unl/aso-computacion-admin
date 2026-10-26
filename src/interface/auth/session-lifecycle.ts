import { cookies, headers } from "next/headers";

import type { SessionSubject } from "@/application";
import type { Role } from "@/domain/user";
import { hashClientIp } from "@/infrastructure/auth/ip-hash";
import { clearSessionCookie, setSessionCookie } from "@/infrastructure/auth/session-cookies";
import { AUTH_COOKIE_NAME, SessionSecretError, signSession, verifySession } from "@/infrastructure/auth/session-jwt";
import { clientKeyFromHeaders, UNKNOWN_CLIENT_KEY } from "@/infrastructure/http/client-ip";

import { getAuthServices } from "./auth-container";
import { UnauthorizedError, requireSession } from "./require-session";

/** The session id the browser presented, if its cookie is a well-formed, correctly signed token. */
async function presentedSessionId(): Promise<string | undefined> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    const result = token ? await verifySession(token) : undefined;

    return result?.valid ? result.payload.sid : undefined;
  } catch (error) {
    if (error instanceof SessionSecretError) throw error;

    return undefined;
  }
}

/** A keyed hash of the client address, or null when there is none to hash. */
async function hashedClientIp(): Promise<string | null> {
  const key = clientKeyFromHeaders(await headers());

  return key === UNKNOWN_CLIENT_KEY ? null : hashClientIp(key);
}

/**
 * Logs in: opens a new `Session` row and sets its signed cookie. Rotates, in that the session the
 * browser already presented is revoked, so a login never keeps an old session id alive. Throws
 * `SessionSecretError` when the signing secret is unusable.
 */
export async function openSession(subject: SessionSubject, role: Role): Promise<{ sessionId: string }> {
  const [ipHash, replaces] = await Promise.all([hashedClientIp(), presentedSessionId()]);
  const { sessionId } = await getAuthServices().startSession.execute({
    subject,
    userAgent: (await headers()).get("user-agent"),
    ipHash,
    replaces,
  });

  await setSessionCookie(
    await signSession({ sid: sessionId, kind: subject.kind, uid: subject.kind === "user" ? subject.userId : null, role }),
  );

  return { sessionId };
}

/** Logs out: revokes this browser's session (when it still has a valid one) and clears the cookie. */
export async function closeSession(): Promise<void> {
  try {
    const actor = await requireSession();

    await getAuthServices().revokeSession.execute({ actor, sessionId: actor.sessionId });
  } catch (error) {
    // No valid session means there is nothing to revoke; the cookie is cleared either way.
    if (!(error instanceof UnauthorizedError)) {
      console.error("Could not revoke the session on logout.");
    }
  }

  await clearSessionCookie();
}
