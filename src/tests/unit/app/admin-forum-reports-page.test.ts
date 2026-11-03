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

import AdminForumReportsPage, { dynamic } from "../../../../app/admin/foro/reportes/page";
import { FORUM_REPORTS_PAGE_SIZE } from "@/application";
import { cookieJar } from "@/tests/support/action-policy";
import { makeForumMember, makeForumReply, makeForumReport, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { signInAs } from "@/tests/support/test-auth";
import { testForum } from "@/tests/support/test-forum";

const render = async (searchParams: Record<string, string> = {}) => renderToStaticMarkup(await AdminForumReportsPage({ searchParams: Promise.resolve(searchParams) }));

beforeEach(async () => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  testForum.members.members.set("m1", makeForumMember({ id: "m1", displayName: "Ana", email: "ana@unl.edu.ec", googleSub: "s1" }));
  testForum.members.members.set("m2", makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2" }));
  testForum.store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1", title: "Duda de arrays", body: "<script>alert(1)</script> hola" }));
  testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", body: "Pruebe con map" }));
  cookieJar(cookiesMock, await signInAs("EDITOR"));
});

describe("the forum report queue page", () => {
  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("shows an editor the open reports with the post as text, the reason and the moderation controls, and no email", async () => {
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m2", threadId: "t1", reason: "Es spam" }));

    const html = await render();

    expect(html).toContain("1 reporte abierto");
    expect(html).toContain("Duda de arrays");
    expect(html).toContain("Es spam");
    expect(html).toContain("Publicado por Ana");
    expect(html).toContain("reportado por Beto");
    expect(html).toContain("Ocultar el hilo");
    expect(html).toContain("Cerrar el hilo");
    expect(html).toContain("Suspender la cuenta");
    expect(html).toContain("Marcar como resuelto");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/@unl|googleSub/);
  });

  it("offers to show, reopen and reactivate when the post is hidden, the thread locked and the author suspended", async () => {
    testForum.members.members.set("m2", makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2", status: "SUSPENDED", suspendedAt: new Date() }));
    testForum.store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1", lockedAt: new Date() }));
    testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", hiddenAt: new Date() }));
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m1", threadId: null, replyId: "r1" }));

    const html = await render();

    expect(html).toContain("Mostrar la respuesta");
    expect(html).toContain("Reabrir el hilo");
    expect(html).toContain("Reactivar la cuenta");
    expect(html).not.toContain("Suspender la cuenta");
  });

  it("lists the closed ones apart, with their outcome and note and without the close form", async () => {
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m2", threadId: "t1", status: "RESOLVED", resolvedAt: new Date(), resolvedBy: "u1", resolutionNote: "Ocultado" }));

    const closed = await render({ estado: "cerrados" });

    expect(closed).toContain("1 reporte cerrado");
    expect(closed).toContain("Resuelto");
    expect(closed).toContain("Nota: Ocultado");
    expect(closed).not.toContain("Marcar como resuelto");
    expect(await render()).toContain("No hay reportes abiertos");
  });

  it("paginates, linking the state and the page", async () => {
    for (let index = 0; index <= FORUM_REPORTS_PAGE_SIZE; index += 1) {
      testForum.members.members.set(`x${index}`, makeForumMember({ id: `x${index}`, email: `x${index}@unl.edu.ec`, googleSub: `sx${index}`, displayName: `X${index}` }));
      testForum.store.reports.set(`p${index}`, makeForumReport({ id: `p${index}`, reporterId: `x${index}`, threadId: "t1", createdAt: new Date(2026, 9, 1, 0, index) }));
    }

    const html = await render();

    expect(html).toContain("Página 1 de 2");
    expect(html).toContain('href="/admin/foro/reportes?pagina=2"');
    expect(await render({ pagina: "2" })).toContain('href="/admin/foro/reportes"');
  });

  it("sends a visitor without a session to the login", async () => {
    cookieJar(cookiesMock, undefined);

    await expect(render()).rejects.toThrow("REDIRECT /login");
  });
});
