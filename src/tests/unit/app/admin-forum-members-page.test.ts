import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import AdminForumMembersPage, { dynamic } from "../../../../app/admin/foro/miembros/page";
import { FORUM_MEMBERS_PAGE_SIZE } from "@/application/forum/forum-members.use-cases";
import { cookieJar } from "@/tests/support/action-policy";
import { makeForumMember } from "@/tests/fakes/in-memory-forum";
import { signInAs } from "@/tests/support/test-auth";
import { testForum } from "@/tests/support/test-forum";

const render = async (searchParams: Record<string, string | string[]> = {}) => renderToStaticMarkup(await AdminForumMembersPage({ searchParams: Promise.resolve(searchParams) }));

const addMember = (id: string, overrides: Parameters<typeof makeForumMember>[0] = {}) =>
  testForum.members.members.set(id, makeForumMember({ id, email: `${id}@unl.edu.ec`, googleSub: `sub-${id}`, displayName: id.toUpperCase(), ...overrides }));

beforeEach(async () => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  cookieJar(cookiesMock, await signInAs("EDITOR"));
});

describe("the forum members page", () => {
  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("lists each member with name, email, status and when they joined and last signed in, and never the Google id", async () => {
    addMember("ana", { displayName: "Ana Pérez", createdAt: new Date("2026-10-01T15:00:00.000Z"), lastLoginAt: new Date("2026-10-20T15:00:00.000Z") });
    addMember("beto", { displayName: "Beto Ruiz", createdAt: new Date("2026-10-02T15:00:00.000Z") });

    const html = await render();

    expect(html).toContain("Miembros del foro");
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("ana@unl.edu.ec");
    expect(html).toContain("Activo");
    expect(html).toMatch(/Se unió el [^<]*oct[^<]*2026/);
    expect(html).toMatch(/Último ingreso: [^<]*20[^<]*oct[^<]*2026/);
    expect(html).toContain("Beto Ruiz");
    expect(html).toContain("Sin ingresos registrados");
    expect(html).not.toContain("sub-ana");
    expect(html).toContain("2 miembros");
  });

  it("escapes a display name written as markup", async () => {
    addMember("ana", { displayName: "<script>alert(1)</script>" });

    const html = await render();

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("offers Reactivar la cuenta only for suspended members, and tags them as suspended", async () => {
    addMember("ana");
    addMember("cris", { displayName: "Cristina", status: "SUSPENDED", suspendedAt: new Date("2026-10-10T15:00:00.000Z") });

    const html = await render();

    expect(html.match(/>Reactivar la cuenta</g)).toHaveLength(1);
    expect(html).toContain("Suspendido");
    expect(html).toMatch(/Suspendido el [^<]*oct[^<]*2026/);
    expect(html).toContain('aria-label="Reactivar la cuenta: Cristina"');
    expect(html).not.toContain("Suspender…");
  });

  it("shows only the suspended members with ?estado=suspendidos, and marks the filter as current", async () => {
    addMember("ana");
    addMember("cris", { displayName: "Cristina", status: "SUSPENDED", suspendedAt: new Date("2026-10-10T15:00:00.000Z") });

    const html = await render({ estado: "suspendidos" });

    expect(html).toContain("Cristina");
    expect(html).not.toContain("ana@unl.edu.ec");
    expect(html).toMatch(/aria-current="true"[^>]*>Suspendidos/);
    expect(html).toContain('href="/admin/foro/miembros"');
  });

  it("searches by name or email, keeps the filter in the form and offers the way back", async () => {
    addMember("ana", { displayName: "Ana Pérez" });
    addMember("beto", { displayName: "Beto Ruiz" });

    const byName = await render({ q: "pérez" });
    const byEmail = await render({ q: "BETO@" });
    const filtered = await render({ q: "ana", estado: "suspendidos" });

    expect(byName).toContain("Ana Pérez");
    expect(byName).not.toContain("Beto Ruiz");
    expect(byName).toContain('role="search"');
    expect(byName).toContain('value="pérez"');
    expect(byName).toContain("1 resultado para «pérez»");
    expect(byEmail).toContain("Beto Ruiz");
    expect(byEmail).not.toContain("Ana Pérez");
    expect(filtered).toContain('type="hidden" name="estado" value="suspendidos"');
    expect(filtered).toContain('href="/admin/foro/miembros?estado=suspendidos"');
  });

  it("says nothing matches a search, with the way to clear it", async () => {
    addMember("ana");

    const html = await render({ q: "nadie" });

    expect(html).toContain("No hay miembros que coincidan con «nadie»");
    expect(html).toContain('href="/admin/foro/miembros"');
    expect(html).not.toContain("Reactivar");
  });

  it("explains an empty forum, and an empty suspended list", async () => {
    expect(await render()).toContain("Todavía no hay miembros");

    addMember("ana");

    expect(await render({ estado: "suspendidos" })).toContain("No hay cuentas suspendidas.");
  });

  it("paginates, keeping the filter and the search in the links", async () => {
    for (let index = 0; index <= FORUM_MEMBERS_PAGE_SIZE; index += 1) {
      addMember(`m${index}`, { status: "SUSPENDED", suspendedAt: new Date("2026-10-10T15:00:00.000Z"), createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)) });
    }

    const first = await render({ estado: "suspendidos", q: "unl" });
    const second = await render({ estado: "suspendidos", q: "unl", pagina: "2" });

    expect(first).toContain("Página 1 de 2");
    expect(first).toContain('href="/admin/foro/miembros?estado=suspendidos&amp;q=unl&amp;pagina=2"');
    expect(first).not.toContain("M0<");
    expect(second).toContain("Página 2 de 2");
    expect(second).toContain("M0<");
    expect(second).toContain('href="/admin/foro/miembros?estado=suspendidos&amp;q=unl"');
  });

  it("links to the report queue, and to the categories only for an administrator", async () => {
    const editor = await render();

    expect(editor).toContain('href="/admin/foro/reportes"');
    expect(editor).not.toContain("/admin/foro/categorias");

    cookieJar(cookiesMock, await signInAs("ADMIN"));

    expect(await render()).toContain('href="/admin/foro/categorias"');
  });

  it("sends a visitor without a session to the login", async () => {
    cookieJar(cookiesMock, undefined);

    await expect(render()).rejects.toThrow("REDIRECT /login");
  });
});
