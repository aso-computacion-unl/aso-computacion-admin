import { requireSession } from "./require-session";

/**
 * Transitional name of the guard the content actions still call; they move to `requireSession` /
 * `requireRole` one module at a time and this file goes away with the last one.
 */
export async function requireAdminSession(): Promise<void> {
  await requireSession();
}
