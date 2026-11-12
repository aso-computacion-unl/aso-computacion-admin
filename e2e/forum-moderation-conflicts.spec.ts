import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

import { FORUM_SESSION_SECRET as SECRET, plantForumMemberSession } from "./support/forum-session";

/*
 * F11 (docs/JOURNEYS.md): the report queue when two moderators work at once, and the actions forum-moderation.spec.ts
 * does not walk: the empty queue, closing and opening a thread, showing a hidden post again, and a target that is gone.
 * "Another moderator got there first" is played the way forum-members-admin.spec.ts plays it: the page is loaded, the
 * row is changed straight in the database, and then the page's button is pressed.
 *
 * The rows carry the `fmc-` prefix and each test plants its own, so the queue holds one report ("1 de 1"). To see an
 * empty queue the spec first removes every report in the database (they are test data, planted by specs that have
 * finished: each spec plants what it needs in its own `beforeAll`) and removes its own rows and audit entries after each test.
 * The student half of two tests needs a planted member session, so it is opt-in like forum-member.spec.ts:
 *
 *   FORUM_SESSION_SECRET=<at least 32 characters> npm run e2e
 */
const prisma = createPrismaClient(process.env.DATABASE_URL);
const EDITOR_SESSION = process.env.E2E_EDITOR_SESSION ?? "";
const BASE_URL = "http://127.0.0.1:3100";
const QUEUE = "/admin/foro/reportes";
const ID_PREFIX = "fmc-";
const CATEGORY_ID = "fmc-cat";
const MODERATOR_ID = "fmc-other-moderator";
const ALREADY_DONE = "Sin cambios: otra persona ya lo había hecho.";

const ids = (name: string) => ({ thread: `fmc-${name}-thread`, report: `fmc-${name}-report` });

test.beforeAll(async () => {
  expect(EDITOR_SESSION, "run the suite with `npm run e2e`").not.toBe("");
  await cleanUp();
  await prisma.forumReport.deleteMany();

  const now = new Date();

  await prisma.forumCategory.create({ data: { id: CATEGORY_ID, slug: "fmc-cat", name: "Conflictos (e2e)", sortOrder: 97, updatedAt: now } });
  await prisma.forumMember.create({ data: { id: "fmc-author", email: "fmc-author@unl.edu.ec", googleSub: "sub-fmc-author", displayName: "Autora Conflictos" } });
  await prisma.forumMember.create({ data: { id: "fmc-reporter", email: "fmc-reporter@unl.edu.ec", googleSub: "sub-fmc-reporter", displayName: "Quien reporta Conflictos" } });
});

test.afterAll(async () => {
  await cleanUp();
  await prisma.forumCategory.deleteMany({ where: { id: CATEGORY_ID } });
  await prisma.forumMember.deleteMany({ where: { id: { startsWith: ID_PREFIX } } });
  await prisma.$disconnect();
});

test.afterEach(cleanUp);

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "admin_session", value: EDITOR_SESSION, url: BASE_URL }]);
});

async function cleanUp() {
  await prisma.forumThread.deleteMany({ where: { id: { startsWith: ID_PREFIX } } });
  await prisma.forumSession.deleteMany({ where: { memberId: { startsWith: ID_PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { startsWith: ID_PREFIX } } });
}

/** One thread with one open report on it, the only report in the queue. */
async function seedReport(name: string, thread: { hiddenAt?: Date; lockedAt?: Date } = {}) {
  const { thread: threadId, report: reportId } = ids(name);
  const now = new Date();

  await prisma.forumThread.create({
    data: { id: threadId, categoryId: CATEGORY_ID, authorId: "fmc-author", title: `Hilo ${name} (conflictos)`, body: "Texto del hilo reportado.", updatedAt: now, lastActivityAt: now, ...thread },
  });
  await prisma.forumReport.create({ data: { id: reportId, reporterId: "fmc-reporter", threadId, reason: `Motivo ${name}` } });

  return { threadId, reportId };
}

const auditActions = async (entityId: string) => (await prisma.auditLog.findMany({ where: { entityId }, orderBy: { at: "asc" } })).map((entry) => entry.action);

/** The card of the one report in the queue is on screen with its reason. */
async function openQueue(page: Page, name: string) {
  await page.goto(QUEUE);
  await expect(page.getByText("1 de 1")).toBeVisible();
  await expect(page.getByText(`Motivo ${name}`)).toBeVisible();
}

test("an empty queue says so on both tabs, and a report closed by the editor moves from one to the other", async ({ page }) => {
  await page.goto(QUEUE);
  await expect(page.getByText("No hay reportes abiertos")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Abiertos/ })).toContainText("0");
  await expect(page.getByRole("link", { name: /^Cerrados/ })).toContainText("0");
  await page.getByRole("link", { name: /^Cerrados/ }).click();
  await expect(page.getByText("Todavía no se cerró ningún reporte.")).toBeVisible();

  const { reportId } = await seedReport("cierra");

  await openQueue(page, "cierra");
  await expect(page.getByRole("link", { name: /^Abiertos/ })).toContainText("1");
  await page.getByRole("button", { name: "Ignorar" }).click();
  await expect(page.getByText("Reporte descartado.")).toBeVisible();
  await expect(page.getByText("No hay reportes abiertos")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Abiertos/ })).toContainText("0");
  await expect(page.getByRole("link", { name: /^Cerrados/ })).toContainText("1");
  expect(await auditActions(reportId)).toEqual(["forum.report.dismiss"]);
});

test("a report another moderator closed meanwhile is refused with a message, changes nothing and audits nothing", async ({ page }) => {
  const { reportId } = await seedReport("carrera");

  await openQueue(page, "carrera");
  // The other moderator ignored it, with a note, after this page was loaded.
  const closedAt = new Date("2026-11-01T15:00:00Z");

  await prisma.forumReport.update({ where: { id: reportId }, data: { status: "DISMISSED", resolvedAt: closedAt, resolvedBy: MODERATOR_ID, resolutionNote: "Ya visto" } });

  await page.getByLabel("Nota (opcional)").fill("Mi nota");
  await page.getByRole("button", { name: "Marcar como resuelto" }).click();
  await expect(page.getByText("Otra persona ya cerró este reporte.")).toBeVisible();
  await expect(page.getByText("Reporte resuelto.")).toHaveCount(0);

  // The first decision stands: status, time, who and note are the other moderator's.
  expect(await prisma.forumReport.findUniqueOrThrow({ where: { id: reportId } })).toMatchObject({ status: "DISMISSED", resolvedAt: closedAt, resolvedBy: MODERATOR_ID, resolutionNote: "Ya visto" });
  expect(await auditActions(reportId)).toEqual([]);

  // Ignoring it from the same stale card is refused the same way.
  await page.getByRole("button", { name: "Ignorar" }).click();
  await expect(page.getByText("Otra persona ya cerró este reporte.")).toBeVisible();
  expect(await auditActions(reportId)).toEqual([]);

  // A fresh load shows the real state: nothing open, and the report under Cerrados with the other moderator's note.
  await page.goto(QUEUE);
  await expect(page.getByText("No hay reportes abiertos")).toBeVisible();
  await page.getByRole("link", { name: /^Cerrados/ }).click();
  await expect(page.getByText("Nota: Ya visto")).toBeVisible();
  await expect(page.getByText("Descartado", { exact: true })).toBeVisible();
});

test("hiding or closing a thread that is already hidden or closed says nothing changed, audits nothing and refreshes the card to the real state", async ({ page }) => {
  const { threadId } = await seedReport("repetido");

  await openQueue(page, "repetido");
  await expect(page.getByRole("button", { name: "Ocultar" })).toBeVisible();
  // Another moderator hid it after this page was loaded.
  await prisma.forumThread.update({ where: { id: threadId }, data: { hiddenAt: new Date() } });

  await page.getByRole("button", { name: "Ocultar" }).click();
  await expect(page.getByText(ALREADY_DONE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mostrar" })).toBeVisible();
  await expect(page.getByText("Oculto", { exact: true })).toBeVisible();
  expect(await auditActions(threadId)).toEqual([]);

  // And another closed it after the card was refreshed.
  await expect(page.getByRole("button", { name: "Cerrar el hilo" })).toBeVisible();
  await prisma.forumThread.update({ where: { id: threadId }, data: { lockedAt: new Date() } });

  await page.getByRole("button", { name: "Cerrar el hilo" }).click();
  await expect(page.getByText(ALREADY_DONE).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Reabrir el hilo" })).toBeVisible();
  await expect(page.getByText("Hilo cerrado", { exact: true })).toBeVisible();
  expect(await auditActions(threadId)).toEqual([]);
});

test("a post, a thread or an account that disappeared meanwhile is told as not found, not as a crash", async ({ page }) => {
  const { threadId, reportId } = await seedReport("borrado");

  await openQueue(page, "borrado");
  // The thread (and with it the report) is deleted after this page was loaded.
  await prisma.forumThread.delete({ where: { id: threadId } });

  const gone = "No se encontró la publicación, el reporte o la cuenta. Puede que ya no exista.";

  await page.getByRole("button", { name: "Ocultar" }).click();
  await expect(page.getByText(gone)).toBeVisible();
  await page.getByRole("button", { name: "Marcar como resuelto" }).click();
  await expect(page.getByText(gone).first()).toBeVisible();
  await page.getByRole("button", { name: "Cerrar el hilo" }).click();
  await expect(page.getByText(gone).first()).toBeVisible();
  expect(await auditActions(reportId)).toEqual([]);
  expect(await auditActions(threadId)).toEqual([]);

  await page.goto(QUEUE);
  await expect(page.getByText("No hay reportes abiertos")).toBeVisible();
});

test("closing and reopening a thread, and hiding and showing it again, are applied, announced and audited one by one", async ({ page }) => {
  const { threadId } = await seedReport("alterna");

  await openQueue(page, "alterna");

  await page.getByRole("button", { name: "Cerrar el hilo" }).click();
  await expect(page.getByText("Hilo cerrado: ya no admite respuestas ni cambios.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reabrir el hilo" })).toBeVisible();
  await expect(page.getByText("Hilo cerrado", { exact: true })).toBeVisible();
  expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: threadId } })).lockedAt).not.toBeNull();

  await page.getByRole("button", { name: "Reabrir el hilo" }).click();
  await expect(page.getByText("Hilo reabierto.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar el hilo" })).toBeVisible();
  expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: threadId } })).lockedAt).toBeNull();

  await page.getByRole("button", { name: "Ocultar" }).click();
  await expect(page.getByText("Publicación oculta para los estudiantes.")).toBeVisible();
  await page.getByRole("button", { name: "Mostrar" }).click();
  await expect(page.getByText("Publicación visible de nuevo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ocultar" })).toBeVisible();
  expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: threadId } })).hiddenAt).toBeNull();

  expect(await auditActions(threadId)).toEqual(["forum.thread.lock", "forum.thread.unlock", "forum.thread.hide", "forum.thread.unhide"]);
});

test.describe("what the student sees of the moderator's decisions", () => {
  test.skip(!SECRET, "set FORUM_SESSION_SECRET to run the signed-in forum suite");

  test("a closed thread reads closed and takes no reply, a hidden one is not found, and both come back when the moderator undoes them", async ({ browser, page }) => {
    const { threadId } = await seedReport("alumno");
    const student = await browser.newContext({ baseURL: BASE_URL });
    const session = await plantForumMemberSession(prisma, { memberId: "fmc-reader", sessionId: "fmc-reader-session", displayName: "Lector Conflictos" });

    await student.addCookies([session.cookie]);

    const reading = await student.newPage();

    await reading.goto(`/foro/hilo/${threadId}`);
    await expect(reading.getByRole("heading", { level: 1, name: "Hilo alumno (conflictos)" })).toBeVisible();
    await expect(reading.getByLabel("Su respuesta")).toBeVisible();

    await openQueue(page, "alumno");
    await page.getByRole("button", { name: "Cerrar el hilo" }).click();
    await expect(page.getByText("Hilo cerrado: ya no admite respuestas ni cambios.")).toBeVisible();
    await reading.reload();
    await expect(reading.getByText("Hilo cerrado por la moderación")).toBeVisible();
    await expect(reading.getByLabel("Su respuesta")).toHaveCount(0);

    await page.getByRole("button", { name: "Ocultar" }).click();
    await expect(page.getByText("Publicación oculta para los estudiantes.")).toBeVisible();
    expect((await reading.goto(`/foro/hilo/${threadId}`))?.status()).toBe(404);
    await expect(reading.getByText("Esta página del foro no existe, ya no está disponible o la dirección cambió.")).toBeVisible();

    await page.getByRole("button", { name: "Mostrar" }).click();
    await expect(page.getByText("Publicación visible de nuevo.")).toBeVisible();
    // Let the card finish refreshing before the next action, as a person would.
    await expect(page.getByRole("button", { name: "Ocultar" })).toBeVisible();
    await page.getByRole("button", { name: "Reabrir el hilo" }).click();
    await expect(page.getByText("Hilo reabierto.")).toBeVisible();
    await reading.goto(`/foro/hilo/${threadId}`);
    await expect(reading.getByRole("heading", { level: 1, name: "Hilo alumno (conflictos)" })).toBeVisible();
    await expect(reading.getByLabel("Su respuesta")).toBeVisible();

    await student.close();
  });
});
