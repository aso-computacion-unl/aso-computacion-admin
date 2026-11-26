import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

/*
 * S8: on a phone (390) no admin screen scrolls sideways. One pass over every screen the relayout touched, the edit
 * pages included (an event with registration and a news item, seeded and removed here); Ajustes opens «Editar».
 */
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STAMP = Date.now().toString(36);
const EVENT_ID = `phone-${STAMP}-event`;
const NEWS_ID = `phone-${STAMP}-news`;
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

const SCREENS = [
  "/admin",
  "/admin/events",
  "/admin/events/new",
  `/admin/events/${EVENT_ID}/edit`,
  "/admin/registrations",
  "/admin/registrations/new",
  `/admin/registrations/${EVENT_ID}/edit`,
  "/admin/news",
  "/admin/news/new",
  `/admin/news/${NEWS_ID}/edit`,
  "/admin/faqs/new",
  "/admin/commands/new",
  "/admin/socials/new",
  "/admin/sponsors/new",
  "/admin/board/new",
  "/admin/pillars/new",
  "/admin/settings",
  "/admin/usuarios",
  "/admin/sesiones",
  "/admin/registro",
  "/admin/papelera",
  "/admin/papelera/imagenes",
  "/admin/foro/reportes",
];

test.use({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-real-ip": `198.51.100.${(Date.now() % 250) + 1}` } });

test.beforeAll(async () => {
  // Long title and place: the edit pages must hold them without widening the page.
  const long = "Taller de Kubernetes y contenedores para principiantes del ciclo";
  await prisma.event.create({
    data: { id: EVENT_ID, slug: EVENT_ID, title: long, date: new Date("2099-11-28"), hora: "09:00 - 11:00", lugar: "Laboratorio de redes del bloque de Computación, segundo piso", isPublished: true, registrationMode: "open", registrationCapacity: 40, registrationDeadline: new Date("2099-11-27T23:00:00.000Z"), updatedAt: new Date() },
  });
  await prisma.newsItem.create({ data: { id: NEWS_ID, slug: NEWS_ID, title: long, summary: "Resumen", body: "Cuerpo", publishedAt: new Date("2099-11-20"), updatedAt: new Date() } });
});

test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: EVENT_ID } });
  await prisma.newsItem.deleteMany({ where: { id: NEWS_ID } });
  await prisma.$disconnect();
});

async function logInAsAdmin(page: Page) {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("no admin screen scrolls sideways on a phone", async ({ page }) => {
  test.setTimeout(120_000);
  await logInAsAdmin(page);

  for (const path of SCREENS) {
    await page.goto(path, { waitUntil: "networkidle" });
    if (path === "/admin/settings") await page.getByRole("button", { name: "Editar" }).click();

    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect.soft(width.scroll, `${path} scrolls sideways`).toBeLessThanOrEqual(width.client);
  }
});
