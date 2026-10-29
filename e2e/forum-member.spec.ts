import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

/*
 * The signed-in forum, through the real UI and the real database. Opt-in: a forum session cannot be
 * obtained without a real Google account, so this suite plants one (a member and a session row, and the
 * signed cookie) and therefore needs the app to know the signing secret:
 *
 *   FORUM_SESSION_SECRET=<at least 32 characters> npm run e2e
 *
 * Without the variable the whole file is skipped. The harness then also sets FORUM_ALLOWED_EMAIL_DOMAIN (the
 * members here are @unl.edu.ec, and registering for an event needs the domain), but never a Google client, so
 * the login stays off and forum.spec.ts still sees "unavailable".
 */
const SECRET = process.env.FORUM_SESSION_SECRET ?? "";
const BASE_URL = "http://127.0.0.1:3100";
const SCREENSHOT_DIR = process.env.FORUM_E2E_SHOTS;
const prisma = new PrismaClient();
const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

let token = "";

test.skip(!SECRET, "set FORUM_SESSION_SECRET to run the signed-in forum suite");

test.beforeAll(async () => {
  if (!SECRET) return;

  for (const { id, name } of [{ id: "m1", name: "Daniela P." }, { id: "m2", name: "Mateo R." }]) {
    await prisma.forumMember.create({ data: { id, email: `${id}@unl.edu.ec`, googleSub: `sub-${id}`, displayName: name } });
  }
  await prisma.forumCategory.create({ data: { id: "c-prog", slug: "programacion", name: "Programación", description: "Código y errores", sortOrder: 0, updatedAt: now } });

  const thread = (id: string, title: string, over: Record<string, unknown> = {}) =>
    prisma.forumThread.create({ data: { id, categoryId: "c-prog", authorId: "m2", title, body: "Mi programa revienta al final.\n\n```\nfree(nodo);\n```", createdAt: ago(120), updatedAt: ago(120), lastActivityAt: ago(12), ...over } });

  await thread("t-solved", "Segmentation fault al liberar la lista");
  await prisma.forumReply.create({ data: { id: "r-best", threadId: "t-solved", authorId: "m1", body: "Guarde el siguiente **antes** de liberar.", createdAt: ago(60), updatedAt: ago(60) } });
  await prisma.forumThread.update({ where: { id: "t-solved" }, data: { bestReplyId: "r-best" } });
  await thread("t-open", "¿Cómo configuro WSL2?");
  await thread("t-locked", "Ideas para el hackatón", { lockedAt: ago(5) });
  await thread("t-mine", "Mi duda sobre punteros", { authorId: "m1" });
  await prisma.forumReply.create({ data: { id: "r-help", threadId: "t-mine", authorId: "m2", body: "Revise el **orden** de los `free`.", createdAt: ago(30), updatedAt: ago(30) } });

  await prisma.forumSession.create({ data: { id: "s1", memberId: "m1", expiresAt: new Date(now.getTime() + 3_600_000), lastSeenAt: now } });
  const issued = Math.floor(Date.now() / 1000);
  token = await new SignJWT({ sid: "s1", mid: "m1", typ: "forum-session" })
    .setSubject("m1")
    .setAudience("aso-computacion-forum")
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issued)
    .setExpirationTime(issued + 3600)
    .sign(new TextEncoder().encode(SECRET));
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function memberContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, baseURL: BASE_URL });

  await context.addCookies([{ name: "forum_session", value: token, domain: "127.0.0.1", path: "/foro" }]);

  return context;
}

test("every member screen fits a 375 px phone, and the Abiertos / Resueltos tabs split the threads", async ({ browser }) => {
  const context = await memberContext(browser);
  const page = await context.newPage();

  for (const path of ["/foro", "/foro?categoria=programacion", "/foro/hilo/t-solved", "/foro/hilo/t-locked", "/foro/c/programacion/nuevo", "/foro/hilo/does-not-exist"]) {
    await page.goto(path);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    expect(overflow, path).toBeLessThanOrEqual(0);
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/${path.replace(/\W+/g, "_")}.png`, fullPage: true });
  }

  // The old category URL lands on the home list with that category active.
  await page.goto("/foro/c/programacion");
  await expect(page).toHaveURL(/\/foro\?categoria=programacion$/);
  await expect(page.getByRole("link", { name: /¿Cómo configuro WSL2\?/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Segmentation fault/ })).toHaveCount(0);

  await page.getByRole("link", { name: /Resueltos/ }).click();
  await expect(page).toHaveURL(/\/foro\?categoria=programacion&estado=resueltos$/);
  await expect(page.getByRole("link", { name: /Segmentation fault/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /¿Cómo configuro WSL2\?/ })).toHaveCount(0);

  // The home is the same list across categories, with the same tabs.
  await page.goto("/foro");
  await expect(page.getByRole("heading", { level: 1, name: "Hilos" })).toBeVisible();
  await expect(page.getByRole("link", { name: /¿Cómo configuro WSL2\?/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Segmentation fault/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Resueltos/ }).click();
  await expect(page).toHaveURL(/\/foro\?estado=resueltos$/);
  await expect(page.getByRole("link", { name: /Segmentation fault/ })).toBeVisible();

  // An open thread says so in words, like a solved one.
  await page.goto("/foro/hilo/t-open");
  await expect(page.getByText("Abierto", { exact: true })).toBeVisible();

  await page.goto("/foro/hilo/t-locked");
  await expect(page.getByText("Hilo cerrado por la moderación")).toBeVisible();
  await expect(page.getByLabel("Su respuesta")).toHaveCount(0);

  await context.close();
});

test("a member reacts to a reply, marks the best answer of their thread and reports someone else's post", async ({ browser }) => {
  const context = await memberContext(browser);
  const page = await context.newPage();

  // «Me sirvió» is a toggle that survives a reload.
  await page.goto("/foro/hilo/t-mine");
  const helpful = page.getByRole("button", { name: /Me sirvió/ });
  await expect(helpful).toHaveAttribute("aria-pressed", "false");
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "true");
  await expect(helpful).toContainText("1");
  // The button answers before the server does: wait for the row before leaving the page.
  await expect.poll(() => prisma.forumReaction.count({ where: { replyId: "r-help" } })).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: /Me sirvió/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Me sirvió/ }).click();
  await expect(page.getByRole("button", { name: /Me sirvió/ })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => prisma.forumReaction.count({ where: { replyId: "r-help" } })).toBe(0);

  // The author of the thread marks the best answer and takes the mark back. Their own post has no «Reportar».
  await expect(page.getByRole("button", { name: "Reportar" })).toHaveCount(1);
  await page.getByRole("button", { name: "Marcar como mejor respuesta" }).click();
  await expect(page.getByRole("link", { name: "Resuelto" })).toBeVisible();
  await expect(page.getByText("Mejor respuesta", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quitar de mejor respuesta" }).click();
  await expect(page.getByRole("button", { name: "Marcar como mejor respuesta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Resuelto" })).toHaveCount(0);

  // Reporting someone else's thread: a reason, a note, a confirmation; a second report is told as already sent.
  await page.goto("/foro/hilo/t-open");
  await expect(page.getByRole("button", { name: "Marcar como mejor respuesta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Reportar" }).click();
  await page.getByLabel("Motivo").selectOption({ label: "Fuera de tema" });
  await page.getByLabel("Nota (opcional)").fill("No tiene que ver con programación");
  await page.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByText("Reporte enviado. La moderación lo revisará.")).toBeVisible();
  expect(await prisma.forumReport.findMany({ where: { threadId: "t-open" }, select: { reporterId: true, reason: true, status: true } })).toEqual([
    { reporterId: "m1", reason: "Fuera de tema: No tiene que ver con programación", status: "OPEN" },
  ]);

  await page.reload();
  await page.getByRole("button", { name: "Reportar" }).click();
  await page.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByText("Ya reportó esta publicación. La moderación la revisará.")).toBeVisible();
  expect(await prisma.forumReport.count({ where: { threadId: "t-open" } })).toBe(1);

  await context.close();
});

test("a member publishes a thread and a reply, signs out, and a suspended member is refused", async ({ browser }) => {
  const context = await memberContext(browser);
  const page = await context.newPage();

  await page.goto("/foro");
  await page.getByRole("link", { name: "Programación", exact: true }).click();
  // The list header and the empty end of the list both offer it: the header one is the first.
  await page.getByRole("link", { name: "Nuevo hilo" }).first().click();
  await page.getByLabel("Título").fill("Hilo creado desde el e2e");
  await page.getByLabel("Texto (Markdown)").fill("Un texto con **negrita** y\n\n```js\nconsole.log(1);\n```");
  await expect(page.locator("pre").first()).toContainText("console.log(1);");
  await page.getByRole("button", { name: "Publicar hilo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hilo creado desde el e2e" })).toBeVisible();

  // The reply appears in the thread without leaving the page, and an empty one is refused next to its field.
  await page.getByLabel("Su respuesta").fill("Mi primera respuesta");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText("Respuesta publicada.")).toBeVisible();
  await expect(page.getByText("Mi primera respuesta")).toBeVisible();
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByLabel("Su respuesta")).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: /^Menú de cuenta: Daniela P\./ }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("link", { name: "Entrar con Google" })).toBeVisible();

  // The same cookie again, for a member the moderation suspended in the meantime: the session no longer counts.
  await context.addCookies([{ name: "forum_session", value: token, domain: "127.0.0.1", path: "/foro" }]);
  await prisma.forumSession.update({ where: { id: "s1" }, data: { revokedAt: null } });
  await prisma.forumMember.update({ where: { id: "m1" }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
  await page.goto("/foro");
  await expect(page.getByRole("link", { name: "Entrar con Google" })).toBeVisible();

  await context.close();
});
