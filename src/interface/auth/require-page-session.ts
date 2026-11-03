import { redirect } from "next/navigation";

import { ForbiddenError } from "@/application";
import type { Actor, Role } from "@/domain/user";

import { UnauthorizedError, requireRole } from "./require-session";

/** Where an editor lands when they open an admin-only page; the home page says why. */
export const RESTRICTED_REDIRECT = "/admin?acceso=restringido";

/**
 * The guard for pages and for the reads that feed them (a server action has `requireSession` /
 * `requireRole`, which throw). A page cannot answer with an error result, so it sends the visitor
 * away: to the login without a valid session, to the admin home when the role is not enough.
 */
export async function requirePageSession(role: Role = "EDITOR"): Promise<Actor> {
  try {
    return await requireRole(role);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }

    if (error instanceof ForbiddenError) {
      redirect(RESTRICTED_REDIRECT);
    }

    throw error;
  }
}
