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

const addMember = (id: string) => testForum.members.members.set(id, makeForumMember({ id, email: `${id}@unl.edu.ec`, googleSub: `s${id}`, displayName: `X${id}` }));

/** `count` open reports on thread t1, the first oldest, each by a different reporter. */
function addReports(count: number) {
  for (let index = 0; index < count; index += 1) {
    addMember(`x${index}`);
    testForum.store.reports.set(`p${index}`, makeForumReport({ id: `p${index}`, reporterId: `x${index}`, threadId: "t1", reason: `Motivo ${index}`, createdAt: new Date(2026, 9, 1, 0, index) }));
  }
}

describe("the forum report queue page", () => {
  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("shows an editor one open report: the post as text, who wrote it, who reported it and why, and no email", async () => {
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m2", threadId: "t1", reason: "Es spam" }));

    const html = await render();

    expect(html).toContain("Duda de arrays");
    expect(html).toContain("Es spam");
    expect(html).toContain("Publicado por Ana");
    expect(html).toContain("reportado por Beto");
    expect(html).toContain("Hilo");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/@unl|googleSub/);
  });

  it("names a reply report as a reply and quotes the reply", async () => {
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m1", threadId: null, replyId: "r1" }));

    const html = await render();

    expect(html).toContain("Respuesta");
    expect(html).toContain("Pruebe con map");
    expect(html).toContain("Publicado por Beto");
  });

  it("shows only the first of several, with its position and a link to the next one", async () => {
    addReports(3);

    const html = await render();

    expect(html).toContain("Motivo 0");
    expect(html).not.toContain("Motivo 1");
    expect(html).toContain("1 de 3");
    expect(html).toContain('href="/admin/foro/reportes?n=2"');
    expect(html).not.toContain("Anterior");
  });

  it("shows the one asked for with links both ways, and the last one without a next", async () => {
    addReports(3);

    const middle = await render({ n: "2" });
    const last = await render({ n: "3" });

    expect(middle).toContain("Motivo 1");
    expect(middle).toContain("2 de 3");
    expect(middle).toContain('href="/admin/foro/reportes"');
    expect(middle).toContain('href="/admin/foro/reportes?n=3"');
    expect(last).toContain("Motivo 2");
    expect(last).toContain("3 de 3");
    expect(last).toContain('href="/admin/foro/reportes?n=2"');
    expect(last).not.toContain("Siguiente");
  });

  it("clamps a position past the end to the last report, and reaches reports beyond the first read page", async () => {
    addReports(FORUM_REPORTS_PAGE_SIZE + 1);

    const last = await render({ n: String(FORUM_REPORTS_PAGE_SIZE + 1) });

    expect(last).toContain(`Motivo ${FORUM_REPORTS_PAGE_SIZE}<`);
    expect(last).toContain(`${FORUM_REPORTS_PAGE_SIZE + 1} de ${FORUM_REPORTS_PAGE_SIZE + 1}`);
    expect(await render({ n: "999" })).toContain(`${FORUM_REPORTS_PAGE_SIZE + 1} de ${FORUM_REPORTS_PAGE_SIZE + 1}`);
    expect(await render({ n: "abc" })).toContain("1 de ");
  });

  it("offers Ocultar, Ignorar, Suspender and the quieter steps, plus the way to the public thread", async () => {
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m2", threadId: "t1" }));

    const html = await render();

    expect(html).toContain("Ocultar");
    expect(html).toContain("Ignorar");
    expect(html).toContain("Suspender…");
    expect(html).toContain("Cerrar el hilo");
    expect(html).toContain("Marcar como resuelto");
    expect(html).toContain('href="/foro/hilo/t1"');
    expect(html).toContain("Ver el hilo completo");
    expect(html).not.toContain("Mostrar");
    expect(html).not.toContain("Reactivar");
  });

  it("offers to show, reopen and reactivate, and stamps each state, when the post is hidden, the thread locked and the author suspended", async () => {
    testForum.members.members.set("m2", makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2", status: "SUSPENDED", suspendedAt: new Date() }));
    testForum.store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1", lockedAt: new Date() }));
    testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", hiddenAt: new Date() }));
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m1", threadId: null, replyId: "r1" }));

    const html = await render();

    expect(html).toContain("Mostrar");
    expect(html).toContain("Reabrir el hilo");
    expect(html).toContain("Reactivar la cuenta");
    expect(html).not.toContain("Suspender…");
    expect(html).toContain("Oculto");
    expect(html).toContain("Hilo cerrado");
    expect(html).toContain("Autor suspendido");
  });

  it("says there are no open reports when the queue is empty", async () => {
    const html = await render();

    expect(html).toContain("No hay reportes abiertos");
    expect(html).not.toContain("Marcar como resuelto");
    expect(html).not.toContain("de 0");
  });

  it("counts both queues in the tabs", async () => {
    addReports(2);
    testForum.store.reports.set("c1", makeForumReport({ id: "c1", reporterId: "m2", threadId: "t1", status: "DISMISSED", resolvedAt: new Date(), resolvedBy: "u1" }));

    const html = await render();

    expect(html).toMatch(/Abiertos[^<]*<span[^>]*>2</);
    expect(html).toMatch(/Cerrados[^<]*<span[^>]*>1</);
  });

  it("lists the closed ones compactly, with their outcome and note and without the moderation buttons", async () => {
    testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m2", threadId: "t1", status: "RESOLVED", resolvedAt: new Date(), resolvedBy: "u1", resolutionNote: "Ocultado" }));
    testForum.store.reports.set("p2", makeForumReport({ id: "p2", reporterId: "m1", threadId: null, replyId: "r1", status: "DISMISSED", resolvedAt: new Date(), resolvedBy: "u1" }));

    const closed = await render({ estado: "cerrados" });

    expect(closed).toContain("Duda de arrays");
    expect(closed).toContain("Resuelto");
    expect(closed).toContain("Descartado");
    expect(closed).toContain("Cerrado el");
    expect(closed).toContain("Nota: Ocultado");
    expect(closed).not.toContain("Marcar como resuelto");
    expect(closed).not.toContain("Ignorar");
    expect(closed).not.toContain(" de 2");
  });

  it("says nothing was closed yet when the closed list is empty", async () => {
    expect(await render({ estado: "cerrados" })).toContain("Todavía no se cerró ningún reporte");
  });

  it("paginates the closed list, linking the state and the page", async () => {
    for (let index = 0; index <= FORUM_REPORTS_PAGE_SIZE; index += 1) {
      addMember(`x${index}`);
      testForum.store.reports.set(`p${index}`, makeForumReport({ id: `p${index}`, reporterId: `x${index}`, threadId: "t1", status: "DISMISSED", resolvedAt: new Date(2026, 9, 1, 0, index), resolvedBy: "u1" }));
    }

    const html = await render({ estado: "cerrados" });

    expect(html).toContain("Página 1 de 2");
    expect(html).toContain('href="/admin/foro/reportes?estado=cerrados&amp;pagina=2"');
    expect(await render({ estado: "cerrados", pagina: "2" })).toContain('href="/admin/foro/reportes?estado=cerrados"');
  });

  it("gives an administrator the link to the categories, and an editor none", async () => {
    expect(await render()).not.toContain("/admin/foro/categorias");

    cookieJar(cookiesMock, await signInAs("ADMIN"));

    const html = await render();

    expect(html).toContain('href="/admin/foro/categorias"');
    expect(html).toContain("Categorías");
  });

  it("sends a visitor without a session to the login", async () => {
    cookieJar(cookiesMock, undefined);

    await expect(render()).rejects.toThrow("REDIRECT /login");
  });
});
