import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Presses a shortcut until the page goes: right after a load the palette's key listener may not be attached yet (hydration). */
async function pressShortcut(page: Page, key: string, url: RegExp) {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(page).toHaveURL(url, { timeout: 1000 });
  }).toPass();
}

// The layout mounts the palette, so it works away from the home too.
test("Ctrl K opens the palette on any admin page; typing filters, arrows and Enter go, Escape gives the focus back", async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/events");

  const dialog = page.getByRole("dialog", { name: "Buscar o crear" });
  const opener = page.getByRole("region", { name: /^Sesión:/ }).getByRole("button", { name: "Cerrar sesión" });

  await opener.focus();
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(dialog.getByRole("combobox")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/events$/);

  await page.keyboard.press("Control+k");
  await page.keyboard.type("nueva");
  const options = dialog.getByRole("option");
  await expect(options.filter({ hasText: "Nueva novedad" })).toHaveCount(1);
  await expect(options.filter({ hasText: "Nuevo evento" })).toHaveCount(0);

  // The first match is active; ArrowDown moves to the next one and Enter goes there.
  const second = (await options.nth(1).getAttribute("href")) ?? "";
  expect(second).not.toBe("");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${second.replace(/[/]/g, "\\/")}$`));
  await expect(dialog).toHaveCount(0);
});

test("E, N and P go to the create pages, but stay plain letters while typing in a field", async ({ page }) => {
  await logInAsAdmin(page);

  await page.goto("/admin/events");
  await pressShortcut(page, "e", /\/admin\/events\/new$/);

  await page.goto("/admin/events");
  await pressShortcut(page, "n", /\/admin\/news\/new$/);

  await page.goto("/admin/events");
  await pressShortcut(page, "p", /\/admin\/faqs\/new$/);

  // In a field the key is text: the page stays and the field gets the letter.
  const field = page.getByLabel("Pregunta", { exact: true });
  await field.click();
  await page.keyboard.press("e");
  await expect(field).toHaveValue("e");
  await expect(page).toHaveURL(/\/admin\/faqs\/new$/);
});
