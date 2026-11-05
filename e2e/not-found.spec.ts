import { expect, test, type Page } from "@playwright/test";

// An address no page owns answers 404 inside the layout of its own segment (F27): the admin keeps its top bar and
// navigation, the forum its top bar. Outside both, the root fallback brings the brand. The admin 404 must not become a
// way to see the shell without a session: the proxy sends a visitor to the login first.
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test.beforeAll(() => {
  // The wrapper script always sets it; a bare `playwright test` would otherwise type an empty password and fail confusingly.
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

/** Logs in with the emergency password and waits for the admin: a `goto` straight after the click would race the login. */
async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("a signed-in admin gets the admin 404 inside the admin layout, with status 404", async ({ page }) => {
  await logInAsAdmin(page);

  for (const path of ["/admin/no-existe", "/admin/no-existe/mas/adentro", "/admin/events/no-existe/extra"]) {
    const response = await page.goto(path);

    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "No encontrado" }), path).toBeVisible();
    await expect(page.getByText("Esta página no existe, ya no está disponible o la dirección cambió."), path).toBeVisible();
    // The shell is there: top bar with the admin home link, and the section navigation.
    await expect(page.getByRole("link", { name: "ASO Computación, inicio de la administración" }), path).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Secciones" }), path).toBeVisible();
    // The way back is the admin home, and the root fallback (brand logo, "Página no encontrada") is not what renders.
    await expect(page.getByRole("link", { name: "Volver al inicio" }), path).toHaveAttribute("href", "/admin");
    await expect(page.getByRole("heading", { name: "Página no encontrada" }), path).toHaveCount(0);
  }
});

test("known admin pages are not swallowed by the catch-all", async ({ page }) => {
  await logInAsAdmin(page);

  for (const path of ["/admin/events", "/admin/events/new", "/admin/faqs"]) {
    const response = await page.goto(path);

    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { name: "No encontrado" }), path).toHaveCount(0);
  }
});

test("without a session an unknown admin address goes to the login and shows no admin shell", async ({ page, request }) => {
  for (const path of ["/admin/no-existe", "/admin/no-existe/mas/adentro"]) {
    // The proxy answers before any page renders: a redirect, not a 404 that would reveal the shell.
    const direct = await request.get(path, { maxRedirects: 0 });

    expect(direct.status(), path).toBe(307);
    expect(new URL(direct.headers()["location"] ?? "", direct.url()).pathname, path).toBe("/login");

    await page.goto(path);

    await expect(page, path).toHaveURL(/\/login$/);
    await expect(page.getByRole("navigation", { name: "Secciones" }), path).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No encontrado" }), path).toHaveCount(0);
  }
});

test("a visitor gets the forum 404 inside the forum layout, with status 404", async ({ page }) => {
  for (const path of ["/foro/no-existe", "/foro/no-existe/mas/adentro"]) {
    const response = await page.goto(path);

    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "No encontrado" }), path).toBeVisible();
    await expect(page.getByText("Esta página del foro no existe, ya no está disponible o la dirección cambió."), path).toBeVisible();
    await expect(page.getByRole("link", { name: "Foro de ASO Computación, inicio" }), path).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al foro" }), path).toHaveAttribute("href", "/foro");
    await expect(page.getByRole("heading", { name: "Página no encontrada" }), path).toHaveCount(0);
  }
});

test("an address outside the admin and the forum keeps the root 404, and /api is not swallowed", async ({ page, request }) => {
  const response = await page.goto("/no-existe");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Secciones" })).toHaveCount(0);

  const api = await request.get("/api/no-existe");

  expect(api.status()).toBe(404);
  expect(await api.text()).not.toContain("Volver al inicio");
  expect((await request.get("/api/health")).status()).toBe(200);
});
