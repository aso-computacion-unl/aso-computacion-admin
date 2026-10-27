import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Actor } from "@/domain/user";

const { cookiesMock, requirePageSessionMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), requirePageSessionMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/admin",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: requirePageSessionMock }));
vi.mock("@/interface/auth/actions", () => ({ logout: vi.fn() }));
vi.mock("../../../../app/_components/brand-mark", () => ({ BrandIsotype: () => null }));
vi.mock("../../../../app/_components/theme-toggle", () => ({ ThemeToggle: () => createElement("button", null, "Modo claro") }));

import AdminLayout from "../../../../app/admin/layout";
import ForumLayout from "../../../../app/foro/layout";
import { BREAK_GLASS_NOTICE } from "@/interface/admin/role-labels";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";

const actor = (overrides: Partial<Actor> = {}): Actor => ({
  kind: "user",
  sessionId: "s1",
  userId: "u1",
  name: "Ana Pérez",
  role: "ADMIN",
  ...overrides,
});

const renderAdmin = async (current: Actor) => {
  requirePageSessionMock.mockResolvedValue(current);

  return renderToStaticMarkup(await AdminLayout({ children: createElement("p", null, "contenido") }));
};
const renderForum = async () => renderToStaticMarkup(await ForumLayout({ children: createElement("p", null, "contenido") }));

/** The top bar is the one `<header>` of the page. */
const topBar = (html: string) => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  stubForumSecrets();
  cookiesMock.mockResolvedValue(cookieJar({}));
});

describe("the identity chip in the admin top bar", () => {
  it("names an administrator and their role", async () => {
    const bar = topBar(await renderAdmin(actor()));

    expect(bar).toContain("Admin ASO");
    expect(bar).toContain("Ana Pérez");
    expect(bar).toContain("Administrador");
    expect(bar).toContain(">AP<");
  });

  it("names an editor and their role", async () => {
    const bar = topBar(await renderAdmin(actor({ role: "EDITOR", name: "Luis Mora" })));

    expect(bar).toContain("Luis Mora");
    expect(bar).toContain("Editor");
    expect(bar).not.toContain("Administrador");
  });

  it("shows the emergency session as a red pill instead of a name and a role", async () => {
    const bar = topBar(await renderAdmin(actor({ kind: "break_glass", userId: null, name: "Acceso de emergencia" })));

    expect(bar).toContain("Acceso de emergencia");
    expect(bar).toMatch(/class="[^"]*bg-destructive[^"]*"[^>]*>Acceso de emergencia</);
    expect(bar).not.toContain("Administrador");
    expect(bar).toContain(BREAK_GLASS_NOTICE);
  });

  it("keeps the theme toggle and the sign-out inside the identity menu", async () => {
    const bar = topBar(await renderAdmin(actor()));

    expect(bar).toMatch(/aria-haspopup="true"[^>]*aria-expanded="false"/);
    expect(bar).toContain("Modo claro");
    expect(bar).toContain("Cerrar sesión");
  });

  it("no longer repeats the emergency banner or the identity in the sidebar or the page", async () => {
    const html = await renderAdmin(actor({ kind: "break_glass", userId: null, name: "Acceso de emergencia" }));
    const outsideBar = html.replace(topBar(html), "");

    expect(outsideBar).not.toContain('role="note"');
    expect(outsideBar).not.toContain("Acceso de emergencia");
    expect(outsideBar).not.toContain("Cerrar sesión");
    expect(outsideBar).not.toContain("Modo claro");
    expect(outsideBar).toContain('aria-label="Secciones"');
    expect(outsideBar).toContain("contenido");
  });
});

describe("the identity chip in the forum top bar", () => {
  it("names the signed-in member with the student role", async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar({ displayName: "Daniela P." })).jar);

    const bar = topBar(await renderForum());

    expect(bar).toContain("Foro");
    expect(bar).toContain("Daniela P.");
    expect(bar).toContain("Estudiante UNL");
    expect(bar).toContain(">DP<");
    expect(bar).toContain("Cerrar sesión");
  });

  it("shows a visitor only the theme toggle", async () => {
    const bar = topBar(await renderForum());

    expect(bar).toContain("Foro");
    expect(bar).toContain("Modo claro");
    expect(bar).not.toContain("aria-haspopup");
    expect(bar).not.toContain("Cerrar sesión");
    expect(bar).not.toContain("Estudiante UNL");
  });
});

describe("one brand in both top bars", () => {
  it("sets the product name in the same class in the admin and in the forum", async () => {
    const productName = (html: string) => topBar(html).match(/<span class="([^"]*font-display[^"]*)">(Admin ASO|Foro)</);
    const admin = productName(await renderAdmin(actor()));
    const forum = productName(await renderForum());

    expect(admin?.[1]).toBeDefined();
    expect(admin?.[1]).toBe(forum?.[1]);
  });
});
