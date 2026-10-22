import { cookies } from "next/headers";

import {
  AUTH_COOKIE_NAME,
  SessionSecretError,
  reportSessionSecretMisconfiguration,
  verifySession,
} from "@/infrastructure/auth/session-jwt";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * Server-side guard for every admin server action.
 *
 * The middleware only protects the paths in its matcher, but a server action
 * can be POSTed to ANY page that bundles it (including the public `/login`),
 * so each mutation must re-check the session cookie itself, as its first
 * statement and before reading any input. It fails closed: a missing,
 * malformed, expired or wrongly signed cookie, a misconfigured secret, or any
 * unexpected error all end in `UnauthorizedError`.
 */
export async function requireAdminSession(): Promise<void> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

    if (token && (await verifySession(token)).valid) {
      return;
    }
  } catch (error) {
    if (error instanceof SessionSecretError) {
      reportSessionSecretMisconfiguration();
    }
  }

  throw new UnauthorizedError();
}
