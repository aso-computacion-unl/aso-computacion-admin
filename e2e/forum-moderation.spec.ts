import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test } from "@playwright/test";

/*
 * The report queue, one report at a time, as an editor works through it. The rows are planted straight in the
 * database (a student cannot sign in with Google here) and dated in 2000, so they are the first two of the open
 * queue whatever other specs left in it; the specs that run later still find the queue as they expect, because
 * this one removes its rows at the end.
 */
const prisma = createPrismaClient(process.env.DATABASE_URL);
const EDITOR_SESSION = process.env.E2E_EDITOR_SESSION ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const BASE_URL = "http://127.0.0.1:3100";
const THREAD = { id: "fmod-thread", title: "Hilo de moderación E2E" };
const MEMBERS = ["fmod-author", "fmod-reporter-1", "fmod-reporter-2"] as const;
const REPORTS = ["fmod-report-1", "fmod-report-2"] as const;

test.beforeAll(async () => {
  expect(EDITOR_SESSION, "run the suite with `npm run e2e`").not.toBe("");
  await cleanUp();

  const now = new Date();

  await prisma.forumCategory.create({ data: { id: "fmod-cat", slug: "fmod-cat", name: "Moderación (e2e)", sortOrder: 98, updatedAt: now } });
  for (const id of MEMBERS) await prisma.forumMember.create({ data: { id, email: `${id}@unl.edu.ec`, googleSub: `sub-${id}`, displayName: id === "fmod-author" ? "Autora E2E" : `Quien reporta ${id.slice(-1)}` } });
  await prisma.forumThread.create({ data: { id: THREAD.id, categoryId: "fmod-cat", authorId: "fmod-author", title: THREAD.title, body: "Texto reportado en el e2e", updatedAt: now, lastActivityAt: now } });
  await prisma.forumReport.create({ data: { id: REPORTS[0], reporterId: MEMBERS[1], threadId: THREAD.id, reason: "Motivo uno", createdAt: new Date("2000-01-01T00:00:00Z") } });
  await prisma.forumReport.create({ data: { id: REPORTS[1], reporterId: MEMBERS[2], threadId: THREAD.id, reason: "Motivo dos", createdAt: new Date("2000-01-02T00:00:00Z") } });
});

test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function cleanUp() {
  await prisma.forumThread.deleteMany({ where: { id: THREAD.id } });
  await prisma.forumMember.deleteMany({ where: { id: { in: [...MEMBERS] } } });
  await prisma.forumCategory.deleteMany({ where: { id: "fmod-cat" } });
}

test("an editor walks the reports one by one, decides on each and sees the next one", async ({ context, page }) => {
  await context.addCookies([{ name: "admin_session", value: EDITOR_SESSION, url: BASE_URL }]);
  await page.goto("/admin/foro/reportes");

  await expect(page.getByText(/^1 de \d+$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: THREAD.title })).toBeVisible();
  await expect(page.getByText("Motivo uno")).toBeVisible();
  await expect(page.getByText("Motivo dos")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Categorías" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver el hilo completo" })).toHaveAttribute("href", `/foro/hilo/${THREAD.id}`);

  // Next and previous are plain links.
  await page.getByRole("link", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/\?n=2$/);
  await expect(page.getByText("Motivo dos")).toBeVisible();
  await page.getByRole("link", { name: "Anterior" }).click();
  await expect(page.getByText("Motivo uno")).toBeVisible();

  // Hiding keeps the report open and shows the state.
  await page.getByRole("button", { name: "Ocultar" }).click();
  await expect(page.getByText("Publicación oculta para los estudiantes.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mostrar" })).toBeVisible();
  await expect(page.getByText("Oculto", { exact: true })).toBeVisible();
  expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: THREAD.id } })).hiddenAt).not.toBeNull();

  // Suspending asks first; the account can be reactivated.
  await page.getByRole("button", { name: /^Suspender…/ }).click();
  await page.getByRole("button", { name: "Sí, suspender" }).click();
  await expect(page.getByText("Cuenta suspendida y sesiones cerradas.")).toBeVisible();
  await page.getByRole("button", { name: "Reactivar la cuenta" }).click();
  await expect(page.getByText("Cuenta reactivada.")).toBeVisible();
  expect((await prisma.forumMember.findUniqueOrThrow({ where: { id: "fmod-author" } })).status).toBe("ACTIVE");

  // Ignoring closes this report and the next one takes its place.
  await page.getByRole("button", { name: "Ignorar" }).click();
  await expect(page.getByText("Reporte descartado.")).toBeVisible();
  await expect(page.getByText("Motivo dos")).toBeVisible();
  await expect(page.getByText("Motivo uno")).toHaveCount(0);

  await page.getByLabel("Nota (opcional)").fill("Ya se ocultó");
  await page.getByRole("button", { name: "Marcar como resuelto" }).click();
  await expect(page.getByText("Reporte resuelto.")).toBeVisible();
  await expect(page.getByText("Motivo dos")).toHaveCount(0);

  await page.getByRole("link", { name: /^Cerrados/ }).click();
  await expect(page.getByText("Nota: Ya se ocultó")).toBeVisible();
  await expect(page.getByText("Descartado", { exact: true })).toBeVisible();
  await expect(page.getByText("Resuelto", { exact: true })).toBeVisible();
});

test("an administrator gets the link to the categories", async ({ page }) => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/foro/reportes");
  await page.getByRole("link", { name: "Categorías" }).click();
  await expect(page).toHaveURL(/\/admin\/foro\/categorias$/);
});
