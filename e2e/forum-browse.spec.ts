import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";

import { FORUM_SESSION_SECRET as SECRET, plantForumMemberSession } from "./support/forum-session";

/*
 * F4 / F5 (docs/JOURNEYS.md): browsing the thread list at its edges, through the browser as a signed-in member.
 *   - the four empty states of a category (no threads at all, none open, none solved) and their way out;
 *   - paging: 20 threads a page, and a page past the end shows the last one;
 *   - an unknown category, an unknown or hidden thread and any other /foro address are a 404 inside the forum.
 * (The empty states of the whole forum, "Todavía no hay categorías.", need a database with no category at all, which
 * a shared e2e database never is; they are covered by the unit test of the forum home page.)
 *
 * Opt-in like forum-member.spec.ts (a planted member session needs the signing secret):
 *
 *   FORUM_SESSION_SECRET=<at least 32 characters> npm run e2e
 *
 * Every row carries the `fb-` prefix and the categories are narrowed to by their own slug, so what other specs left
 * behind never gets in the way; the spec removes its rows at the end.
 */
const BASE_URL = "http://127.0.0.1:3100";
const prisma = createPrismaClient(process.env.DATABASE_URL);
const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const MEMBER_ID = "fb-member";
const CATEGORIES = {
  empty: { id: "fb-cat-empty", slug: "fb-vacia", name: "Vacía FB" },
  solved: { id: "fb-cat-solved", slug: "fb-resueltos", name: "Resueltos FB" },
  open: { id: "fb-cat-open", slug: "fb-abiertos", name: "Abiertos FB" },
  long: { id: "fb-cat-long", slug: "fb-larga", name: "Larga FB" },
} as const;
const PAGE_SIZE = 20;
const LONG_THREADS = PAGE_SIZE + 5;
const HIDDEN_THREAD = "fb-t-hidden";

test.skip(!SECRET, "set FORUM_SESSION_SECRET to run the signed-in forum suite");

test.beforeAll(async () => {
  if (!SECRET) return;

  await cleanUp();
  await prisma.forumMember.create({ data: { id: "fb-author", email: "fb-author@unl.edu.ec", googleSub: "sub-fb-author", displayName: "Autor FB" } });

  let order = 80;

  for (const category of Object.values(CATEGORIES)) {
    await prisma.forumCategory.create({ data: { ...category, description: `Categoría ${category.name}`, sortOrder: order++, updatedAt: now } });
  }

  const thread = (id: string, categoryId: string, title: string, minutes: number, over: Record<string, unknown> = {}) =>
    prisma.forumThread.create({ data: { id, categoryId, authorId: "fb-author", title, body: "Cuerpo del hilo.", createdAt: ago(minutes), updatedAt: ago(minutes), lastActivityAt: ago(minutes), ...over } });

  // A category whose only thread is solved, one whose only thread is open, and one with a page and a bit.
  await thread("fb-t-solved", CATEGORIES.solved.id, "Hilo resuelto FB", 30);
  await prisma.forumReply.create({ data: { id: "fb-r-best", threadId: "fb-t-solved", authorId: "fb-author", body: "La respuesta.", createdAt: ago(20), updatedAt: ago(20) } });
  await prisma.forumThread.update({ where: { id: "fb-t-solved" }, data: { bestReplyId: "fb-r-best" } });
  await thread("fb-t-open", CATEGORIES.open.id, "Hilo abierto FB", 30);
  // Newest first: "Larga 01" is the most recent, "Larga 25" the oldest, so page 2 holds 21 to 25.
  for (let index = 1; index <= LONG_THREADS; index++) {
    await thread(`fb-t-long-${index}`, CATEGORIES.long.id, `Larga ${String(index).padStart(2, "0")}`, 100 + index);
  }
  await thread(HIDDEN_THREAD, CATEGORIES.open.id, "Hilo oculto FB", 40, { hiddenAt: ago(5) });
});

test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function cleanUp() {
  const categoryIds = Object.values(CATEGORIES).map((category) => category.id);

  await prisma.forumThread.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await prisma.forumSession.deleteMany({ where: { memberId: { in: [MEMBER_ID, "fb-author"] } } });
  await prisma.forumMember.deleteMany({ where: { id: { in: [MEMBER_ID, "fb-author"] } } });
  await prisma.forumCategory.deleteMany({ where: { id: { in: categoryIds } } });
}

async function memberContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const session = await plantForumMemberSession(prisma, { memberId: MEMBER_ID, sessionId: "fb-session", displayName: "Lectora FB" });

  await context.addCookies([session.cookie]);

  return context;
}

test("F4: a category without threads, one without open threads and one without solved ones each say so and offer to start a thread", async ({ browser }) => {
  const context = await memberContext(browser);
  const page = await context.newPage();

  // Nothing at all in the category: the same message on both tabs.
  for (const path of [`/foro?categoria=${CATEGORIES.empty.slug}`, `/foro?categoria=${CATEGORIES.empty.slug}&estado=resueltos`]) {
    await page.goto(path);

    await expect(page.getByText(`Todavía no hay hilos en ${CATEGORIES.empty.name}.`), path).toBeVisible();
    await expect(page.getByText("Sea la primera persona en abrir uno."), path).toBeVisible();
    // The header button and the one in the empty list both lead to the new-thread form of this category.
    await expect(page.getByRole("link", { name: "Nuevo hilo" }), path).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Nuevo hilo" }).last(), path).toHaveAttribute("href", `/foro/c/${CATEGORIES.empty.slug}/nuevo`);
  }

  // Only a solved thread: the open tab is empty because they are all solved, the solved tab lists it.
  await page.goto(`/foro?categoria=${CATEGORIES.solved.slug}`);
  await expect(page.getByText(`No hay hilos abiertos en ${CATEGORIES.solved.name}.`)).toBeVisible();
  await expect(page.getByText("Todos los hilos ya están resueltos.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Hilo resuelto FB/ })).toHaveCount(0);
  await page.goto(`/foro?categoria=${CATEGORIES.solved.slug}&estado=resueltos`);
  await expect(page.getByRole("link", { name: /Hilo resuelto FB/ })).toBeVisible();

  // Only an open thread: the solved tab says a thread is solved by marking its best answer.
  await page.goto(`/foro?categoria=${CATEGORIES.open.slug}&estado=resueltos`);
  await expect(page.getByText(`No hay hilos resueltos en ${CATEGORIES.open.name}.`)).toBeVisible();
  await expect(page.getByText("Un hilo queda resuelto cuando se marca su mejor respuesta.")).toBeVisible();
  await page.goto(`/foro?categoria=${CATEGORIES.open.slug}`);
  await expect(page.getByRole("link", { name: /Hilo abierto FB/ })).toBeVisible();
  // A hidden thread is neither listed nor counted.
  await expect(page.getByRole("link", { name: /Hilo oculto FB/ })).toHaveCount(0);

  await context.close();
});

test("F4: the list shows 20 threads a page, the next page holds the rest, and a page past the end shows the last one", async ({ browser }) => {
  const context = await memberContext(browser);
  const page = await context.newPage();
  const base = `/foro?categoria=${CATEGORIES.long.slug}`;
  const rows = page.getByRole("link", { name: /^(Abierto|Resuelto|Cerrado)?\s*Larga \d\d/ });

  await page.goto(base);
  await expect(rows).toHaveCount(PAGE_SIZE);
  await expect(page.getByRole("link", { name: /Larga 01/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Larga 21/ })).toHaveCount(0);
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "Anterior" })).toHaveCount(0);

  await page.getByRole("link", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(`${base}&pagina=2`);
  await expect(rows).toHaveCount(LONG_THREADS - PAGE_SIZE);
  await expect(page.getByRole("link", { name: /Larga 21/ })).toBeVisible();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "Siguiente" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", base);

  // Past the end, zero, negative or not a number: the last page, or the first, never an error.
  await page.goto(`${base}&pagina=99`);
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(rows).toHaveCount(LONG_THREADS - PAGE_SIZE);
  for (const odd of ["0", "-3", "abc"]) {
    await page.goto(`${base}&pagina=${odd}`);
    await expect(page.getByText("Página 1 de 2"), odd).toBeVisible();
  }

  await context.close();
});

test("F4 / F5: an unknown category, an unknown or hidden thread and any other address under /foro are a 404 inside the forum", async ({ browser }) => {
  const context = await memberContext(browser);
  const page = await context.newPage();

  for (const path of ["/foro?categoria=no-existe", "/foro/c/no-existe", "/foro/c/no-existe/nuevo", "/foro/hilo/no-existe", `/foro/hilo/${HIDDEN_THREAD}`, "/foro/otra-cosa", "/foro/hilo"]) {
    const response = await page.goto(path);

    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "No encontrado" }), path).toBeVisible();
    await expect(page.getByText("Esta página del foro no existe, ya no está disponible o la dirección cambió."), path).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al foro" }), path).toHaveAttribute("href", "/foro");
    // Inside the forum's layout, and the hidden thread leaks nothing of itself.
    await expect(page.getByRole("link", { name: "Foro de ASO Computación, inicio" }), path).toBeVisible();
    await expect(page.getByText("Hilo oculto FB"), path).toHaveCount(0);
  }

  // The category URL of the old forum keeps filters when the category exists.
  await page.goto(`/foro/c/${CATEGORIES.solved.slug}?estado=resueltos`);
  await expect(page).toHaveURL(new RegExp(`/foro\\?categoria=${CATEGORIES.solved.slug}&estado=resueltos$`));

  await context.close();
});
