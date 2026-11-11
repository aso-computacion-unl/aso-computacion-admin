import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";

import { FORUM_SESSION_SECRET as SECRET, plantForumMemberSession } from "./support/forum-session";

/*
 * The forum's UX decisions, through the browser (docs/JOURNEYS.md):
 *   D1 / F1, F10  a suspended member is told so instead of seeing the sign-in, and still gets no forum;
 *   D3 / F6, F7   the throttle names the limit that tripped and the wait in minutes;
 *   D4 / F5       a reply the moderation hid leaves a placeholder, and its text never reaches the browser;
 *   D5 / F6, F7   a session that ends while writing keeps the text and the sign-in comes back to the same page.
 *
 * Opt-in like forum-member.spec.ts: the members and their sessions are planted in the database (a student cannot
 * sign in with Google here), so the app has to know the signing secret:
 *
 *   FORUM_SESSION_SECRET=<at least 32 characters> npm run e2e
 *
 * Every row of this spec carries the `ux-` prefix (ids) or the `ux-foro` category, so what other specs leave
 * behind never gets in the way, and the spec removes its own rows at the end.
 */
const BASE_URL = "http://127.0.0.1:3100";
const prisma = createPrismaClient(process.env.DATABASE_URL);
const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const CATEGORY = { id: "ux-cat", slug: "ux-foro", name: "UX E2E" };
// One thread per test that writes into it, so the replies of one never show in another.
const THREAD = { id: "ux-t1", title: "Hilo de prueba UX" };
const THROTTLE_THREAD = "ux-t2";
const DRAFT_THREAD = "ux-t3";
const HIDDEN_TEXT = "Texto oculto UX que no debe salir";
const HIDDEN_AUTHOR = "Cristóbal Oculto UX";
const PLACEHOLDER = "Respuesta oculta por la moderación";

const MEMBER_IDS = ["ux-author", "ux-hider", "ux-reader", "ux-sus", "ux-fast", "ux-slow", "ux-draft", "ux-late"];

test.skip(!SECRET, "set FORUM_SESSION_SECRET to run the forum UX suite");

test.beforeAll(async () => {
  if (!SECRET) return;

  await cleanUp();
  await prisma.forumCategory.create({ data: { ...CATEGORY, description: "Categoría del e2e de UX", sortOrder: 90, updatedAt: now } });
  await prisma.forumMember.create({ data: { id: "ux-author", email: "ux-author@unl.edu.ec", googleSub: "sub-ux-author", displayName: "Pablo Autor UX" } });
  await prisma.forumMember.create({ data: { id: "ux-hider", email: "ux-hider@unl.edu.ec", googleSub: "sub-ux-hider", displayName: HIDDEN_AUTHOR } });
  for (const [id, title] of [
    [THREAD.id, THREAD.title],
    [THROTTLE_THREAD, "Hilo del límite UX"],
    [DRAFT_THREAD, "Hilo del borrador UX"],
  ] as const) {
    await prisma.forumThread.create({ data: { id, categoryId: CATEGORY.id, authorId: "ux-author", title, body: "Cuerpo del hilo de prueba.", createdAt: ago(180), updatedAt: ago(180), lastActivityAt: ago(10) } });
  }

  const reply = (id: string, authorId: string, body: string, minutes: number, hiddenAt: Date | null = null) =>
    prisma.forumReply.create({ data: { id, threadId: THREAD.id, authorId, body, createdAt: ago(minutes), updatedAt: ago(minutes), hiddenAt } });

  await reply("ux-r1", "ux-author", "Primera respuesta visible UX", 120);
  await reply("ux-r2", "ux-hider", HIDDEN_TEXT, 90, ago(30));
  await reply("ux-r3", "ux-author", "Tercera respuesta visible UX", 60);
});

test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function cleanUp() {
  const posted = { OR: [{ authorId: { in: MEMBER_IDS } }, { threadId: { in: [THREAD.id, THROTTLE_THREAD, DRAFT_THREAD] } }] };

  await prisma.forumReaction.deleteMany({ where: { memberId: { in: MEMBER_IDS } } });
  await prisma.forumReply.deleteMany({ where: posted });
  await prisma.forumThread.deleteMany({ where: { OR: [{ authorId: { in: MEMBER_IDS } }, { categoryId: CATEGORY.id }] } });
  await prisma.forumSession.deleteMany({ where: { memberId: { in: MEMBER_IDS } } });
  await prisma.forumMember.deleteMany({ where: { id: { in: MEMBER_IDS } } });
  await prisma.forumCategory.deleteMany({ where: { id: CATEGORY.id } });
}

async function contextFor(browser: Browser, memberId: string, options: { suspended?: boolean; lifetimeSeconds?: number } = {}): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const session = await plantForumMemberSession(prisma, { memberId, sessionId: `${memberId}-session`, displayName: memberId, ...options });

  await context.addCookies([session.cookie]);

  return context;
}

test("D1 / F10: a suspended member is told so instead of the sign-in, and still gets no forum content", async ({ browser }) => {
  const context = await contextFor(browser, "ux-sus", { suspended: true });
  const page = await context.newPage();

  await page.goto("/foro");
  await expect(page.getByRole("heading", { level: 1, name: "Su cuenta del foro está suspendida" })).toBeVisible();
  await expect(page.getByText("escriba a la directiva de ASO")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Su carrera se resuelve/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Entrar con otra cuenta de Google" })).toBeVisible();
  // Nothing of the forum: no list, no categories, no thread titles, no way to start a thread.
  await expect(page.locator("body")).not.toContainText(CATEGORY.name);
  await expect(page.locator("body")).not.toContainText(THREAD.title);
  await expect(page.getByRole("link", { name: "Nuevo hilo" })).toHaveCount(0);

  // Every other page of the forum ends at the same notice, with no thread and no form.
  for (const path of [`/foro/hilo/${THREAD.id}`, `/foro/c/${CATEGORY.slug}/nuevo`, `/foro?categoria=${CATEGORY.slug}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Su cuenta del foro está suspendida" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(THREAD.title);
    await expect(page.getByLabel("Título")).toHaveCount(0);
    await expect(page.getByLabel("Su respuesta")).toHaveCount(0);
  }

  // The notice is not a way in: the pages above redirected, they did not render the forum for this member.
  const html = await (await page.request.get(`/foro/hilo/${THREAD.id}`)).text();

  expect(html).not.toContain(THREAD.title);
  expect(html).not.toContain("Primera respuesta visible UX");

  await context.close();
});

test("D1 / F1: a visitor and an active member never see the suspension notice", async ({ browser }) => {
  const visitor = await browser.newContext({ baseURL: BASE_URL });
  const visitorPage = await visitor.newPage();

  await visitorPage.goto("/foro");
  await expect(visitorPage.getByRole("heading", { name: /Su carrera se resuelve/ })).toBeVisible();
  await expect(visitorPage.getByText("suspendida")).toHaveCount(0);

  // The cookie of a session that already expired is a visitor's too: the notice is for a live signed cookie only.
  const expired = await contextFor(browser, "ux-late", { suspended: true, lifetimeSeconds: -60 });
  const expiredPage = await expired.newPage();

  await expiredPage.goto("/foro");
  await expect(expiredPage.getByRole("heading", { name: /Su carrera se resuelve/ })).toBeVisible();
  await expect(expiredPage.getByText("suspendida")).toHaveCount(0);

  const active = await contextFor(browser, "ux-reader");
  const activePage = await active.newPage();

  await activePage.goto("/foro");
  await expect(activePage.getByRole("heading", { level: 1, name: "Hilos" })).toBeVisible();
  await expect(activePage.getByText("suspendida")).toHaveCount(0);

  await visitor.close();
  await expired.close();
  await active.close();
});

test("D3 / F7: the throttle says which limit tripped and the wait in minutes", async ({ browser }) => {
  // Three posts in the last minute: the per-minute limit.
  const fast = await contextFor(browser, "ux-fast");
  const fastPage = await fast.newPage();

  await prisma.forumReply.createMany({
    data: [1, 2, 3].map((index) => ({ id: `ux-fast-${index}`, threadId: THROTTLE_THREAD, authorId: "ux-fast", body: `Rápida ${index}`, createdAt: new Date(), updatedAt: new Date() })),
  });
  await fastPage.goto(`/foro/hilo/${THROTTLE_THREAD}`);
  await fastPage.getByLabel("Su respuesta").fill("Una más de la cuenta");
  await fastPage.getByRole("button", { name: "Responder" }).click();

  const fastAlert = fastPage.getByRole("alert").filter({ hasText: "Está publicando muy rápido" });

  await expect(fastAlert).toContainText("el límite es de 3 publicaciones por minuto");
  await expect(fastAlert).toContainText("Puede volver a intentarlo en 1 minuto.");
  await expect(fastAlert).not.toContainText(/\d+ s\b/);
  await expect(fastPage.getByLabel("Su respuesta")).toHaveValue("Una más de la cuenta");

  // Thirty posts in the last hour, none in the last minute: the per-hour limit.
  const slow = await contextFor(browser, "ux-slow");
  const slowPage = await slow.newPage();

  await prisma.forumReply.createMany({
    data: Array.from({ length: 30 }, (_, index) => ({ id: `ux-slow-${index}`, threadId: THROTTLE_THREAD, authorId: "ux-slow", body: `Lenta ${index}`, createdAt: ago(10), updatedAt: ago(10) })),
  });
  await slowPage.goto(`/foro/hilo/${THROTTLE_THREAD}`);
  await slowPage.getByLabel("Su respuesta").fill("Una más de la hora");
  await slowPage.getByRole("button", { name: "Responder" }).click();

  const slowAlert = slowPage.getByRole("alert").filter({ hasText: "Está publicando muy rápido" });

  await expect(slowAlert).toContainText("el límite es de 30 publicaciones por hora");
  await expect(slowAlert).toContainText("Puede volver a intentarlo en 60 minutos.");

  await fast.close();
  await slow.close();
});

test("D4 / F5: a hidden reply leaves a placeholder in its place and its content never reaches the browser", async ({ browser }) => {
  const context = await contextFor(browser, "ux-reader");
  const page = await context.newPage();

  await page.goto(`/foro/hilo/${THREAD.id}`);

  const lane = page.locator("ol.lane");

  await expect(lane.getByText(PLACEHOLDER)).toHaveCount(1);
  await expect(lane.getByText("Primera respuesta visible UX")).toBeVisible();
  await expect(lane.getByText("Tercera respuesta visible UX")).toBeVisible();
  // In its place: between the two visible replies.
  const order = await lane.innerText();

  expect(order.indexOf("Primera respuesta visible UX")).toBeLessThan(order.indexOf(PLACEHOLDER));
  expect(order.indexOf(PLACEHOLDER)).toBeLessThan(order.indexOf("Tercera respuesta visible UX"));
  // The count is of what can be read; the placeholder has no author, no reaction and no actions.
  await expect(page.getByText("2 respuestas")).toBeVisible();
  await expect(page.locator("#respuesta-ux-r2")).toHaveText(PLACEHOLDER);
  await expect(page.locator("#respuesta-ux-r2").getByRole("button")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(HIDDEN_TEXT);
  await expect(page.locator("body")).not.toContainText(HIDDEN_AUTHOR);

  // Not only the markup: the document and its streamed component payload (the props of every client component) carry no trace of it.
  const source = await (await page.request.get(`/foro/hilo/${THREAD.id}`)).text();

  expect(source).toContain("Primera respuesta visible UX");
  expect(source).not.toContain(HIDDEN_TEXT);
  expect(source).not.toContain(HIDDEN_AUTHOR);

  await context.close();
});

test("D5 / F7: a session that ends while writing a reply keeps the text, and the sign-in comes back to the thread", async ({ browser }) => {
  const context = await contextFor(browser, "ux-draft");
  const page = await context.newPage();
  const path = `/foro/hilo/${DRAFT_THREAD}`;

  await page.goto(path);
  await page.getByLabel("Su respuesta").fill("Una respuesta larga que no quiero perder");
  // The session ends (the member signed out in another tab, or it simply expired) while they were writing.
  await prisma.forumSession.update({ where: { id: "ux-draft-session" }, data: { revokedAt: new Date() } });
  await page.getByRole("button", { name: "Responder" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "Inicie sesión para participar en el foro." });

  await expect(alert).toBeVisible();
  await expect(page.getByLabel("Su respuesta")).toHaveValue("Una respuesta larga que no quiero perder");

  const signIn = alert.getByRole("link", { name: "Iniciar sesión" });

  await expect(signIn).toHaveAttribute("href", `/foro?next=${encodeURIComponent(path)}`);
  await signIn.click();
  await expect(page).toHaveURL(`${BASE_URL}/foro?next=${encodeURIComponent(path)}`);
  await expect(page.getByRole("heading", { name: /Su carrera se resuelve/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar con Google" })).toHaveAttribute("href", `/foro/auth/google/start?next=${encodeURIComponent(path)}`);

  // Signing in again (the same member, a live session) brings them to the thread, where the text is waiting.
  await prisma.forumSession.update({ where: { id: "ux-draft-session" }, data: { revokedAt: null } });
  await page.goto(path);
  await expect(page.getByLabel("Su respuesta")).toHaveValue("Una respuesta larga que no quiero perder");

  // Publishing it clears the draft for good.
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText("Respuesta publicada.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Su respuesta")).toHaveValue("");
  await expect(page.getByText("Una respuesta larga que no quiero perder")).toBeVisible();

  await context.close();
});

test("D5 / F6: a session that ends while writing a new thread keeps the title and the text, and the sign-in comes back to the form", async ({ browser }) => {
  const context = await contextFor(browser, "ux-draft");
  const page = await context.newPage();
  const path = `/foro/c/${CATEGORY.slug}/nuevo`;

  await prisma.forumSession.update({ where: { id: "ux-draft-session" }, data: { revokedAt: null } });
  await page.goto(path);
  await page.getByLabel("Título").fill("Un hilo que escribí con calma");
  await page.getByLabel("Texto (Markdown)").fill("Mucho texto que **no** quiero volver a escribir.");
  await prisma.forumSession.update({ where: { id: "ux-draft-session" }, data: { revokedAt: new Date() } });
  await page.getByRole("button", { name: "Publicar hilo" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "Inicie sesión para participar en el foro." });

  await expect(alert).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue("Un hilo que escribí con calma");
  await expect(alert.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", `/foro?next=${encodeURIComponent(path)}`);

  await prisma.forumSession.update({ where: { id: "ux-draft-session" }, data: { revokedAt: null } });
  await page.goto(path);
  await expect(page.getByLabel("Título")).toHaveValue("Un hilo que escribí con calma");
  await expect(page.getByLabel("Texto (Markdown)")).toHaveValue("Mucho texto que **no** quiero volver a escribir.");

  await page.getByRole("button", { name: "Publicar hilo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Un hilo que escribí con calma" })).toBeVisible();

  // Published: the next time the form opens it is empty.
  await page.goto(path);
  await expect(page.getByLabel("Título")).toHaveValue("");

  await context.close();
});
