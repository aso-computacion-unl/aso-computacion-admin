import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock, notFoundMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock, useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));

import ThreadPage, { generateMetadata } from "../../../../app/foro/hilo/[id]/page";
import { makeForumCategory, makeForumMember, makeForumReply, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { testForum } from "@/tests/support/test-forum";

const NOW = new Date();
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

const render = (id: string) => ThreadPage({ params: Promise.resolve({ id }) }).then((element) => renderToStaticMarkup(element));

let viewerId = "";

function seedThread(overrides: Parameters<typeof makeForumThread>[0] = {}) {
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación" }));
  testForum.members.members.set("m2", makeForumMember({ id: "m2", email: "mateo@unl.edu.ec", googleSub: "sub-2", displayName: "Mateo R." }));
  testForum.store.threads.set(
    "t1",
    makeForumThread({ id: "t1", categoryId: "c1", authorId: "m2", title: "Segmentation fault al liberar memoria", body: "Mi programa revienta **al final**.", createdAt: minutesAgo(120), ...overrides }),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  stubForumSecrets();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const viewer = await forumMemberJar({ displayName: "Daniela P." });
  viewerId = viewer.memberId;
  cookiesMock.mockResolvedValue(viewer.jar);
});

describe("a thread page", () => {
  it("is for members: a visitor goes to the sign-in at /foro, which brings them back to this thread", async () => {
    seedThread();
    cookiesMock.mockResolvedValue(cookieJar({}));

    await expect(render("t1")).rejects.toThrow("REDIRECT /foro?next=%2Fforo%2Fhilo%2Ft1");
  });

  it("sends a member suspended since they signed in to the sign-in, where the suspension is explained", async () => {
    seedThread();
    testForum.members.members.set(viewerId, makeForumMember({ id: viewerId, email: "dani@unl.edu.ec", googleSub: "sub-dani", displayName: "Daniela P.", status: "SUSPENDED", suspendedAt: new Date() }));

    await expect(render("t1")).rejects.toThrow("REDIRECT /foro?next=%2Fforo%2Fhilo%2Ft1");
  });

  it.each([
    ["an unknown thread", () => undefined, "nope"],
    [
      "a thread the moderation hid",
      () => seedThread({ hiddenAt: new Date() }),
      "t1",
    ],
  ])("is a 404 for %s", async (_label, setup, id) => {
    setup();

    await expect(render(id)).rejects.toThrow("NOT_FOUND");
  });

  it("titles the page with the thread and shows the title, the author, the category crumb and the opening post", async () => {
    seedThread();

    const html = await render("t1");

    expect(await generateMetadata({ params: Promise.resolve({ id: "t1" }) })).toEqual({ title: "Segmentation fault al liberar memoria" });
    expect(html).toContain("<h1");
    expect(html).toContain("Segmentation fault al liberar memoria");
    expect(html).toContain("Mateo R.");
    expect(html).toContain("abrió este hilo");
    expect(html).toContain("Inició el hilo");
    expect(html).toContain("<strong>al final</strong>");
    expect(html).toMatch(/href="\/foro\/c\/programacion"[^>]*>.*Programación/);
    expect(html).toContain("0 respuestas");
  });

  it("shows the replies oldest first, with the count", async () => {
    seedThread();
    testForum.store.replies.set("r2", makeForumReply({ id: "r2", threadId: "t1", authorId: "m2", body: "Segunda", createdAt: minutesAgo(30) }));
    testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", body: "Primera", createdAt: minutesAgo(60) }));
    testForum.store.replies.set("r3", makeForumReply({ id: "r3", threadId: "t1", authorId: "m2", body: "Oculta", createdAt: minutesAgo(10), hiddenAt: new Date() }));

    const html = await render("t1");

    expect(html.indexOf("Primera")).toBeGreaterThan(-1);
    expect(html.indexOf("Primera")).toBeLessThan(html.indexOf("Segunda"));
    expect(html).not.toContain("Oculta");
    expect(html).toContain("2 respuestas");
    expect(html).toContain('id="respuesta-r1"');
  });

  it("marks the thread as solved and highlights its best answer, anchored for the badge", async () => {
    seedThread({ bestReplyId: "r1" });
    testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", body: "Guarde el siguiente antes de liberar" }));

    const html = await render("t1");

    expect(html).toContain('href="#mejor"');
    expect(html).toContain("Resuelto");
    expect(html).toContain('id="mejor"');
    expect(html).toContain("Mejor respuesta");
  });

  it("labels an open thread Abierto, in words, and a solved one only Resuelto", async () => {
    seedThread();

    expect(await render("t1")).toMatch(/<span[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Abierto<\/span>/);

    seedThread({ bestReplyId: "r1" });
    testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", body: "Guarde el siguiente antes de liberar" }));

    expect(await render("t1")).not.toMatch(/>Abierto</);
  });

  it("does not claim a solution for a thread without a best answer", async () => {
    seedThread();

    const html = await render("t1");

    expect(html).not.toContain("Resuelto");
    expect(html).not.toContain("Mejor respuesta");
  });

  it("ends an open thread with the reply form for this thread", async () => {
    seedThread();

    const html = await render("t1");

    expect(html).toContain("Su respuesta");
    expect(html).toContain("Responder");
    expect(html).not.toContain("Hilo cerrado");
  });

  it("says a locked thread is closed and offers no way to reply there", async () => {
    seedThread({ lockedAt: new Date() });

    const html = await render("t1");

    expect(html).not.toContain("Su respuesta");
    expect(html).toContain("Cerrado");
    expect(html).toContain("Hilo cerrado por la moderación");
    expect(html).toContain("ya no admite respuestas nuevas");
  });

  it("marks the viewer's own posts and shows when a post was edited", async () => {
    seedThread({ authorId: viewerId, editedAt: minutesAgo(5) });

    const html = await render("t1");

    expect(html).toContain("(usted)");
    expect(html).toContain("editado");
  });

  describe("the controls under each post", () => {
    const reply = (id: string, authorId: string, createdAt = minutesAgo(60)) => testForum.store.replies.set(id, makeForumReply({ id, threadId: "t1", authorId, body: `Cuerpo ${id}`, createdAt }));
    const count = (html: string, text: string) => html.split(text).length - 1;

    it("offers «Reportar» on other people's posts and not on the viewer's own", async () => {
      seedThread();
      reply("r1", "m2");
      reply("r2", viewerId, minutesAgo(30));

      const html = await render("t1");

      // The opening post and the reply of m2 are not the viewer's; the viewer's own reply is.
      expect(count(html, ">Reportar<")).toBe(2);
    });

    it("shows «Me sirvió» with its count on every reply, pressed when the viewer left one", async () => {
      seedThread();
      reply("r1", "m2");
      reply("r2", "m2", minutesAgo(30));
      testForum.store.reactions.set("x1", { memberId: "m2", threadId: null, replyId: "r1" });
      testForum.store.reactions.set("x2", { memberId: viewerId, threadId: null, replyId: "r1" });

      const html = await render("t1");

      expect(count(html, "Me sirvió")).toBe(2);
      const buttons = html.split("<button").filter((part) => part.includes("Me sirvió"));

      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toContain('aria-pressed="true"');
      expect(buttons[0]).toContain(">2</span>");
      expect(buttons[1]).toContain('aria-pressed="false"');
      expect(buttons[1]).toContain(">0</span>");
    });

    it("lets only the thread's author mark a reply as the best answer", async () => {
      seedThread({ authorId: viewerId });
      reply("r1", "m2");

      expect(await render("t1")).toContain("Marcar como mejor respuesta");

      testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m2", createdAt: minutesAgo(120) }));

      expect(await render("t1")).not.toContain("Marcar como mejor respuesta");
    });

    it("offers to take the mark back on the best answer, and to mark the others", async () => {
      seedThread({ authorId: viewerId, bestReplyId: "r1" });
      reply("r1", "m2");
      reply("r2", "m2", minutesAgo(30));

      const html = await render("t1");

      expect(count(html, "Quitar de mejor respuesta")).toBe(1);
      expect(count(html, "Marcar como mejor respuesta")).toBe(1);
    });

    it("keeps reactions and reports but no best-answer button on a locked thread", async () => {
      seedThread({ authorId: viewerId, lockedAt: new Date() });
      reply("r1", "m2");

      const html = await render("t1");

      expect(html).not.toContain("mejor respuesta");
      expect(html).toContain("Me sirvió");
      expect(html).toContain(">Reportar<");
      expect(html).not.toContain("Su respuesta");
    });

    it("never shows who reacted", async () => {
      seedThread();
      reply("r1", "m2");
      testForum.store.reactions.set("x1", { memberId: "m2", threadId: null, replyId: "r1" });

      const html = await render("t1");

      expect(html).not.toContain("Mateo R. le sirvió");
      expect(html).not.toContain("reaccion");
    });
  });

  it("never prints an email or a member id", async () => {
    seedThread();
    testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2" }));

    const html = await render("t1");

    expect(html).not.toContain("@unl.edu.ec");
    expect(html).not.toContain("m2");
  });
});
