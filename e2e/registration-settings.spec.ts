import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

import { openMoreOptions } from "./more-options";

// R8 / event-kinds S3-S4: «Crear inscripción» in Inscripciones creates a new event with its registration, and changes it.

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("R8 / S4: create a new draft event with registration from Inscripciones, see it in the panel, change it and turn it off", async ({ page }) => {
  const title = `E2E inscripcion borrador ${Date.now()}`;

  await logInAsAdmin(page);
  await page.goto("/admin/registrations");
  await page.getByRole("link", { name: "Crear inscripción" }).first().click();
  await expect(page).toHaveURL(/\/admin\/registrations\/new$/);

  // One form: the event's data and its registration, the kind already fixed; no event to pick.
  // Wait for the form to hydrate: a radio clicked before that is reset when React takes the form over.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("radio", { name: "Evento con inscripción" })).toHaveCount(0);
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Fecha", { exact: true }).fill("2099-11-28");
  await openMoreOptions(page);
  await page.getByLabel("Lugar").fill("Laboratorio 2");
  await page.getByRole("radio", { name: "Formulario abierto" }).check();
  await page.getByLabel("Cupos").fill("25");
  await page.getByRole("button", { name: "Crear inscripción" }).click();

  await expect(page).toHaveURL(/\/admin\/registrations\?evento=[^&]+$/);
  const id = new URL(page.url()).searchParams.get("evento")!;
  await expect(page.getByText("Inscripción creada.")).toBeVisible();
  const row = page.getByRole("navigation", { name: "Eventos con inscripción" }).getByRole("link", { name: new RegExp(title) });
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(row).toContainText("0 / 25");

  const stored = await prisma.event.findUniqueOrThrow({ where: { id } });
  expect([stored.registrationMode, stored.registrationCapacity, stored.isPublished, stored.title, stored.lugar]).toEqual(["open", 25, false, title, "Laboratorio 2"]);

  // Edit: the event read-only, the settings prefilled.
  await page.getByRole("link", { name: "Configurar inscripción" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/registrations/${id}/edit$`));
  const summary = page.getByRole("region", { name: "Evento" });
  await expect(summary).toContainText(title);
  await expect(summary.getByRole("link", { name: "Editar el evento" })).toHaveAttribute("href", `/admin/events/${id}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("radio", { name: "Formulario abierto" })).toBeChecked();
  await expect(page.getByLabel("Cupos")).toHaveValue("25");
  await page.getByLabel("Cupos").fill("30");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator('[data-slot="form-feedback"]').getByText("Cambios guardados.")).toBeVisible();
  expect((await prisma.event.findUniqueOrThrow({ where: { id } })).registrationCapacity).toBe(30);

  // Turn it off: nobody is registered, so nothing is asked; the panel, which the event leaves, confirms it.
  await page.locator("label").filter({ has: page.getByRole("switch", { name: "Tiene inscripción" }) }).click();
  await expect(page.getByLabel("Cupos")).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/admin\/registrations$/);
  await expect(page.getByText("Inscripción desactivada.")).toBeVisible();
  expect((await prisma.event.findUniqueOrThrow({ where: { id } })).registrationMode).toBe("none");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);

  // An event without registration never takes one: its edit screen leads back to the panel, and its event page offers none (S1).
  await page.goto(`/admin/registrations/${id}/edit`);
  await expect(page).toHaveURL(/\/admin\/registrations$/);
  await page.goto(`/admin/events/${id}/edit`);
  await expect(page.getByRole("region", { name: "Inscripción" })).toContainText("Sin inscripción");
  await expect(page.getByRole("link", { name: "Crear inscripción" })).toHaveCount(0);
});

test("R8 / S4: a cierre after the event's day is refused on «Cierre», and no event is created", async ({ page }) => {
  const title = `E2E inscripcion cierre ${Date.now()}`;

  await logInAsAdmin(page);
  await page.goto("/admin/registrations/new", { waitUntil: "networkidle" });
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Fecha", { exact: true }).fill("2099-11-28");
  await page.getByLabel("Cierre").fill("2099-11-29T10:00");
  await page.getByRole("button", { name: "Crear inscripción" }).click();

  await expect(page.getByLabel("Cierre")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("El cierre de la inscripción no puede ser posterior al día del evento.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/registrations\/new$/);
  expect(await prisma.event.count({ where: { title } })).toBe(0);
});
