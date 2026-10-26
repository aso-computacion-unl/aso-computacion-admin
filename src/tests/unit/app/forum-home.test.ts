import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
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
import { makeForumCategory, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { signInAs } from "@/tests/support/test-auth";
import { testForum } from "@/tests/support/test-forum";
import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";

const renderHome = async (error?: string) => renderToStaticMarkup(await ForumHomePage({ searchParams: Promise.resolve({ error }) }));
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

describe("/foro as a member", () => {
  it("lists the categories in order with their thread counts, each linking to its threads", async () => {
    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación", description: "Código y dudas", sortOrder: 1 }));
    testForum.store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", sortOrder: 2 }));
    testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1" }));
    testForum.store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c1" }));
    cookiesMock.mockResolvedValue((await forumMemberJar()).jar);

    const html = await renderHome();

    expect(html).toContain('href="/foro/c/programacion"');
    expect(html).toContain('href="/foro/c/materias"');
    expect(html.indexOf("Programación")).toBeLessThan(html.indexOf("Materias"));
    expect(html).toContain("Código y dudas");
    expect(html).toMatch(/2<span class="sr-only"> hilos<\/span>/);
    expect(html).toMatch(/0<span class="sr-only"> hilos<\/span>/);
    expect(html).not.toContain("Entrar con Google");
  });

  it("says there are no categories yet instead of showing an empty list", async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar()).jar);

    const html = await renderHome();

    expect(html).toContain("Todavía no hay categorías.");
    expect(html).not.toContain("<ul");
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
