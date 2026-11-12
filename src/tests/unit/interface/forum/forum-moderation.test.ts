import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, cookieSetMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), cookieSetMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { FORUM_SESSION_EXPIRED_RESULT } from "@/interface/forum/forum-action-result";
import * as moderation from "@/interface/forum/forum-moderation";
import { makeForumCategory, makeForumMember, makeForumReply, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { signInAs } from "@/tests/support/test-auth";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

const MODERATION_PATH = "src/interface/forum/forum-moderation.ts";

function jar(cookies: Record<string, string | undefined>): void {
  cookiesMock.mockResolvedValue({ get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }), set: cookieSetMock });
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const reasonForm = () => form({ reason: "Es spam" });

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  reportForumThread: () => moderation.reportForumThread("t1", null, reasonForm()),
  reportForumReply: () => moderation.reportForumReply("r1", null, reasonForm()),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "admin-secret-admin-secret-admin-secret-1234");
  vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  testForum.members.members.set("author", makeForumMember({ id: "author", email: "autor@unl.edu.ec", googleSub: "s-author", displayName: "Autor" }));
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion" }));
  testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "author" }));
  testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "author" }));
});

describe("the forum report actions require a forum member", () => {
  it("has a case for every exported action, and each one opens with the member guard", () => {
    expect(Object.keys(ACTION_CALLS).sort()).toEqual(Object.keys(moderation).sort());

    const source = readFileSync(MODERATION_PATH, "utf8");
    const bodies = [...source.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{\s*try \{\s*([^\n]*)\n/g)];

    expect(bodies.map(([, name]) => name).sort()).toEqual(Object.keys(ACTION_CALLS).sort());
    for (const [, name, first] of bodies) expect(first, `${name} must start with the guard`).toMatch(/^const member = await requireForumMember\(\);$/);
  });

  describe.each(Object.keys(ACTION_CALLS))("%s", (name) => {
    it.each([
      ["no cookie", {}],
      ["only an admin session", { [AUTH_COOKIE_NAME]: "ADMIN" }],
      ["an admin session planted in the forum cookie", { [FORUM_COOKIE_NAME]: "ADMIN" }],
    ])("is refused with %s: session expired, nothing stored", async (_label, cookies) => {
      const resolved = Object.fromEntries(await Promise.all(Object.entries(cookies).map(async ([key, who]) => [key, await signInAs(who as "ADMIN")])));
      jar(resolved);

      expect(await ACTION_CALLS[name]!()).toEqual(FORUM_SESSION_EXPIRED_RESULT);
      expect(testForum.store.reports.size).toBe(0);
    });
  });
});

describe("reporting a post", () => {
  let memberId: string;

  beforeEach(async () => {
    const session = await signInToForumAs({ id: "member-1", displayName: "Ana" });
    memberId = session.memberId;
    jar({ [FORUM_COOKIE_NAME]: session.cookie });
  });

  it("opens a report on a thread and on a reply as the signed-in member", async () => {
    expect(await moderation.reportForumThread("t1", null, form({ reason: "  Es spam  " }))).toEqual({ success: true });
    expect(await moderation.reportForumReply("r1", null, reasonForm())).toEqual({ success: true });

    expect([...testForum.store.reports.values()]).toMatchObject([
      { reporterId: memberId, threadId: "t1", replyId: null, reason: "Es spam", status: "OPEN" },
      { reporterId: memberId, threadId: null, replyId: "r1", status: "OPEN" },
    ]);
  });

  it("says in Spanish that the post was already reported, and keeps one open report", async () => {
    await moderation.reportForumThread("t1", null, reasonForm());

    expect(await moderation.reportForumThread("t1", null, reasonForm())).toEqual({ error: "Ya reportó esta publicación. El equipo la revisará.", alreadyReported: true });
    expect(testForum.store.reports.size).toBe(1);
  });

  it("says in Spanish what is wrong, and stores nothing", async () => {
    testForum.store.threads.set("hidden", makeForumThread({ id: "hidden", categoryId: "c1", hiddenAt: new Date() }));

    expect(await moderation.reportForumThread("t1", null, form({ reason: " " }))).toEqual({ fieldErrors: { reason: "Cuéntenos el motivo en hasta 500 caracteres." } });
    expect(await moderation.reportForumThread("t1", null, form({ reason: "x".repeat(501) }))).toMatchObject({ fieldErrors: { reason: expect.any(String) } });
    expect(await moderation.reportForumThread("t1", null, form({ reason: "Spam", extra: "x" }))).toEqual({ fieldErrors: { form: "El formulario incluye campos no admitidos." } });
    expect(await moderation.reportForumThread("hidden", null, reasonForm())).toEqual({ error: "No se encontró la publicación." });
    expect(await moderation.reportForumReply("ghost", null, reasonForm())).toEqual({ error: "No se encontró la publicación." });
    expect(testForum.store.reports.size).toBe(0);
  });

  it("refuses a member suspended since, on the very next request", async () => {
    testForum.members.members.set(memberId, { ...testForum.members.members.get(memberId)!, status: "SUSPENDED", suspendedAt: new Date() });

    for (const call of Object.values(ACTION_CALLS)) {
      expect(await call()).toEqual(FORUM_SESSION_EXPIRED_RESULT);
    }
    expect(testForum.store.reports.size).toBe(0);
  });

  it("never puts an email or a member id in a result", async () => {
    const results = [await moderation.reportForumThread("t1", null, reasonForm()), await moderation.reportForumThread("t1", null, reasonForm())];

    expect(JSON.stringify(results)).not.toMatch(/unl\.edu\.ec|member-1|author/);
  });
});
