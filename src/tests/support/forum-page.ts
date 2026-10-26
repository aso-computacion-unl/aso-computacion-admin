import { vi } from "vitest";

import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { signInToForumAs } from "@/tests/support/test-forum";

/** What `cookies()` from next/headers returns for a request carrying these cookies. */
export function cookieJar(cookies: Record<string, string | undefined>) {
  return {
    get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

/** The environment the forum session token needs; call from `beforeEach`. */
export function stubForumSecrets(): void {
  vi.stubEnv("ADMIN_SECRET", "admin-secret-admin-secret-admin-secret-1234");
  vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
}

/** Registers a member, opens a session for them and returns the cookie jar of their browser. */
export async function forumMemberJar(overrides: Parameters<typeof signInToForumAs>[0] = {}) {
  const { cookie, memberId } = await signInToForumAs(overrides);

  return { jar: cookieJar({ [FORUM_COOKIE_NAME]: cookie }), memberId };
}
