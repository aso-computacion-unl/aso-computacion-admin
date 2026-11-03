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
  // Click the visible switch: forcing a click on the hidden input can land on the sticky action bar.
  await page.locator("label").filter({ has: page.getByRole("switch", { name: /Publicado/ }) }).click();
  await expect(page.getByRole("switch", { name: /Publicado/ })).toBeChecked();
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
  // Click the visible switch: forcing a click on the hidden input can land on the sticky action bar.
  await page.locator("label").filter({ has: page.getByRole("switch", { name: /Publicado/ }) }).click();
  await expect(page.getByRole("switch", { name: /Publicado/ })).toBeChecked();
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

test("impact stats and testimonials are gone: no admin page, no menu entry, no keys in the public API", async ({ page, request }) => {
  const body = await (await request.get("/api/public/content")).json();
  expect(body).not.toHaveProperty("impact");
  expect(body).not.toHaveProperty("testimonials");
  expect(body).toHaveProperty("sponsors");

  await logInAsAdmin(page);
  for (const path of ["/admin/impact", "/admin/testimonials"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: /Impacto|Testimonios/ })).toHaveCount(0);
});

test("the emergency login is flagged on every page, as the session of the emergency actor", async ({ page }) => {
  await logInAsAdmin(page);

  // The red pill in the top bar carries the state on every page; the explanation is in the identity menu.
  const identity = page.getByRole("button", { name: "Menú de cuenta: Acceso de emergencia" });

  await expect(identity).toBeVisible();
  await identity.click();
  await expect(page.getByText(/acceso de emergencia con contraseña/i)).toBeVisible();

  await page.goto("/admin/sesiones");
  await expect(page.getByRole("button", { name: "Menú de cuenta: Acceso de emergencia" })).toBeVisible();
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

test("the users page invites by link instead of adding people, and the public invitation page reveals nothing for an unknown link", async ({ page, request }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Invitar a una persona" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar usuario" })).toHaveCount(0);

  // This server has no public address configured (AUTH_URL), so there is no link to build and nothing is stored.
  await page.getByLabel("Correo").fill("invitee@example.org");
  await page.getByRole("button", { name: "Crear invitación" }).click();
  await expect(page.getByText(/falta configurar AUTH_URL/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invitaciones pendientes" })).toHaveCount(0);

  // Anyone may open an invitation link; an unknown one only says it is not valid, and is never indexed.
  const response = await request.get(`/invitacion/${"a".repeat(43)}`);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Invitación no disponible");
  expect(await response.text()).not.toContain("invitee@example.org");
  expect(await response.text()).toContain("noindex");
});

test("an editor opens the forum report queue from the sidebar, and a visitor is sent to the login", async ({ browser }) => {
  // Students sign in with Google, which the suite cannot do: the queue starts empty, and the data rules live in the integration suites.
  const editorContext = await browser.newContext({ baseURL: BASE_URL });
  await actAsEditor(editorContext);
  const editorPage = await editorContext.newPage();

  await editorPage.goto("/admin");
  await editorPage.getByRole("link", { name: "Foro", exact: true }).first().click();
  await expect(editorPage).toHaveURL(/\/admin\/foro\/reportes$/);
  await expect(editorPage.getByRole("heading", { name: "Reportes del foro" })).toBeVisible();
  await expect(editorPage.getByText("No hay reportes abiertos.")).toBeVisible();

  await editorPage.getByRole("link", { name: "Cerrados" }).click();
  await expect(editorPage).toHaveURL(/estado=cerrados$/);
  await expect(editorPage.getByText("Todavía no se cerró ningún reporte.")).toBeVisible();
  await editorContext.close();

  const visitorContext = await browser.newContext({ baseURL: BASE_URL });
  const visitorPage = await visitorContext.newPage();

  await visitorPage.goto("/admin/foro/reportes");
  await expect(visitorPage).toHaveURL(/\/login/);
  await visitorContext.close();
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

test("scheduled events: a future window reads Programado and stays out of the public API until it is cleared; a closed one reads Vencido and stays out", async ({ page, request }) => {
  const scheduled = `E2E programado ${Date.now()}`;
  const expired = `E2E vencido ${Date.now()}`;
  const publicTitles = async () =>
    ((await (await request.get("/api/public/content")).json()).events as { title: string }[]).map((event) => event.title);

  await logInAsAdmin(page);

  await page.goto("/admin/events/new");
  await page.getByLabel("Título").fill(scheduled);
  await page.getByLabel("Publicar el").fill("2999-01-01T08:00");
  // Click the visible switch: forcing a click on the hidden input can land on the sticky action bar.
  await page.locator("label").filter({ has: page.getByRole("switch", { name: /Publicado/ }) }).click();
  await expect(page.getByRole("switch", { name: /Publicado/ })).toBeChecked();
  await page.getByRole("button", { name: "Crear evento" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/);
  await expect(page.getByLabel("Publicar el")).toHaveValue("2999-01-01T08:00");

  // Published but not open yet: not public, and the list says why.
  expect(await publicTitles()).not.toContain(scheduled);
  await page.goto("/admin/events");
  const row = page.getByRole("listitem").filter({ hasText: scheduled });
  await expect(row.getByText("Programado", { exact: true })).toBeVisible();
  await expect(row.getByText(/Se publica el 1 ene 2999/)).toBeVisible();

  // Clearing the start opens it at once.
  await row.getByRole("link", { name: `Editar: ${scheduled}` }).click();
  await page.getByLabel("Publicar el").fill("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  expect(await publicTitles()).toContain(scheduled);

  // A window that already closed: published, yet retired.
  await page.goto("/admin/events/new");
  await page.getByLabel("Título").fill(expired);
  await page.getByLabel("Publicar el").fill("2019-01-01T08:00");
  await page.getByLabel("Retirar el").fill("2020-01-01T08:00");
  // Click the visible switch: forcing a click on the hidden input can land on the sticky action bar.
  await page.locator("label").filter({ has: page.getByRole("switch", { name: /Publicado/ }) }).click();
  await expect(page.getByRole("switch", { name: /Publicado/ })).toBeChecked();
  await page.getByRole("button", { name: "Crear evento" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/);

  expect(await publicTitles()).not.toContain(expired);
  await page.goto("/admin/events");
  await expect(page.getByRole("listitem").filter({ hasText: expired }).getByText("Vencido", { exact: true })).toBeVisible();
});

test("a window that closes before it opens is refused with a message on the field", async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/news/new");
  await page.getByLabel("Título").fill(`E2E ventana ${Date.now()}`);
  await page.getByLabel("Resumen").fill("Resumen");
  await page.getByLabel("Texto").fill("Cuerpo");
  await page.getByLabel("Publicar el").fill("2030-02-01T08:00");
  await page.getByLabel("Retirar el").fill("2030-01-01T08:00");
  await page.getByRole("button", { name: "Crear noticia" }).click();

  await expect(page.getByText("La fecha de retiro debe ser posterior a la de publicación.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/news\/new$/);
});

test("previews and the cron fail closed: no token, no secret and no session reveal or trigger anything", async ({ page, request }) => {
  const preview = await request.get("/api/public/preview");

  expect(preview.status()).toBe(401);
  expect(preview.headers()["cache-control"]).toBe("no-store");
  expect(await preview.json()).toEqual({ error: "Invalid or expired preview token" });
  expect((await request.get("/api/public/preview", { headers: { "X-Preview-Token": "forged.token.value" } })).status()).toBe(401);

  const cron = await request.get("/api/cron/scheduled-rebuild");

  expect(cron.status()).toBe(401);
  expect((await request.get("/api/cron/scheduled-rebuild", { headers: { authorization: "Bearer not-the-secret" } })).status()).toBe(401);

  // The page that generates codes is admin-only territory and says plainly when the server has no secret.
  await page.goto("/admin/vista-previa");
  await expect(page).toHaveURL(/\/login$/);
  await logInAsAdmin(page);
  await page.goto("/admin/vista-previa");
  await expect(page.getByRole("heading", { name: "Vista previa", level: 1 })).toBeVisible();
  await expect(page.getByText(/falta|no está configurada/i).first()).toBeVisible();
});
