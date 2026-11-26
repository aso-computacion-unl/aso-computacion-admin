import { randomUUID } from "node:crypto";

import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

// R8 / S1-S2: a registration is created and changed from the Inscripciones area, picking an upcoming event.

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** An event without registration, stored as the event form would leave it. */
async function seedEvent(title: string, { date, isPublished }: { date: string; isPublished: boolean }) {
  const id = randomUUID();

  await prisma.event.create({
    data: { id, slug: `${title.toLowerCase().replaceAll(" ", "-")}`, title, date: new Date(date), lugar: "Laboratorio 2", isPublished, updatedAt: new Date() },
  });

  return id;
}

const picker = (page: Page) => page.getByRole("navigation", { name: "Eventos próximos sin inscripción" });

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("R8: create a registration for an upcoming draft from Inscripciones and see it in the panel", async ({ page }) => {
  const title = `E2E inscripcion borrador ${Date.now()}`;
  const id = await seedEvent(title, { date: "2099-11-28", isPublished: false });

  await logInAsAdmin(page);
  await page.goto("/admin/registrations");
  await page.getByRole("link", { name: "Crear inscripción" }).first().click();
  await expect(page).toHaveURL(/\/admin\/registrations\/new$/);

  const option = picker(page).getByRole("link", { name: new RegExp(title) });
  await expect(option).toContainText("28 nov 2099");
  await expect(option).toContainText("Laboratorio 2");
  await expect(option).toContainText("Borrador");
  await option.click();
  await expect(page).toHaveURL(new RegExp(`/admin/registrations/new\\?evento=${id}$`));

  // The event's own data, read-only, with the way to change it on the event.
  const summary = page.getByRole("region", { name: "Evento" });
  await expect(summary).toContainText(title);
  await expect(summary).toContainText("Laboratorio 2");
  await expect(summary.getByRole("link", { name: "Editar el evento" })).toHaveAttribute("href", `/admin/events/${id}/edit`);
  await expect(page.getByLabel("Título")).toHaveCount(0);

  // Wait for the form to hydrate: a radio clicked before that is reset when React takes the form over.
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: "Formulario abierto" }).check();
  await page.getByLabel("Cupos").fill("25");
  await page.getByRole("button", { name: "Crear inscripción" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/registrations\\?evento=${id}$`));
  await expect(page.getByText("Inscripción creada.")).toBeVisible();
  const row = page.getByRole("navigation", { name: "Eventos con inscripción" }).getByRole("link", { name: new RegExp(title) });
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(row).toContainText("0 / 25");

  const stored = await prisma.event.findUniqueOrThrow({ where: { id } });
  expect([stored.registrationMode, stored.registrationCapacity, stored.isPublished, stored.title]).toEqual(["open", 25, false, title]);
});

test("R8 / S4: a past event is not offered, and an event whose day passed while its form was open is refused on save", async ({ page }) => {
  const stamp = Date.now();
  const pastTitle = `E2E inscripcion pasado ${stamp}`;
  const title = `E2E inscripcion publicado ${stamp}`;
  const pastId = await seedEvent(pastTitle, { date: "2020-01-15", isPublished: true });
  const id = await seedEvent(title, { date: "2099-11-28", isPublished: true });

  await logInAsAdmin(page);
  await page.goto("/admin/registrations/new");
  await expect(picker(page).getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expect(picker(page).getByRole("link", { name: new RegExp(pastTitle) })).toHaveCount(0);

  // A link straight to the past event shows the picker, not the form.
  await page.goto(`/admin/registrations/new?evento=${pastId}`);
  await expect(page.getByRole("button", { name: "Crear inscripción" })).toHaveCount(0);
  await expect(picker(page)).toBeVisible();

  await page.goto(`/admin/registrations/new?evento=${id}`, { waitUntil: "networkidle" });
  // The event's day passes after the form was opened: the server checks again.
  await prisma.event.update({ where: { id }, data: { date: new Date("2020-01-15") } });
  await page.getByRole("button", { name: "Crear inscripción" }).click();

  await expect(page.getByText("El evento ya pasó: su inscripción no se puede abrir ni cambiar, solo desactivar.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/admin/registrations/new\\?evento=${id}$`));
  expect((await prisma.event.findUniqueOrThrow({ where: { id } })).registrationMode).toBe("none");
});
