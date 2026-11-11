import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FORUM_COOKIE_NAME, FORUM_COOKIE_PATH, LEGACY_FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";

/** The audit runs against a live server, so it is checked by its source: the forum screens need the session cookie the app reads. */
describe("the UI audit's forum session", () => {
  it("S2: plants the current forum cookie on the whole site, not the legacy one on /foro", () => {
    const source = readFileSync("scripts/ui-audit/run.ts", "utf8");
    const planted = [...source.matchAll(/addCookies\(\[\{ name: ([^,]+), value: forum\.token, domain: "localhost", path: ([^,]+),/g)];

    expect(planted).toHaveLength(1);
    expect(planted[0]![1]).toBe("FORUM_COOKIE_NAME");
    expect(planted[0]![2]).toBe("FORUM_COOKIE_PATH");
    expect(source).toContain('const FORUM_COOKIE_NAME = "forum_sid";');
    expect(source).toContain('const FORUM_COOKIE_PATH = "/";');
    expect(FORUM_COOKIE_NAME).toBe("forum_sid");
    expect(FORUM_COOKIE_PATH).toBe("/");
    expect(source).not.toContain(`"${LEGACY_FORUM_COOKIE_NAME}"`);
  });
});
