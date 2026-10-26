import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, cookieSetMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  cookieSetMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { FORUM_SESSION_EXPIRED_MESSAGE } from "@/interface/forum/forum-action-result";
import * as bestAnswer from "@/interface/forum/forum-best-answer";
import * as reactions from "@/interface/forum/forum-helpful";
import { getForumReactions } from "@/interface/forum/forum-reactions-read";
import { makeForumCategory, makeForumMember, makeForumReply, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { signInAs } from "@/tests/support/test-auth";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

const MODULES = { "src/interface/forum/forum-helpful.ts": reactions, "src/interface/forum/forum-best-answer.ts": bestAnswer };

function jar(cookies: Record<string, string | undefined>): void {
  cookiesMock.mockResolvedValue({ get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }), set: cookieSetMock });
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  toggleForumThreadReaction: () => reactions.toggleForumThreadReaction("t1"),
  toggleForumReplyReaction: () => reactions.toggleForumReplyReaction("r1"),
  setForumBestAnswer: () => bestAnswer.setForumBestAnswer("t1", "r1"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "admin-secret-admin-secret-admin-secret-1234");
  vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  testForum.members.members.set("author", makeForumMember({ id: "author", email: "autor@unl.edu.ec", googleSub: "s-author", displayName: "Autor" }));
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion" }));
  testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "member-1" }));
  testForum.store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c1", authorId: "author" }));
  testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "author" }));
  testForum.store.replies.set("other", makeForumReply({ id: "other", threadId: "t2", authorId: "author" }));
});

describe("the reaction and best-answer actions require a forum member", () => {
  it("has a case for every exported action, and each one opens with the member guard", () => {
    expect(Object.keys(ACTION_CALLS).sort()).toEqual(Object.values(MODULES).flatMap((module) => Object.keys(module)).sort());

    for (const [path, module] of Object.entries(MODULES)) {
      const source = readFileSync(path, "utf8");
      const bodies = [...source.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{\s*try \{\s*([^\n]*)\n/g)];

      expect(bodies.map(([, name]) => name).sort()).toEqual(Object.keys(module).sort());
      for (const [, name, first] of bodies) expect(first, `${name} must start with the guard`).toMatch(/^const member = await requireForumMember\(\);$/);
    }
  });

  describe.each(Object.keys(ACTION_CALLS))("%s", (name) => {
    it.each([
      ["no cookie", {}],
      ["only an admin session", { [AUTH_COOKIE_NAME]: "ADMIN" }],
      ["an admin session planted in the forum cookie", { [FORUM_COOKIE_NAME]: "ADMIN" }],
    ])("is refused with %s: session expired, nothing stored", async (_label, cookies) => {
      const resolved = Object.fromEntries(await Promise.all(Object.entries(cookies).map(async ([key, who]) => [key, await signInAs(who as "ADMIN")])));
      jar(resolved);

      expect(await ACTION_CALLS[name]!()).toEqual({ error: FORUM_SESSION_EXPIRED_MESSAGE });
      expect(testForum.store.reactions.size).toBe(0);
      expect(testForum.store.threads.get("t1")?.bestReplyId).toBeNull();
    });
  });
});

describe("«me sirvió»", () => {
  beforeEach(async () => {
    jar({ [FORUM_COOKIE_NAME]: (await signInToForumAs({ id: "member-1", displayName: "Ana" })).cookie });
  });

  it("toggles on a thread and on a reply, answering the new state and the count", async () => {
    expect(await reactions.toggleForumThreadReaction("t1")).toEqual({ success: true, reacted: true, count: 1 });
    expect(await reactions.toggleForumReplyReaction("r1")).toEqual({ success: true, reacted: true, count: 1 });
    expect(await reactions.toggleForumThreadReaction("t1")).toEqual({ success: true, reacted: false, count: 0 });
    expect(testForum.store.reactions.size).toBe(1);
  });

  it("says in Spanish when the post is gone, and stores nothing", async () => {
    testForum.store.threads.set("hidden", makeForumThread({ id: "hidden", categoryId: "c1", hiddenAt: new Date() }));

    expect(await reactions.toggleForumThreadReaction("hidden")).toEqual({ error: "No se encontró la publicación." });
    expect(await reactions.toggleForumReplyReaction("ghost")).toEqual({ error: "No se encontró la publicación." });
    expect(testForum.store.reactions.size).toBe(0);
  });

  it("refuses a member suspended since, on the very next request", async () => {
    testForum.members.members.set("member-1", { ...testForum.members.members.get("member-1")!, status: "SUSPENDED", suspendedAt: new Date() });

    expect(await reactions.toggleForumThreadReaction("t1")).toEqual({ error: FORUM_SESSION_EXPIRED_MESSAGE });
    expect(testForum.store.reactions.size).toBe(0);
  });

  it("feeds the page with counts and what the viewer left, and never an id, a name or an email", async () => {
    await reactions.toggleForumThreadReaction("t1");
    await reactions.toggleForumReplyReaction("r1");

    const summary = await getForumReactions("t1");

    expect(summary).toEqual({ thread: { count: 1, mine: true }, replies: { r1: { count: 1, mine: true } } });
    expect(JSON.stringify(summary)).not.toMatch(/member-1|Ana|@/);
  });

  it("sends a visitor reading the reactions to the forum landing", async () => {
    jar({});

    await expect(getForumReactions("t1")).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/foro");
  });
});

describe("the best answer", () => {
  beforeEach(async () => {
    jar({ [FORUM_COOKIE_NAME]: (await signInToForumAs({ id: "member-1", displayName: "Ana" })).cookie });
  });

  it("lets the thread's author mark a reply and take the mark back", async () => {
    expect(await bestAnswer.setForumBestAnswer("t1", "r1")).toEqual({ success: true, id: "r1" });
    expect(testForum.store.threads.get("t1")?.bestReplyId).toBe("r1");

    expect(await bestAnswer.setForumBestAnswer("t1", null)).toEqual({ success: true });
    expect(testForum.store.threads.get("t1")?.bestReplyId).toBeNull();
  });

  it("says in Spanish why it was refused, and changes nothing", async () => {
    testForum.store.threads.set("locked", makeForumThread({ id: "locked", categoryId: "c1", authorId: "member-1", lockedAt: new Date() }));
    testForum.store.replies.set("in-locked", makeForumReply({ id: "in-locked", threadId: "locked" }));

    expect(await bestAnswer.setForumBestAnswer("t2", "other")).toEqual({ error: "Solo quien abrió el hilo puede elegir la mejor respuesta." });
    expect(await bestAnswer.setForumBestAnswer("t1", "other")).toEqual({ error: "No se encontró la publicación." });
    expect(await bestAnswer.setForumBestAnswer("t1", "ghost")).toEqual({ error: "No se encontró la publicación." });
    expect(await bestAnswer.setForumBestAnswer("locked", "in-locked")).toEqual({ error: "Este hilo está cerrado: no admite respuestas ni cambios." });
    expect(testForum.store.threads.get("t1")?.bestReplyId).toBeNull();
    expect(testForum.store.threads.get("t2")?.bestReplyId).toBeNull();
    expect(testForum.store.threads.get("locked")?.bestReplyId).toBeNull();
  });

  it("refuses a member suspended since", async () => {
    testForum.members.members.set("member-1", { ...testForum.members.members.get("member-1")!, status: "SUSPENDED", suspendedAt: new Date() });

    expect(await bestAnswer.setForumBestAnswer("t1", "r1")).toEqual({ error: FORUM_SESSION_EXPIRED_MESSAGE });
    expect(testForum.store.threads.get("t1")?.bestReplyId).toBeNull();
  });
});
