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
import { FORUM_SESSION_EXPIRED_RESULT } from "@/interface/forum/forum-action-result";
import * as posting from "@/interface/forum/forum-posting";
import { getForumCategories, getForumThread, getForumThreads } from "@/interface/forum/forum-read";
import { makeForumCategory, makeForumReply, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { signInAs } from "@/tests/support/test-auth";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

const POSTING_PATH = "src/interface/forum/forum-posting.ts";

function jar(cookies: Record<string, string | undefined>): void {
  cookiesMock.mockResolvedValue({ get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }), set: cookieSetMock });
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const threadForm = () => form({ title: "¿Cómo empiezo?", body: "Hola\n```js\nlet a;\n```" });
const replyForm = () => form({ body: "Una respuesta" });

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createForumThread: () => posting.createForumThread("programacion", null, threadForm()),
  replyToForumThread: () => posting.replyToForumThread("t1", null, replyForm()),
  editForumThread: () => posting.editForumThread("t1", null, threadForm()),
  editForumReply: () => posting.editForumReply("r1", null, replyForm()),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "admin-secret-admin-secret-admin-secret-1234");
  vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion" }));
  testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "member-1" }));
  testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "member-1" }));
});

describe("the forum actions require a forum member", () => {
  it("has a case for every exported action, and each one opens with the member guard", () => {
    expect(Object.keys(ACTION_CALLS).sort()).toEqual(Object.keys(posting).filter((name) => name !== "signOutOfForum").sort());

    const source = readFileSync(POSTING_PATH, "utf8");
    const bodies = [...source.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{\s*try \{\s*([^\n]*)\n/g)];

    expect(bodies.map(([, name]) => name).sort()).toEqual(Object.keys(ACTION_CALLS).sort());
    for (const [, name, first] of bodies) expect(first, `${name} must start with the guard`).toMatch(/^const member = await requireForumMember\(\);$/);
  });

  describe.each(Object.keys(ACTION_CALLS))("%s", (name) => {
    it.each([
      ["no cookie", {}],
      ["only an admin session", { [AUTH_COOKIE_NAME]: "ADMIN" }],
      ["an admin session planted in the forum cookie", { [FORUM_COOKIE_NAME]: "ADMIN" }],
    ])("is refused with %s: session expired, nothing written", async (_label, cookies) => {
      const resolved = Object.fromEntries(await Promise.all(Object.entries(cookies).map(async ([key, who]) => [key, await signInAs(who as "ADMIN")])));
      jar(resolved);
      const before = [testForum.store.threads.size, testForum.store.replies.size];

      expect(await ACTION_CALLS[name]!()).toEqual(FORUM_SESSION_EXPIRED_RESULT);
      expect([testForum.store.threads.size, testForum.store.replies.size]).toEqual(before);
    });
  });

  it("signOutOfForum works without a session and only clears the cookie", async () => {
    jar({});

    expect(await posting.signOutOfForum()).toEqual({ success: true });
    expect(cookieSetMock).toHaveBeenCalledWith(FORUM_COOKIE_NAME, "", expect.objectContaining({ path: "/", maxAge: 0 }));
  });
});

describe("posting", () => {
  let memberId: string;

  beforeEach(async () => {
    const session = await signInToForumAs({ id: "member-1", displayName: "Ana" });
    memberId = session.memberId;
    jar({ [FORUM_COOKIE_NAME]: session.cookie });
  });

  it("creates a thread as the signed-in member and answers with its id", async () => {
    const result = await posting.createForumThread("programacion", null, threadForm());

    expect(result).toEqual({ success: true, id: expect.any(String) });
    expect(testForum.store.threads.get(result.id!)).toMatchObject({ authorId: memberId, categoryId: "c1", title: "¿Cómo empiezo?" });
  });

  it("replies, and edits its own thread and reply", async () => {
    const reply = await posting.replyToForumThread("t1", null, replyForm());
    const thread = await posting.editForumThread("t1", null, form({ title: "Nuevo", body: "Editado" }));
    const edited = await posting.editForumReply("r1", null, form({ body: "Reply editada" }));

    expect(reply.success).toBe(true);
    expect(thread).toEqual({ success: true, id: "t1" });
    expect(edited).toEqual({ success: true, id: "r1" });
    expect(testForum.store.threads.get("t1")).toMatchObject({ title: "Nuevo", body: "Editado" });
    expect(testForum.store.replies.get("r1")?.body).toBe("Reply editada");
  });

  it("says in Spanish why a post was refused", async () => {
    testForum.store.threads.set("locked", makeForumThread({ id: "locked", categoryId: "c1", lockedAt: new Date() }));
    testForum.store.threads.set("theirs", makeForumThread({ id: "theirs", categoryId: "c1", authorId: "someone-else" }));

    expect(await posting.replyToForumThread("locked", null, replyForm())).toEqual({ error: "Este hilo está cerrado: no admite respuestas ni cambios." });
    expect(await posting.editForumThread("theirs", null, threadForm())).toEqual({ error: "Solo puede editar sus propias publicaciones." });
    expect(await posting.replyToForumThread("ghost", null, replyForm())).toEqual({ error: "No se encontró la publicación." });
    expect(await posting.createForumThread("nope", null, threadForm())).toEqual({ error: "No se encontró la publicación." });
    expect(await posting.createForumThread("programacion", null, form({ title: " ", body: "x" }))).toEqual({
      fieldErrors: { title: "El título es obligatorio y admite hasta 120 caracteres." },
    });
    expect(await posting.replyToForumThread("t1", null, form({ body: "x".repeat(5001) }))).toMatchObject({ fieldErrors: { body: expect.any(String) } });
  });

  it("rejects fields the form does not declare", async () => {
    expect(await posting.replyToForumThread("t1", null, form({ body: "ok", authorId: "other" }))).toEqual({ fieldErrors: { form: "El formulario incluye campos no admitidos." } });
    expect(testForum.store.replies.size).toBe(1);
  });

  it("throttles a member posting too fast, naming the per-minute limit and the wait in minutes", async () => {
    for (let index = 0; index < 3; index++) {
      expect((await posting.replyToForumThread("t1", null, replyForm())).success).toBe(true);
    }

    expect(await posting.replyToForumThread("t1", null, replyForm())).toEqual({
      error: "Está publicando muy rápido: el límite es de 3 publicaciones por minuto. Puede volver a intentarlo en 1 minuto.",
    });
  });

  it("names the per-hour limit when that one tripped, with the wait in minutes", async () => {
    for (let index = 0; index < 30; index++) {
      testForum.store.replies.set(`old-${index}`, makeForumReply({ id: `old-${index}`, threadId: "t1", authorId: memberId, createdAt: new Date(Date.now() - 10 * 60_000) }));
    }

    // The oldest of those posts is 10 minutes old: 50 minutes are left of the hour, not the whole hour (D3).
    expect(await posting.replyToForumThread("t1", null, replyForm())).toEqual({
      error: "Está publicando muy rápido: el límite es de 30 publicaciones por hora. Puede volver a intentarlo en 50 minutos.",
    });
  });

  it("refuses a suspended member on the very next request, and every action says the account cannot take part", async () => {
    testForum.members.members.set(memberId, { ...testForum.members.members.get(memberId)!, status: "SUSPENDED", suspendedAt: new Date() });

    for (const call of Object.values(ACTION_CALLS)) {
      expect(await call()).toEqual(FORUM_SESSION_EXPIRED_RESULT);
    }
    expect(testForum.store.replies.size).toBe(1);
  });

  it("never puts an email or a member id in a result", async () => {
    const results = [await posting.createForumThread("programacion", null, threadForm()), await posting.replyToForumThread("t1", null, replyForm())];

    expect(JSON.stringify(results)).not.toMatch(/unl\.edu\.ec|member-1|sub-ana/);
  });
});

describe("forum reads", () => {
  beforeEach(() => {
    testForum.store.threads.set("hidden", makeForumThread({ id: "hidden", categoryId: "c1", hiddenAt: new Date() }));
  });

  it("send a visitor without a forum session to the landing, an admin session included", async () => {
    for (const cookies of [{}, { [AUTH_COOKIE_NAME]: await signInAs("ADMIN") }]) {
      jar(cookies);

      await expect(getForumCategories()).rejects.toThrow("REDIRECT");
      await expect(getForumThreads("programacion", 1)).rejects.toThrow("REDIRECT");
      await expect(getForumThread("t1")).rejects.toThrow("REDIRECT");
    }

    expect(redirectMock).toHaveBeenCalledWith("/foro");
  });

  it("carry the page a visitor asked for, so signing in brings them back to it", async () => {
    jar({});

    await expect(getForumCategories("/foro/c/programacion/nuevo")).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenLastCalledWith("/foro?next=%2Fforo%2Fc%2Fprogramacion%2Fnuevo");

    await expect(getForumThreads("programacion", 2, "/foro/c/programacion?pagina=2")).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenLastCalledWith("/foro?next=%2Fforo%2Fc%2Fprogramacion%3Fpagina%3D2");
  });

  it("show a member the categories, a page of threads and a thread, marking their own and hiding the hidden", async () => {
    const { cookie } = await signInToForumAs({ id: "member-1", displayName: "Ana" });
    jar({ [FORUM_COOKIE_NAME]: cookie });

    const categories = await getForumCategories();
    const page = await getForumThreads("programacion", 1);
    const view = await getForumThread("t1");

    expect(categories.map((category) => [category.slug, category.threadCount])).toEqual([["programacion", 1]]);
    expect(page.items.map((item) => [item.id, item.mine, item.authorName])).toEqual([["t1", true, "Ana"]]);
    expect(view.replies.map((reply) => [reply.id, "mine" in reply && reply.mine])).toEqual([["r1", true]]);
    await expect(getForumThread("hidden")).rejects.toThrow("not found");
    expect(JSON.stringify({ categories, page, view })).not.toMatch(/unl\.edu\.ec|"authorId"|googleSub|"email"/);
  });
});
