import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, notFoundMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../../../../app/_components/brand-mark", () => ({ BrandIsotype: () => null }));
vi.mock("../../../../app/_components/theme-toggle", () => ({ ThemeToggle: () => null }));

import ForumLayout from "../../../../app/foro/layout";
import ForumHomePage from "../../../../app/foro/page";
import { FORUM_LOGIN_ERROR_MESSAGES, FORUM_LOGIN_ERRORS } from "@/interface/forum/forum-login-errors";
import { FORUM_THREADS_PAGE_SIZE } from "@/application/forum/forum-threads.use-cases";
import { makeForumCategory, makeForumMember, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { signInAs } from "@/tests/support/test-auth";
import { testForum } from "@/tests/support/test-forum";
import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";

type HomeQuery = { error?: string; next?: string | string[]; estado?: string; categoria?: string; pagina?: string };

const renderQuery = async (query: HomeQuery) => renderToStaticMarkup(await ForumHomePage({ searchParams: Promise.resolve(query) }));
const renderHome = (error?: string, next?: string | string[]) => renderQuery({ error, next });
const renderLayout = async () => renderToStaticMarkup(await ForumLayout({ children: createElement("p", null, "contenido") }));

beforeEach(() => {
  vi.clearAllMocks();
  stubForumSecrets();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  cookiesMock.mockResolvedValue(cookieJar({}));
});

describe("/foro as a visitor", () => {
  it("offers the Google sign-in and none of the forum", async () => {
    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", name: "Programación" }));

    const html = await renderHome();

    expect(html).toContain("Entrar con Google");
    expect(html).toContain('href="/foro/auth/google/start"');
    expect(html).toContain("@unl.edu.ec");
    expect(html).not.toContain("Programación");
    expect(html).not.toContain('role="alert"');
  });

  it("passes the path the visitor came for to the sign-in as next", async () => {
    const html = await renderHome(undefined, "/foro/hilo/abc?x=1");

    expect(html).toContain('href="/foro/auth/google/start?next=%2Fforo%2Fhilo%2Fabc%3Fx%3D1"');
  });

  it.each([
    ["an external URL", "https://evil.example/foro"],
    ["a protocol-relative URL", "//evil.example"],
    ["the admin area", "/admin"],
    ["an auth path", "/foro/auth/google/callback"],
    ["a repeated parameter", ["/foro/hilo/a", "/foro/hilo/b"]],
  ])("does not forward %s: the sign-in link stays plain", async (_label, next) => {
    const html = await renderHome(undefined, next);

    expect(html).toContain('href="/foro/auth/google/start"');
    expect(html).not.toContain("next=");
  });

  it.each(FORUM_LOGIN_ERRORS)("explains a failed sign-in (%s) as an alert and offers to try again", async (code) => {
    const html = await renderHome(code);

    expect(html).toContain('role="alert"');
    expect(html.replace(/&#x27;/g, "'")).toContain(FORUM_LOGIN_ERROR_MESSAGES[code]);
    expect(html).toContain("Entrar de nuevo con Google");
  });

  it("tells a refused student (which includes a suspended member) what may have happened", async () => {
    expect(await renderHome("denied")).toContain("suspendido su cuenta");
    expect(await renderHome("failed")).not.toContain("suspendido su cuenta");
  });

  it("ignores an unknown error code instead of echoing it", async () => {
    const html = await renderHome("<script>alert(1)</script>");

    expect(html).not.toContain("script");
    expect(html).toContain("Entrar con Google");
  });

  it("treats an admin session as a visitor: it is not a forum member", async () => {
    cookiesMock.mockResolvedValue(cookieJar({ [AUTH_COOKIE_NAME]: await signInAs("ADMIN") }));

    expect(await renderHome()).toContain("Entrar con Google");
  });
});

const NOW = new Date();
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function seedForum() {
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "general", name: "General", sortOrder: 1 }));
  testForum.store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", sortOrder: 2 }));
  testForum.store.categories.set("c3", makeForumCategory({ id: "c3", slug: "propuestas", name: "Propuestas", sortOrder: 3 }));
  testForum.members.members.set("m2", makeForumMember({ id: "m2", email: "kevin@unl.edu.ec", googleSub: "sub-2", displayName: "Kevin L." }));
  testForum.store.threads.set("t-wsl", makeForumThread({ id: "t-wsl", categoryId: "c2", authorId: "m2", title: "¿Cómo configuro WSL2?", lastActivityAt: minutesAgo(60) }));
  testForum.store.threads.set("t-idea", makeForumThread({ id: "t-idea", categoryId: "c1", authorId: "m2", title: "Ideas para el hackatón", lockedAt: minutesAgo(5), lastActivityAt: minutesAgo(1500) }));
  testForum.store.threads.set("t-fault", makeForumThread({ id: "t-fault", categoryId: "c2", authorId: "m2", title: "Segfault al liberar la lista", bestReplyId: "r1", lastActivityAt: minutesAgo(12) }));
  testForum.store.threads.set("t-hidden", makeForumThread({ id: "t-hidden", categoryId: "c1", authorId: "m2", title: "Hilo oculto por la moderación", hiddenAt: minutesAgo(3) }));
}

describe("/foro as a member", () => {
  beforeEach(async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar()).jar);
  });

  it("is the thread list of every category: open threads newest activity first, hidden ones never", async () => {
    seedForum();

    const html = await renderQuery({});

    expect(html).toContain('<h1 class="');
    expect(html).toMatch(/<h1[^>]*>Hilos<\/h1>/);
    expect(html).not.toMatch(/<h1[^>]*>Foro<\/h1>/);
    expect(html.indexOf("¿Cómo configuro WSL2?")).toBeGreaterThan(-1);
    expect(html.indexOf("¿Cómo configuro WSL2?")).toBeLessThan(html.indexOf("Ideas para el hackatón"));
    expect(html).not.toContain("Segfault al liberar la lista");
    expect(html).not.toContain("Hilo oculto por la moderación");
    expect(html).toContain('href="/foro/hilo/t-wsl"');
    expect(html).toContain("Kevin L.");
    expect(html).toContain("hace 1 h");
    expect(html).not.toContain("Entrar con Google");
  });

  it("shows each thread's category as a chip and says what state it is in with words", async () => {
    seedForum();

    const html = await renderQuery({});

    expect(html).toMatch(/<span class="chip"[^>]*data-hue="\d"[^>]*>Materias<\/span>/);
    expect(html).toContain("· abierto");
    expect(html).toContain("· cerrado por la moderación");
    expect(html).toContain('<span class="sr-only">Abierto</span>');
  });

  it("counts both tabs for the whole forum and switches to the solved threads", async () => {
    seedForum();

    const open = await renderQuery({});
    const solved = await renderQuery({ estado: "resueltos" });

    expect(open).toMatch(/Abiertos<span[^>]*>2<\/span>/);
    expect(open).toMatch(/Resueltos<span[^>]*>1<\/span>/);
    expect(open).toMatch(/aria-current="page"[^>]*href="\/foro"/);
    expect(open).toContain('href="/foro?estado=resueltos"');
    expect(solved).toContain("Segfault al liberar la lista");
    expect(solved).toContain("· resuelto");
    expect(solved).not.toContain("¿Cómo configuro WSL2?");
    expect(solved).toMatch(/aria-current="page"[^>]*href="\/foro\?estado=resueltos"/);
  });

  it("filters by category with chips that keep the tab, counting only that category", async () => {
    seedForum();

    const html = await renderQuery({ categoria: "materias", estado: "resueltos" });

    expect(html).toContain('aria-label="Categoría"');
    expect(html).toContain('href="/foro?estado=resueltos"');
    expect(html).toContain('href="/foro?categoria=propuestas&amp;estado=resueltos"');
    expect(html).toMatch(/aria-current="page"[^>]*href="\/foro\?categoria=materias&amp;estado=resueltos"/);
    expect(html).toContain("Segfault al liberar la lista");
    expect(html).toMatch(/Abiertos<span[^>]*>1<\/span>/);
    expect(await renderQuery({ categoria: "materias" })).not.toContain("Ideas para el hackatón");
  });

  it("is a 404 for a category that does not exist", async () => {
    seedForum();

    await expect(renderQuery({ categoria: "no-existe" })).rejects.toThrow("NOT_FOUND");
  });

  it("offers Nuevo hilo as a choice of category, or straight to the category it is filtered to", async () => {
    seedForum();

    const all = await renderQuery({});
    const one = await renderQuery({ categoria: "propuestas" });

    for (const slug of ["general", "materias", "propuestas"]) expect(all).toContain(`href="/foro/c/${slug}/nuevo"`);
    expect(all).toContain('aria-haspopup="true"');
    expect(one).toContain('href="/foro/c/propuestas/nuevo"');
    expect(one).not.toContain('href="/foro/c/materias/nuevo"');
  });

  it("explains an empty tab in a line and offers Nuevo hilo, keeping the tabs", async () => {
    seedForum();
    testForum.store.threads.delete("t-fault");

    const solved = await renderQuery({ estado: "resueltos" });

    expect(solved).toContain("No hay hilos resueltos.");
    expect(solved).toContain("Nuevo hilo");
    expect(solved).toContain("Estado de los hilos");
    expect(solved).not.toContain("<ul");
  });

  it("says so when the forum has no threads yet, and still offers the first one", async () => {
    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "general", name: "General" }));

    const html = await renderQuery({});

    expect(html).toContain("Todavía no hay hilos.");
    expect(html).toContain('href="/foro/c/general/nuevo"');
  });

  it("says there are no categories yet instead of offering a thread nobody can place", async () => {
    const html = await renderQuery({});

    expect(html).toContain("Todavía no hay categorías.");
    expect(html).not.toContain("Nuevo hilo");
    expect(html).not.toContain("<ul");
  });

  it("paginates and keeps the tab and the category in the links", async () => {
    seedForum();
    for (let index = 0; index < FORUM_THREADS_PAGE_SIZE + 2; index += 1) {
      testForum.store.threads.set(`bulk-${index}`, makeForumThread({ id: `bulk-${index}`, categoryId: "c3", title: `Propuesta ${index}`, lastActivityAt: minutesAgo(index) }));
    }

    const first = await renderQuery({ categoria: "propuestas" });
    const last = await renderQuery({ categoria: "propuestas", pagina: "99" });

    expect(first).toContain("Página 1 de 2");
    expect(first).toContain('href="/foro?categoria=propuestas&amp;pagina=2"');
    expect(last).toContain("Página 2 de 2");
    expect(last).toContain('href="/foro?categoria=propuestas"');
  });

  it("falls back to the sign-in when the session was revoked", async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar()).jar);
    expect(await renderHome()).not.toContain("Entrar con Google");
    for (const record of testForum.sessions.sessions.values()) record.revokedAt = new Date();

    expect(await renderHome()).toContain("Entrar con Google");
  });
});

describe("the forum layout", () => {
  it("names the signed-in member and offers to sign out", async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar({ displayName: "Daniela P." })).jar);

    const html = await renderLayout();

    expect(html).toContain("Daniela P.");
    expect(html).toContain(">DP<");
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain("contenido");
  });

  it("shows no member and no sign-out to a visitor, and keeps the skip link and the main landmark", async () => {
    const html = await renderLayout();

    expect(html).not.toContain("Cerrar sesión");
    expect(html).toContain('href="#main"');
    expect(html).toContain('<main id="main"');
  });
});
