import "server-only";
import { createHmac } from "node:crypto";

import { getForumSecret } from "./forum-session-jwt";

/** What a forum session stores instead of the address: a keyed hash (with the forum's own secret), never the address. */
export function hashForumClientIp(ip: string): string {
  return createHmac("sha256", getForumSecret()).update(`forum-ip:${ip}`).digest("hex").slice(0, 32);
}
