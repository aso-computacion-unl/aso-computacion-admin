import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

import { openMoreOptions } from "./more-options";
import { publish } from "./publish";
import { openForm } from "./support/turnstile";

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
  await page.getByLabel("Institución").fill("Universidad Nacional de Loja");
  await page.getByLabel("Carrera").fill("Computación");
  await page.getByLabel("Ciclo").selectOption("5");
}

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

test("an open event: a visitor without a session sees the event, its seats and the form, and every field is checked before sending", async ({ page }) => {
  const title = `E2E pagina abierta ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "open", capacity: 2 });
  await leave(page);

  await openForm(page, slug);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
  await expect(page.getByText("Quedan 2 cupos")).toBeVisible();
  await expect(page.getByText("Laboratorio 2")).toBeVisible();
  const stub = page.getByRole("region", { name: "Inscripción" });
  await expect(stub.getByText("Su nombre en el boleto")).toBeVisible();
  await expect(stub.getByRole("button", { name: "Reservar mi cupo" })).toBeEnabled();
  await expect(page.getByText("Usamos sus datos solo para esta actividad y los eliminamos 90 días después de que termine. Le enviaremos un correo para confirmar su dirección.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/inscripciones/${slug}$`));

  // Nothing leaves the browser while a field is wrong: the first one is flagged and focused, each has its message.
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByLabel("Nombre completo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Nombre completo")).toBeFocused();
  await expect(page.getByText("Escriba su nombre.")).toBeVisible();
  await expect(page.getByText("Escriba su institución.")).toBeVisible();
  // Career and semester are optional: left empty they are not flagged.
  await expect(page.getByLabel("Carrera")).not.toHaveAttribute("aria-invalid", "true");

  await fillForm(page, "ana@");
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Correo")).toBeFocused();
  await expect(page.getByText("Revise su correo: no parece una dirección válida.")).toBeVisible();

  // Editing a flagged field clears its flag.
  await page.getByLabel("Correo").fill("ana@example.com");
  await expect(page.getByLabel("Correo")).not.toHaveAttribute("aria-invalid", "true");

  // When the server cannot decide about the captcha it refuses (fail closed, 503 `unavailable`; the rule itself is
  // proved by src/tests/unit/infrastructure/http/turnstile.test.ts). The form says so and keeps the data.
  await page.route(`**/api/public/events/${slug}/registrations`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) }), { times: 1 });
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "La inscripción no está disponible en este momento." })).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toHaveValue("Ana Pérez");
  await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toBeEnabled();
});

test("every answer of the public endpoint is shown where the person is looking", async ({ page }) => {
  const title = `E2E respuestas ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "open", capacity: 5 });
  await leave(page);

  const endpoint = `**/api/public/events/${slug}/registrations`;
  const answer = (status: number, body: object, headers: Record<string, string> = {}) =>
    page.route(endpoint, (route) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) }), { times: 1 });

  await openForm(page, slug);

  // A duplicate belongs to the email field.
  await fillForm(page);
  await answer(409, { error: "duplicate" });
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Correo")).toBeFocused();
  await expect(page.getByText("Ya hay una inscripción con ese correo para este evento.")).toBeVisible();

  // A rate limit says how long to wait, in one alert that takes the focus.
  await answer(429, { error: "rate_limited" }, { "Retry-After": "300" });
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Vuelva a intentarlo en 5 minutos." })).toBeFocused();

  // The captcha and a down server keep the form.
  await answer(400, { error: "captcha" });
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos comprobar que usted es una persona." })).toBeVisible();

  // A closed registration swaps the form for the state.
  await answer(409, { error: "closed" });
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByText("Las inscripciones de este evento ya cerraron.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toHaveCount(0);

  // No mail: the server says so and the form keeps what was typed.
  await openForm(page, slug);
  await fillForm(page);
  await answer(503, { error: "email_budget" });
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Hoy ya enviamos todos los correos de confirmación que podemos." })).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toHaveValue("Ana Pérez");

  // And a success asks the person to check their email: no seat is taken yet, so no calendar.
  await answer(201, { ok: true, confirm: "email" });
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  const notice = page.getByRole("status").filter({ hasText: "Revise su correo" });

  await expect(notice).toBeFocused();
  await expect(notice).toContainText("ana@example.com");
  await expect(notice).toContainText("Confirmar mi cupo");
  await expect(page.getByRole("link", { name: "Añadir al calendario" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toHaveCount(0);
});

test("the form fits a phone: one column, no sideways scroll, 44 px targets", async ({ page }) => {
  const title = `E2E celular ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "open" });
  await leave(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/inscripciones/${slug}`);
  await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  for (const control of [page.getByLabel("Nombre completo"), page.getByLabel("Correo"), page.getByLabel("Institución"), page.getByLabel("Carrera"), page.getByLabel("Ciclo"), page.getByRole("button", { name: "Reservar mi cupo" })]) {
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

    await prisma.eventRegistration.create({ data: { id: `e2e-full-${stamp}`, eventId: full.id, mode: "open", name: "Eva Mora", email: "eva@example.com", institution: "UNL", career: "Computación", semester: 3, confirmedAt: new Date() } });
    await leave(page);

    await page.goto(`/inscripciones/${full.slug}`);
    await expect(page.getByText("Cupos agotados")).toBeVisible();
    await expect(page.getByText("Quedan 0 cupos")).toBeVisible();
    await expect(page.getByText("Ya no quedan cupos para este evento.")).toBeVisible();
    await expect(page.getByLabel("Correo")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toHaveCount(0);

    await page.goto(`/inscripciones/${closed.slug}`);
    await expect(page.getByText("Inscripciones cerradas")).toBeVisible();
    await expect(page.getByText("Las inscripciones de este evento ya cerraron.")).toBeVisible();
    await expect(page.getByLabel("Correo")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toHaveCount(0);
  } finally {
    await prisma.$disconnect();
  }
});

test("S8 / R2: a UNL event says its registration is not available while the Google login is not configured, with no sign-in and no form", async ({ page }) => {
  const title = `E2E pagina unl ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "unl" });
  await leave(page);

  await page.goto(`/inscripciones/${slug}`);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  // This server has no Google client: a sign-in would end in an error, so the page does not offer one.
  await expect(page.getByRole("region", { name: "Inscripción" }).getByRole("status")).toHaveText("La inscripción con cuenta UNL no está disponible en este momento. Inténtelo de nuevo más tarde.");
  await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);
  await expect(page.getByLabel("Correo")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toHaveCount(0);
  // The registrations' own bar, not the forum's: no forum link, top bar or word around it.
  await expect(page.getByRole("link", { name: "Foro", exact: true })).toHaveCount(0);
  await expect(page.getByRole("banner")).not.toContainText(/foro/i);
  await expect(page.getByRole("banner").getByRole("link", { name: "Inscripciones de ASO Computación, inicio" })).toHaveAttribute("href", "/inscripciones");
});

test("an event without registration says so and offers the calendar", async ({ page, request }) => {
  const title = `E2E pase libre ${Date.now()}`;

  await logInAsAdmin(page);
  const { slug } = await createEvent(page, title, { mode: "none" });
  await leave(page);

  await page.goto(`/inscripciones/${slug}`);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("No necesita inscribirse: solo llegue.")).toBeVisible();
  await expect(page.getByLabel("Correo")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);

  const calendar = page.getByRole("link", { name: "Añadir al calendario" });

  await expect(calendar).toHaveAttribute("href", `/api/public/events/${slug}/calendar.ics`);
  expect((await request.get(`/api/public/events/${slug}/calendar.ics`)).status()).toBe(200);
});
