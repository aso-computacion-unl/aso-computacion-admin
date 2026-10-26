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
vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

import CategoryPage, { generateMetadata } from "../../../../app/foro/c/[slug]/page";
import { FORUM_THREADS_PAGE_SIZE } from "@/application/forum/forum-threads.use-cases";
import { makeForumCategory, makeForumMember, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { testForum } from "@/tests/support/test-forum";

const NOW = new Date();
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function render(slug: string, query: { estado?: string; pagina?: string } = {}) {
  return CategoryPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) }).then((element) => renderToStaticMarkup(element));
}

function seedThreads() {
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación", description: "Código y dudas" }));
  testForum.store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias" }));
  testForum.members.members.set("m2", makeForumMember({ id: "m2", email: "kevin@unl.edu.ec", googleSub: "sub-2", displayName: "Kevin L." }));
  testForum.store.threads.set("t-open", makeForumThread({ id: "t-open", categoryId: "c1", authorId: "m2", title: "¿Cómo configuro WSL2?", lastActivityAt: minutesAgo(60) }));
  testForum.store.threads.set("t-solved", makeForumThread({ id: "t-solved", categoryId: "c1", authorId: "m2", title: "Segfault al liberar la lista", bestReplyId: "r1", lastActivityAt: minutesAgo(12) }));
  testForum.store.threads.set("t-locked", makeForumThread({ id: "t-locked", categoryId: "c1", authorId: "m2", title: "Ideas para el hackatón", lockedAt: minutesAgo(5), lastActivityAt: minutesAgo(1500) }));
  testForum.store.threads.set("t-hidden", makeForumThread({ id: "t-hidden", categoryId: "c1", authorId: "m2", title: "Hilo oculto por la moderación", hiddenAt: minutesAgo(3) }));
  testForum.store.threads.set("t-other", makeForumThread({ id: "t-other", categoryId: "c2", authorId: "m2", title: "Otra categoría" }));
}

let viewerId = "";

beforeEach(async () => {
  vi.clearAllMocks();
  stubForumSecrets();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  seedThreads();
  const viewer = await forumMemberJar();
  viewerId = viewer.memberId;
  cookiesMock.mockResolvedValue(viewer.jar);
});

describe("a category page", () => {
  it("is for members: a visitor goes to the sign-in at /foro", async () => {
    cookiesMock.mockResolvedValue(cookieJar({}));

    await expect(render("programacion")).rejects.toThrow("REDIRECT /foro");
  });

  it("is a 404 for a category that does not exist", async () => {
    await expect(render("no-existe")).rejects.toThrow("NOT_FOUND");
    await expect(generateMetadata({ params: Promise.resolve({ slug: "no-existe" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  });

  it("titles the page with the category and shows its name, description and the new-thread link", async () => {
    const html = await render("programacion");

    expect(await generateMetadata({ params: Promise.resolve({ slug: "programacion" }), searchParams: Promise.resolve({}) })).toEqual({ title: "Programación" });
    expect(html).toContain("<h1");
    expect(html).toContain("Programación");
    expect(html).toContain("Código y dudas");
    expect(html).toContain('href="/foro/c/programacion/nuevo"');
  });

  it("lists the open threads by default, including a locked one, and neither the solved, the hidden nor another category's", async () => {
    const html = await render("programacion");

    expect(html).toContain("¿Cómo configuro WSL2?");
    expect(html).toContain("Ideas para el hackatón");
    expect(html).not.toContain("Segfault al liberar la lista");
    expect(html).not.toContain("Hilo oculto por la moderación");
    expect(html).not.toContain("Otra categoría");
  });

  it("lists only the solved threads under Resueltos, each marked as solved", async () => {
    const html = await render("programacion", { estado: "resueltos" });

    expect(html).toContain("Segfault al liberar la lista");
    expect(html).toContain("· resuelto");
    expect(html).not.toContain("¿Cómo configuro WSL2?");
    expect(html).not.toContain("Ideas para el hackatón");
  });

  it("marks the active filter with aria-current and links both filters", async () => {
    const open = await render("programacion");
    const solved = await render("programacion", { estado: "resueltos" });

    expect(open).toMatch(/aria-current="page"[^>]*href="\/foro\/c\/programacion"/);
    expect(open).toContain('href="/foro/c/programacion?estado=resueltos"');
    expect(open.match(/aria-current/g)).toHaveLength(1);
    expect(solved).toMatch(/aria-current="page"[^>]*href="\/foro\/c\/programacion\?estado=resueltos"/);
    expect(solved.match(/aria-current/g)).toHaveLength(1);
  });

  it("falls back to Abiertos for an unknown filter", async () => {
    const html = await render("programacion", { estado: "todo" });

    expect(html).toContain("¿Cómo configuro WSL2?");
    expect(html).not.toContain("Segfault al liberar la lista");
  });

  it("counts open and solved threads in the tabs when the category fits one page", async () => {
    const html = await render("programacion");

    expect(html).toMatch(/Abiertos<span[^>]*>2<\/span>/);
    expect(html).toMatch(/Resueltos<span[^>]*>1<\/span>/);
  });

  it("links each thread, with the author, the activity time and status words for assistive tech", async () => {
    const html = await render("programacion");

    expect(html).toContain('href="/foro/hilo/t-open"');
    expect(html).toContain("Kevin L.");
    expect(html).toContain("hace 1 h");
    expect(html).toContain("· cerrado por la moderación");
    expect(html).toContain('<span class="sr-only">Abierto</span>');
    expect(html).toContain('<span class="sr-only">Cerrado</span>');
    expect(html).toMatch(/0<span class="sr-only"> respuestas<\/span>/);
  });

  it("marks the viewer's own threads", async () => {
    testForum.store.threads.set("t-mine", makeForumThread({ id: "t-mine", categoryId: "c1", authorId: viewerId, title: "Mi duda" }));

    expect(await render("programacion")).toMatch(/Ana\s*\(usted\)/);
  });

  it("says so when the category has no threads at all", async () => {
    testForum.store.categories.set("c3", makeForumCategory({ id: "c3", slug: "eventos", name: "Eventos" }));

    const html = await render("eventos");

    expect(html).toContain("Todavía no hay hilos en esta categoría.");
    expect(html).toContain('href="/foro/c/eventos/nuevo"');
    expect(html).not.toContain("<ul");
  });

  it("says so when the chosen filter has nothing, and keeps the filter tabs", async () => {
    testForum.store.threads.delete("t-solved");

    const html = await render("programacion", { estado: "resueltos" });

    expect(html).toContain("No hay hilos resueltos.");
    expect(html).toContain("Estado de los hilos");
  });
});

describe("a category with several pages", () => {
  beforeEach(() => {
    for (let index = 0; index < FORUM_THREADS_PAGE_SIZE + 2; index += 1) {
      testForum.store.threads.set(`bulk-${index}`, makeForumThread({ id: `bulk-${index}`, categoryId: "c2", title: `Hilo ${index}`, lastActivityAt: minutesAgo(index) }));
    }
  });

  it("paginates, keeps the filter in the links and drops the per-page counts", async () => {
    const first = await render("materias", { estado: "resueltos" });

    expect(first).toContain("Página 1 de 2");
    expect(first).toContain('href="/foro/c/materias?estado=resueltos&amp;pagina=2"');
    expect(first).not.toContain("Anterior");
    expect(first).not.toMatch(/Abiertos<span/);
    expect(first).toContain("No hay hilos resueltos en esta página.");

    const second = await render("materias", { pagina: "2" });

    expect(second).toContain("Página 2 de 2");
    expect(second).toContain('href="/foro/c/materias"');
    expect(second).not.toContain("Siguiente");
  });

  it("clamps a page past the end to the last page", async () => {
    expect(await render("materias", { pagina: "99" })).toContain("Página 2 de 2");
  });
});
