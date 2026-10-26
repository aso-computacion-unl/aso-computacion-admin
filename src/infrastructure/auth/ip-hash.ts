import "server-only";
import { createHmac } from "node:crypto";

import { getSessionSecret } from "./session-jwt";

/**
 * What a session stores instead of the address: a keyed hash, so two sessions from the same network
 * can be told apart in "Sesiones activas" but the address cannot be recovered from the database.
 * Rotating ADMIN_SECRET changes every hash, which only costs that comparison.
 */
export function hashClientIp(ip: string): string {
  return createHmac("sha256", getSessionSecret()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}
