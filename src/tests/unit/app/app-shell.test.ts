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
vi.mock("../../../../app/_components/theme-toggle", () => ({
  ThemeToggle: () => createElement("button", null, "Modo claro"),
  AdminThemeDefault: () => null,
}));

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
/** The rail is the `<aside>` of the page; the phone's tab bar is the fixed `<nav>` after it. */
const rail = (html: string) => html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? "";
const tabBar = (html: string) => html.match(/<nav[^>]*class="[^"]*fixed[^"]*"[\s\S]*?<\/nav>/)?.[0] ?? "";
const railNav = (html: string) => rail(html).match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
/** The session card: the rail's (desktop) or the row at the top of `main` (phone). */
const railCard = (html: string) => rail(html).match(/<section[\s\S]*?<\/section>/)?.[0] ?? "";
const phoneRow = (html: string) => html.match(/<main[\s\S]*?(<section[\s\S]*?<\/section>)/)?.[1] ?? "";
const linksOf = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => [match[1], match[2]?.replace(/<[^>]+>/g, "")]);
const emergencyActor = () => actor({ kind: "break_glass", userId: null, name: "Acceso de emergencia" });

beforeEach(() => {
  vi.clearAllMocks();
  stubForumSecrets();
  cookiesMock.mockResolvedValue(cookieJar({}));
});

describe("the profile card", () => {
  it("names an administrator, with the short role on the rail and the full one on the phone's row", async () => {
    const html = await renderAdmin(actor());

    expect(railCard(html)).toContain('aria-label="Sesión: Ana Pérez, Administrador"');
    expect(railCard(html)).toContain(">AP<");
    expect(railCard(html)).toContain(">Admin<");
    expect(phoneRow(html)).toContain("Ana Pérez");
    expect(phoneRow(html)).toContain(">Administrador<");
  });

  it("names an editor and their role", async () => {
    const html = await renderAdmin(actor({ role: "EDITOR", name: "Luis Mora" }));

    expect(railCard(html)).toContain("Luis Mora");
    expect(railCard(html)).toContain(">Editor<");
    expect(html).not.toContain("Administrador");
  });

  it("offers «Mis sesiones», the theme and «Cerrar sesión» on the rail and on the phone's row", async () => {
    const html = await renderAdmin(actor());

    for (const card of [railCard(html), phoneRow(html)]) {
      expect(card).toMatch(/<a [^>]*href="\/admin\/sesiones"[^>]*aria-label="Mis sesiones"|<a [^>]*aria-label="Mis sesiones"[^>]*href="\/admin\/sesiones"/);
      expect(card).toContain("Modo claro");
      expect(card).toMatch(/<button [^>]*type="submit"[\s\S]*Cerrar sesión/);
      expect(card).not.toContain("bg-tint-red");
    }
  });

  it("turns the whole card tint-red in the emergency session, with «Emergencia» on signal, a danger sign-out and the notice", async () => {
    const html = await renderAdmin(emergencyActor());

    for (const card of [railCard(html), phoneRow(html)]) {
      expect(card.match(/<section[^>]*>/)?.[0]).toContain("bg-tint-red");
      expect(card).toContain('aria-label="Sesión: acceso de emergencia"');
      expect(card).toMatch(/class="[^"]*bg-signal[^"]*"[^>]*>Emergencia</);
      expect(card).toMatch(/<button [^>]*class="[^"]*bg-destructive[^"]*"[\s\S]*Cerrar sesión/);
      expect(card).toContain(BREAK_GLASS_NOTICE);
      expect(card).not.toContain("Mis sesiones");
      expect(card).not.toContain("Administrador");
    }
  });

  it("puts nothing about the session in the top bar", async () => {
    const bar = topBar(await renderAdmin(emergencyActor()));

    expect(bar).not.toContain("Acceso de emergencia");
    expect(bar).not.toContain("Cerrar sesión");
    expect(bar).not.toContain("Modo claro");
    expect(bar).not.toContain("aria-haspopup");
  });

  it("shows the phone's row only below the desktop breakpoint", async () => {
    const html = await renderAdmin(actor());

    expect(html).toMatch(/<main[^>]*>\s*<div class="[^"]*\blg:hidden\b[^"]*"><section/);
  });
});

describe("the full-width main", () => {
  it("has no max-width and pads 16 · 24 · 32 · 40 · 48 px by breakpoint", async () => {
    const main = (await renderAdmin(actor())).match(/<main[^>]*>/)?.[0] ?? "";

    expect(main).not.toMatch(/max-w-|mx-auto/);

    for (const padding of ["px-4", "sm:px-6", "lg:px-8", "min-[90rem]:px-10", "min-[120rem]:px-12"]) expect(main).toContain(padding);
  });
});

describe("the navigation rail and the phone's tab bar", () => {
  const AREAS = [
    ["/admin", "Inicio"],
    ["/admin/events", "Landing"],
    ["/admin/registrations", "Inscripciones"],
    ["/admin/foro/reportes", "Foro"],
    ["/admin/ajustes", "Ajustes"],
  ];

  it.each(["ADMIN", "EDITOR"] as const)("offers %s the logo, Inicio and the four areas in the rail", async (role) => {
    const links = linksOf(railNav(await renderAdmin(actor({ role }))));

    expect(links[0]?.[0]).toBe("/admin");
    expect(links.slice(1)).toEqual(AREAS);
  });

  it("puts the real isotype, white on the navy rail, in the logo link, with an accessible name", async () => {
    const logo = rail(await renderAdmin(actor())).match(/<a [^>]*href="\/admin"[\s\S]*?<\/a>/)?.[0] ?? "";

    expect(logo).toMatch(/aria-label="ASO Computación, inicio de la administración"/);
    expect(logo).toMatch(/<img alt=""[^>]*src="data:image\/svg\+xml[^"]*fill:%23ffffff/);
  });

  it("floats the 88px rail 12px from the edges with the card radius, and fills the current area's pill", async () => {
    const html = await renderAdmin(actor());

    expect(html.match(/<aside[^>]*>/)?.[0]).toMatch(/\bpy-3\b[^"]*\bpl-3\b/);
    expect(rail(html)).toMatch(/class="[^"]*\bw-22\b[^"]*\brounded-card\b[^"]*\bbg-deep\b/);
    expect(railNav(html)).toMatch(/<a [^>]*href="\/admin"[^>]*aria-current="page"[^>]*>Inicio|<a [^>]*aria-current="page"[^>]*href="\/admin"/);
    expect(railNav(html)).toContain("group-aria-[current=page]:bg-white");
    expect(railNav(html)).toContain("h-8 w-14");
  });

  it("offers the same five items on the phone's tab bar, Inscripciones shortened but named in full, with no «Más» sheet", async () => {
    const html = await renderAdmin(actor({ role: "EDITOR" }));
    const bar = tabBar(html);

    expect(linksOf(bar).map(([href]) => href)).toEqual(AREAS.map(([href]) => href));
    expect(bar).toContain('<span aria-hidden="true">Inscrip.</span><span class="sr-only">Inscripciones</span>');
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("Más");

    for (const label of ["landing/", "herramientas/", "cuenta/"]) expect(html).not.toContain(label);
  });

  it("hides the rail below the desktop breakpoint, and the tab bar and the top bar above it", async () => {
    const html = await renderAdmin(actor());

    expect(html.match(/<aside[^>]*>/)?.[0]).toMatch(/\bhidden\b[^"]*\blg:/);
    expect(tabBar(html)).toContain("lg:hidden");
    expect(topBar(html).match(/<header[^>]*>/)?.[0]).toContain("lg:hidden");
  });

  it("gives the phone's top bar the logo (Inicio) and the name of the page's area", async () => {
    const bar = topBar(await renderAdmin(actor()));

    expect(bar).toMatch(/<a [^>]*href="\/admin"[^>]*aria-label="ASO Computación, inicio de la administración"|<a [^>]*aria-label="ASO Computación, inicio de la administración"[^>]*href="\/admin"/);
    expect(bar).toContain(">Inicio<");
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
