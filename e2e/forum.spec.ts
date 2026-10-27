import { expect, test, type Page } from "@playwright/test";

// The forum login needs a real Google account, so this suite covers what a visitor can see and what stays
// closed to them. Signed-in screens are covered by the unit tests over the in-memory forum.
// This server has no FORUM_* variables, so the forum login is switched off, as it is until the owner sets them up.
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  expect(overflow).toBeLessThanOrEqual(0);
}

test("a visitor at /foro sees the sign-in and none of the forum, on a phone too", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/foro");

  await expect(page.getByRole("heading", { level: 1, name: "El foro de Computación" })).toBeVisible();
  const signIn = page.getByRole("link", { name: "Entrar con Google" });
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute("href", "/foro/auth/google/start");
  await expect(page.getByRole("link", { name: "Cerrar sesión" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Menú de cuenta/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Hilos" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("a visitor is sent back to the sign-in from every member-only page", async ({ page }) => {
  for (const path of ["/foro/c/programacion", "/foro/c/programacion/nuevo", "/foro/hilo/nope"]) {
    await page.goto(path);

    await expect(page, path).toHaveURL(`/foro?next=${encodeURIComponent(path)}`);
    await expect(page.getByRole("link", { name: "Entrar con Google" })).toHaveAttribute(
      "href",
      `/foro/auth/google/start?next=${encodeURIComponent(path)}`,
    );
  }
});

test("with the forum login switched off, trying to sign in says it is unavailable", async ({ page }) => {
  await page.goto("/foro");
  await page.getByRole("link", { name: "Entrar con Google" }).click();

  await expect(page).toHaveURL(/\/foro\?error=unavailable$/);
  await expect(page.getByRole("alert")).toContainText("El acceso al foro no está disponible ahora.");
  await expect(page.getByRole("link", { name: "Entrar de nuevo con Google" })).toBeVisible();
});

test("an admin session is not a forum member", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/foro");

  await expect(page.getByRole("link", { name: "Entrar con Google" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hilos" })).toHaveCount(0);

  await page.goto("/foro/c/programacion");
  await expect(page).toHaveURL(`/foro?next=${encodeURIComponent("/foro/c/programacion")}`);
});
