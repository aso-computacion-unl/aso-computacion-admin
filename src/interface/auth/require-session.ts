import { cookies } from "next/headers";
import { cache } from "react";

import { ForbiddenError } from "@/application";
import { roleSatisfies, type Actor, type Role, type SessionKind } from "@/domain/user";
import { isBreakGlassEnabled } from "@/infrastructure/auth/auth-config";
import {
  AUTH_COOKIE_NAME,
  SessionSecretError,
  reportSessionSecretMisconfiguration,
  verifySession,
} from "@/infrastructure/auth/session-jwt";
import { reportError } from "@/infrastructure/observability/report-error";

import { getAuthServices } from "./auth-container";

/**
 * One database check per session per request: a page renders several reads that each ask the guard,
 * and `cache` makes them share the lookup (it is per request, so a revoke is seen by the next one).
 */
const resolveActor = cache((sessionId: string, kind: SessionKind, breakGlassEnabled: boolean) =>
  getAuthServices().validateSession.execute({ sessionId, kind, breakGlassEnabled }),
);

/** Next signals redirects, 404s and "this render needs the request" by throwing; none of those is a session failure. */
function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;

  return typeof digest === "string" && (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_"));
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * Server-side guard for every admin server action and protected page; returns who is acting.
 *
 * The middleware only protects the paths in its matcher and can only check the cookie's signature
 * (it cannot reach the database), but a server action can be POSTed to ANY page that bundles it
 * (including the public `/login`), so each mutation must re-check the session itself, as its first
 * statement and before reading any input. The cookie only names the session: the `Session` row
 * decides whether it is still good (not revoked, not expired, user active) and the role comes from
 * the user's row, so revoking, deactivating or demoting takes effect on the next request.
 *
 * It fails closed: a missing, malformed, expired or wrongly signed cookie, an unknown or revoked
 * session, a misconfigured secret, a database error or any other unexpected error all end in
 * `UnauthorizedError`.
 */
export async function requireSession(): Promise<Actor> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    const result = token ? await verifySession(token) : undefined;

    if (result?.valid) {
      const actor = await resolveActor(result.payload.sid, result.payload.kind, isBreakGlassEnabled());

      if (actor) {
        return actor;
      }
    }
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    if (error instanceof SessionSecretError) {
      reportSessionSecretMisconfiguration();
    } else {
      console.error("The session check failed; access is denied.");
      reportError(error, { action: "session-guard" });
    }
  }

  throw new UnauthorizedError();
}

/** `requireSession` plus a role: an ADMIN also passes an EDITOR requirement, never the reverse. */
export async function requireRole(role: Role): Promise<Actor> {
  const actor = await requireSession();

  if (!roleSatisfies(actor.role, role)) {
    throw new ForbiddenError();
  }

  return actor;
}
