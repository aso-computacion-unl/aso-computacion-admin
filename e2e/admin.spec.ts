import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function logIn(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test.beforeAll(() => {
  // The wrapper script always sets it; a bare `playwright test` would otherwise type an empty password and fail confusingly.
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

test("a wrong password shows the error and keeps the login screen", async ({ page }) => {
  await logIn(page, "not-the-password");

  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("an event published in the admin appears in the public content API", async ({ page, request }) => {
  const title = `E2E evento ${Date.now()}`;

  await logIn(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  // Fresh database, no deploy hook configured: the dashboard (and its new table) renders the empty state.
  await expect(page.getByText("Aún no se solicitó ningún despliegue.")).toBeVisible();

  await page.goto("/admin/events/new");
  await page.getByLabel("Título").fill(title);
  await page.getByRole("switch", { name: /Publicado/ }).setChecked(true, { force: true });
  await page.getByRole("button", { name: "Crear evento" }).click();

  // Creating continues on the edit page of the new event.
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/);

  const response = await request.get("/api/public/content");
  const body = await response.json();

  expect(response.status()).toBe(200);
  expect(body.schemaVersion).toBe(1);
  expect(body.events.map((event: { title: string }) => event.title)).toContain(title);

  // The ETag lets the landing's build skip an unchanged body.
  const etag = response.headers()["etag"];
  expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
  const revalidated = await request.get("/api/public/content", { headers: { "If-None-Match": etag ?? "" } });
  expect(revalidated.status()).toBe(304);
});

test("a published event moved to the trash leaves the public API, undo brings it back as a draft, and it can be deleted for good", async ({ page, request }) => {
  const title = `E2E papelera ${Date.now()}`;
  const publicTitles = async () =>
    ((await (await request.get("/api/public/content")).json()).events as { title: string }[]).map((event) => event.title);

  await logIn(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/events/new");
  await page.getByLabel("Título").fill(title);
  await page.getByRole("switch", { name: /Publicado/ }).setChecked(true, { force: true });
  await page.getByRole("button", { name: "Crear evento" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/);
  expect(await publicTitles()).toContain(title);

  // Move to the trash: gone from the public content at once, and the toast offers to undo.
  await page.goto("/admin/events");
  await page.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
  await page.getByRole("button", { name: "Sí, mover" }).click();
  await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  expect(await publicTitles()).not.toContain(title);

  // Undo restores it, but as a draft: still not public.
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("status").getByText("Restaurado como borrador.")).toBeVisible();
  await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
  expect(await publicTitles()).not.toContain(title);

  // Trash it again, restore from the trash page, then delete it for good with the irreversible confirmation.
  await page.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
  await page.getByRole("button", { name: "Sí, mover" }).click();
  await page.goto("/admin/papelera");
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: `Eliminar definitivamente: ${title}` }).click();
  await expect(page.getByText("no se puede deshacer", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Sí, eliminar definitivamente" }).click();
  await expect(page.getByRole("status").getByText("Eliminado definitivamente.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});
