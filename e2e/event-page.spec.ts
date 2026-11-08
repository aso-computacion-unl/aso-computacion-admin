import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

import { openMoreOptions } from "./more-options";
import { publish } from "./publish";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

type Mode = "none" | "unl" | "open";

async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const MODE_LABELS: Record<Exclude<Mode, "none">, string> = { unl: "Cuenta UNL", open: "Formulario abierto" };

/** Creates a published event through the admin form; returns its id and public slug. The browser stays signed in as admin. */
async function createEvent(page: Page, title: string, { mode, date = "2099-11-28", capacity }: { mode: Mode; date?: string; capacity?: number }) {
  // Wait for the form to hydrate: a switch clicked before that is reset when React takes the form over.
  await page.goto("/admin/events/new", { waitUntil: "networkidle" });
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Fecha", { exact: true }).fill(date);
  await openMoreOptions(page);
  await page.getByLabel("Hora").fill("09:00 - 11:00");
  await page.getByLabel("Lugar").fill("Laboratorio 2");

  if (mode !== "none") {
    await page.locator("label").filter({ has: page.getByRole("switch", { name: "Tiene inscripción" }) }).click();
    await page.getByRole("radio", { name: MODE_LABELS[mode] }).check();
  }

  if (capacity !== undefined) await page.getByLabel("Cupos").fill(String(capacity));

  // Click the visible switch: forcing a click on the hidden input can land on the sticky action bar.
  await page.locator("label").filter({ has: page.getByRole("switch", { name: /Publicado/ }) }).click();
  await expect(page.getByRole("switch", { name: /Publicado/ })).toBeChecked();
  await publish(page);
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit#fotos$/);

  return { id: /\/admin\/events\/([^/]+)\/edit(?:#fotos)?$/.exec(page.url())![1]!, slug: title.toLowerCase().replaceAll(" ", "-") };
}

/** From here on the browser is a visitor: no admin cookie, no forum cookie. */
async function leave(page: Page) {
  await page.context().clearCookies();
}

async function fillForm(page: Page, email = "ana@example.com") {
  await page.getByLabel("Nombre completo").fill("Ana Pérez");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Carrera").fill("Computación");
  await page.getByLabel("Semestre").selectOption("5");
}

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

test("an open event: a visitor without a session sees the event, its seats and the form, and every field is checked before sending", async ({ page }) => {
  const title = `E2E pagina abierta ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "open", capacity: 2 });
  await leave(page);

  await page.goto(`/foro/eventos/${slug}`);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
  await expect(page.getByText("Quedan 2 de 2 cupos")).toBeVisible();
  await expect(page.getByText("Laboratorio 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inscríbete" })).toBeVisible();
  await expect(page.getByText("Usamos tus datos solo para esta actividad y los eliminamos 90 días después de que termine. No verificamos tu correo.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/foro/eventos/${slug}$`));

  // Nothing leaves the browser while a field is wrong: the first one is flagged and focused, each has its message.
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByLabel("Nombre completo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Nombre completo")).toBeFocused();
  await expect(page.getByText("Escribe tu nombre.")).toBeVisible();
  await expect(page.getByText("Elige tu semestre, del 1 al 12.")).toBeVisible();

  await fillForm(page, "ana@");
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Correo")).toBeFocused();
  await expect(page.getByText("Revisa tu correo: no parece una dirección válida.")).toBeVisible();

  // Editing a flagged field clears its flag.
  await page.getByLabel("Correo").fill("ana@example.com");
  await expect(page.getByLabel("Correo")).not.toHaveAttribute("aria-invalid", "true");

  // The e2e app runs in production without a Turnstile secret: the server refuses (fail closed) and the form says so, keeping the data.
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "La inscripción no está disponible en este momento." })).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toHaveValue("Ana Pérez");
  await expect(page.getByRole("button", { name: "Inscribirme" })).toBeEnabled();
});

test("every answer of the public endpoint is shown where the person is looking", async ({ page }) => {
  const title = `E2E respuestas ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "open", capacity: 5 });
  await leave(page);

  const endpoint = `**/api/public/events/${slug}/registrations`;
  const answer = (status: number, body: object, headers: Record<string, string> = {}) =>
    page.route(endpoint, (route) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) }), { times: 1 });

  await page.goto(`/foro/eventos/${slug}`, { waitUntil: "networkidle" });

  // A duplicate belongs to the email field.
  await fillForm(page);
  await answer(409, { error: "duplicate" });
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Correo")).toBeFocused();
  await expect(page.getByText("Ya hay una inscripción con ese correo para este evento.")).toBeVisible();

  // A rate limit says how long to wait, in one alert that takes the focus.
  await answer(429, { error: "rate_limited" }, { "Retry-After": "300" });
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Vuelve a intentarlo en 5 minutos." })).toBeFocused();

  // The captcha and a down server keep the form.
  await answer(400, { error: "captcha" });
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos comprobar que eres una persona." })).toBeVisible();

  // A closed registration swaps the form for the state.
  await answer(409, { error: "closed" });
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByText("Las inscripciones de este evento ya cerraron.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);

  // And a success confirms, with the calendar to add.
  await page.goto(`/foro/eventos/${slug}`, { waitUntil: "networkidle" });
  await fillForm(page);
  await answer(201, { ok: true });
  await page.getByRole("button", { name: "Inscribirme" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Quedaste inscrito en ${title}.` })).toBeFocused();
  await expect(page.getByRole("link", { name: "Añadir al calendario" })).toHaveAttribute("href", `/api/public/events/${slug}/calendar.ics`);
  await expect(page.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);
});

test("the form fits a phone: one column, no sideways scroll, 44 px targets", async ({ page }) => {
  const title = `E2E celular ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "open" });
  await leave(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/foro/eventos/${slug}`);
  await expect(page.getByRole("button", { name: "Inscribirme" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  for (const control of [page.getByLabel("Nombre completo"), page.getByLabel("Correo"), page.getByLabel("Carrera"), page.getByLabel("Semestre"), page.getByRole("button", { name: "Inscribirme" })]) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test("a full or closed open event hides the form and says why", async ({ page }) => {
  const stamp = Date.now();
  const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

  try {
    await logInAsAdmin(page);
    const full = await createEvent(page, `E2E lleno ${stamp}`, { mode: "open", capacity: 1 });
    const closed = await createEvent(page, `E2E cerrado ${stamp}`, { mode: "open", date: "2020-01-15" });

    await prisma.eventRegistration.create({ data: { id: `e2e-full-${stamp}`, eventId: full.id, mode: "open", name: "Eva Mora", email: "eva@example.com", career: "Computación", semester: 3 } });
    await leave(page);

    await page.goto(`/foro/eventos/${full.slug}`);
    await expect(page.getByText("Cupos agotados")).toBeVisible();
    await expect(page.getByText("Quedan 0 de 1 cupos")).toBeVisible();
    await expect(page.getByText("Ya no quedan cupos para este evento.")).toBeVisible();
    await expect(page.getByLabel("Correo")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);

    await page.goto(`/foro/eventos/${closed.slug}`);
    await expect(page.getByText("Inscripciones cerradas")).toBeVisible();
    await expect(page.getByText("Las inscripciones de este evento ya cerraron.")).toBeVisible();
    await expect(page.getByLabel("Correo")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toHaveCount(0);
  } finally {
    await prisma.$disconnect();
  }
});

test("a UNL event keeps its Google flow, with no form", async ({ page }) => {
  const title = `E2E pagina unl ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "unl" });
  await leave(page);

  await page.goto(`/foro/eventos/${slug}`);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveAttribute("href", `/foro/auth/google/start?next=${encodeURIComponent(`/foro/eventos/${slug}`)}`);
  await expect(page.getByText("@unl.edu.ec")).toBeVisible();
  await expect(page.getByLabel("Correo")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);
});

test("an event without registration says so and offers the calendar", async ({ page, request }) => {
  const title = `E2E pase libre ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "none" });
  await leave(page);

  await page.goto(`/foro/eventos/${slug}`);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Este evento es de pase libre: no necesitas inscribirte, solo llegar.")).toBeVisible();
  await expect(page.getByLabel("Correo")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);

  const calendar = page.getByRole("link", { name: "Añadir al calendario" });

  await expect(calendar).toHaveAttribute("href", `/api/public/events/${slug}/calendar.ics`);
  expect((await request.get(`/api/public/events/${slug}/calendar.ics`)).status()).toBe(200);
});
