import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
// Signed cookie value of an editor session that scripts/run-e2e.mjs planted in the database.
const EDITOR_SESSION = process.env.E2E_EDITOR_SESSION ?? "";
const BASE_URL = "http://127.0.0.1:3100";

// The open form's rate limit is five attempts per client every ten minutes and every request here comes from the
// same address: the whole file posts to it at most twice.
const FORM = { name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5, turnstileToken: "token" };

async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function actAsEditor(context: BrowserContext) {
  await context.clearCookies();
  await context.addCookies([{ name: "admin_session", value: EDITOR_SESSION, url: BASE_URL }]);
}

/** Creates a published event with the open registration form and two seats; returns its id and public slug. */
async function createRegistrableEvent(page: Page, title: string) {
  await page.goto("/admin/events/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Fecha", { exact: true }).fill("2099-11-28");
  await page.getByLabel("Hora").fill("09:00 - 11:00");
  await page.getByLabel("Lugar").fill("Laboratorio 2");
  await page.getByRole("radio", { name: "Formulario abierto" }).check({ force: true });
  await page.getByLabel("Cupos").fill("2");
  await page.getByRole("switch", { name: /Publicado/ }).setChecked(true, { force: true });
  await page.getByRole("button", { name: "Crear evento" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/);

  const id = /\/admin\/events\/([^/]+)\/edit$/.exec(page.url())![1]!;
  const slug = title.toLowerCase().replaceAll(" ", "-");

  return { id, slug };
}

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
  expect(EDITOR_SESSION, "run the suite with `npm run e2e`").not.toBe("");
});

test("an event with the open form: the settings stick, the public API and the calendar file show it, and the form fails closed without Turnstile", async ({ page, request }) => {
  const title = `E2E inscripcion ${Date.now()}`;

  await logInAsAdmin(page);
  const { id, slug } = await createRegistrableEvent(page, title);

  // The settings were saved: the form shows them again, and the editor links to the registrations.
  await page.reload();
  await expect(page.getByRole("radio", { name: "Formulario abierto" })).toBeChecked();
  await expect(page.getByLabel("Cupos")).toHaveValue("2");
  await expect(page.getByRole("link", { name: "Ver inscripciones" })).toHaveAttribute("href", `/admin/events/${id}/registrations`);

  // The public API adds the registration; everything it already had is still there.
  const body = await (await request.get("/api/public/content")).json();
  const event = body.events.find((entry: { title: string }) => entry.title === title);

  expect(body.schemaVersion).toBe(1);
  expect(event).toMatchObject({ slug, title, date: "2099-11-28", hora: "09:00 - 11:00", lugar: "Laboratorio 2", registration: { mode: "open", capacity: 2, deadline: null } });
  expect(event.structuredData).toEqual({ startDate: "2099-11-28T09:00:00-05:00", endDate: "2099-11-28T11:00:00-05:00", location: "Laboratorio 2", registrationUrl: null });

  // The calendar file is public and holds the event only.
  const calendar = await request.get(`/api/public/events/${slug}/calendar.ics`);
  const ics = await calendar.text();

  expect(calendar.status()).toBe(200);
  expect(calendar.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
  expect(ics).toContain(`SUMMARY:${title}`);
  expect(ics).toContain("DTSTART:20991128T140000Z");
  expect((await request.get("/api/public/events/no-existe/calendar.ics")).status()).toBe(404);

  // The e2e app has no Turnstile secret and runs in production mode: the open form is closed, and nothing is stored.
  const refused = await request.post(`/api/public/events/${slug}/registrations`, { data: FORM });

  expect(refused.status()).toBe(503);
  expect(await refused.json()).toEqual({ error: "unavailable" });
  expect((await request.post(`/api/public/events/${slug}/registrations`, { data: "{not json", headers: { "content-type": "application/json" } })).status()).toBe(400);

  await page.goto(`/admin/events/${id}/registrations`);
  await expect(page.getByText("Todavía no hay inscripciones.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Exportar CSV" })).toBeVisible();
});

test("the registrations belong to the admin and the editor, but only an admin can export them", async ({ page, context, request }) => {
  const title = `E2E inscritos ${Date.now()}`;

  await logInAsAdmin(page);
  const { id } = await createRegistrableEvent(page, title);

  // An admin downloads a CSV (BOM, header, no rows yet) and the download is audited without any person's data.
  const exported = await page.request.get(`/admin/events/${id}/registrations/export`);

  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-type"]).toBe("text/csv; charset=utf-8");
  expect(exported.headers()["content-disposition"]).toContain("attachment");
  expect(await exported.text()).toContain('"Nombre","Correo","Forma de inscripción"');
  await page.goto("/admin/registro");
  await expect(page.getByText("Inscripciones exportadas (0)").first()).toBeVisible();

  // An editor sees the page, without the export or any delete control, and the export itself is refused.
  await actAsEditor(context);
  await page.goto(`/admin/events/${id}/registrations`);
  await expect(page.getByRole("heading", { name: "Inscripciones" })).toBeVisible();
  await expect(page.getByText("Solo un administrador puede exportar o eliminar inscripciones.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveCount(0);
  expect((await page.request.get(`/admin/events/${id}/registrations/export`)).status()).toBe(403);

  // Nobody signed in gets sent to the login, for the page and for the download.
  await context.clearCookies();
  expect((await request.get(`/admin/events/${id}/registrations`, { maxRedirects: 0 })).status()).toBe(307);
  expect((await request.get(`/admin/events/${id}/registrations/export`, { maxRedirects: 0 })).status()).toBe(307);
});

test("the UNL-account registration page answers 404 for an unknown event", async ({ request }) => {
  expect((await request.get("/foro/eventos/no-existe")).status()).toBe(404);
});
