import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
// Signed cookie values of two editor sessions that scripts/run-e2e.mjs planted in the database.
const EDITOR_SESSION = process.env.E2E_EDITOR_SESSION ?? "";
const REVOKABLE_EDITOR_SESSION = process.env.E2E_REVOKABLE_EDITOR_SESSION ?? "";
const BASE_URL = "http://127.0.0.1:3100";

async function logIn(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

/** Logs in with the emergency password and waits for the admin: a `goto` straight after the click would race the login. */
async function logInAsAdmin(page: Page) {
  await logIn(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeAll(() => {
  // The wrapper script always sets it; a bare `playwright test` would otherwise type an empty password and fail confusingly.
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
  expect(EDITOR_SESSION, "run the suite with `npm run e2e`").not.toBe("");
});

async function actAsEditor(context: BrowserContext, token: string = EDITOR_SESSION) {
  await context.clearCookies();
  await context.addCookies([{ name: "admin_session", value: token, url: BASE_URL }]);
}

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

test("a published event moved to the trash leaves the public API, undo brings it back as a draft, and it can be restored from the trash and deleted for good", async ({ page, request }) => {
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

  // Trash it again and wait for the toast (the action finished) before leaving the page.
  await page.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
  await page.getByRole("button", { name: "Sí, mover" }).click();
  await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();

  // Restore it from the trash page: it leaves the trash and is back in its list as a draft, still not public.
  await page.goto("/admin/papelera");
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: `Restaurar: ${title}` }).click();
  await expect(page.getByRole("status").getByText("Restaurado como borrador.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.goto("/admin/events");
  await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
  await expect(page.getByRole("switch", { name: `Publicado: ${title}` })).toHaveAttribute("aria-checked", "false");
  expect(await publicTitles()).not.toContain(title);

  // Trash it a last time, then delete it for good with the irreversible confirmation.
  await page.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
  await page.getByRole("button", { name: "Sí, mover" }).click();
  await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();
  await page.goto("/admin/papelera");
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: `Eliminar definitivamente: ${title}` }).click();
  await expect(page.getByText("no se puede deshacer", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Sí, eliminar definitivamente" }).click();
  await expect(page.getByRole("status").getByText("Eliminado definitivamente.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  expect(await publicTitles()).not.toContain(title);
});

test("the emergency login is flagged on every page, as the session of the emergency actor", async ({ page }) => {
  await logInAsAdmin(page);

  await expect(page.getByRole("note").getByText(/acceso de emergencia con contraseña/i)).toBeVisible();

  await page.goto("/admin/sesiones");
  await expect(page.getByText("emergencia", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("esta sesión", { exact: true })).toBeVisible();
});

test("an editor cannot open the admin-only pages, and an action refused for their role changes nothing", async ({ page, context, request }) => {
  const title = `E2E permisos ${Date.now()}`;

  // As an admin: a published-then-trashed event waiting in the trash, and its permanent-delete confirmation open.
  await logInAsAdmin(page);
  await page.goto("/admin/events/new");
  await page.getByLabel("Título").fill(title);
  await page.getByRole("button", { name: "Crear evento" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/);
  await page.goto("/admin/events");
  await page.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
  await page.getByRole("button", { name: "Sí, mover" }).click();
  await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();
  await page.goto("/admin/papelera");
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: `Eliminar definitivamente: ${title}` }).click();
  await expect(page.getByRole("button", { name: "Sí, eliminar definitivamente" })).toBeVisible();

  // The same page, the same button, but the browser now carries an editor's session: the action is refused.
  await actAsEditor(context);
  await page.getByRole("button", { name: "Sí, eliminar definitivamente" }).click();
  await expect(page.getByText("No tiene permiso para realizar esta acción.")).toBeVisible();

  // Nothing changed: the event is still in the trash, and the editor has no delete-for-good button at all.
  await page.goto("/admin/papelera");
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByRole("button", { name: `Restaurar: ${title}` })).toBeVisible();
  await expect(page.getByRole("button", { name: /Eliminar definitivamente/ })).toHaveCount(0);

  // The admin-only pages send the editor back to the home page, which says why, and the sidebar does not offer them.
  for (const path of ["/admin/usuarios", "/admin/registro", "/admin/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\?acceso=restringido$/);
    await expect(page.getByText("Esa sección es solo para administradores.")).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Registro" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sesiones" }).first()).toBeVisible();

  // Back as an admin the event is still there, and the audit log recorded what was done.
  await context.clearCookies();
  await logInAsAdmin(page);
  await page.goto("/admin/papelera");
  await expect(page.getByText(title)).toBeVisible();
  await page.goto("/admin/registro");
  await expect(page.getByText("Evento creado").first()).toBeVisible();
  await expect(page.getByText("Evento movido a la papelera").first()).toBeVisible();

  // Unrelated to the page state: an anonymous request still cannot reach the admin pages at all.
  const anonymous = await request.get("/admin/usuarios", { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
});

test("a session revoked in Sesiones activas stops working at once", async ({ page, browser }) => {
  // The editor's second session works...
  const editorContext = await browser.newContext({ baseURL: BASE_URL });
  await actAsEditor(editorContext, REVOKABLE_EDITOR_SESSION);
  const editorPage = await editorContext.newPage();
  await editorPage.goto("/admin");
  await expect(editorPage).toHaveURL(/\/admin$/);

  // ...until an admin closes it from the list.
  await logInAsAdmin(page);
  await page.goto("/admin/sesiones");
  await page.getByRole("button", { name: "Cerrar sesión: Firefox en Linux" }).click();
  await page.getByRole("button", { name: "Sí, cerrar la sesión" }).click();
  await expect(page.getByRole("status").getByText("Sesión cerrada.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión: Firefox en Linux" })).toHaveCount(0);

  // The editor's cookie is still correctly signed and unexpired, but the session behind it is gone.
  await editorPage.goto("/admin/events");
  await expect(editorPage).toHaveURL(/\/login$/);

  await editorContext.close();
});
