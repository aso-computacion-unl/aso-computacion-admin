import { expect, test, type Page } from "@playwright/test";

/*
 * The event editor on a phone: the content first, then the «Publicación» panel, and the save bar always in reach
 * above the tab bar, with nothing wider than the screen. The same form serves Eventos (new and edit) and Inscripciones (new).
 */
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test.use({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-real-ip": `198.51.100.${(Date.now() % 250) + 1}` } });

async function logInAsAdmin(page: Page) {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const saveBar = (page: Page) => page.locator('[data-slot="action-bar"]');
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Áreas" });

/** The save bar is on screen, whole, and sits on top of the tab bar without covering it. */
async function expectSaveBarInReach(page: Page, submitLabel: RegExp) {
  await expect(saveBar(page).getByRole("button", { name: submitLabel })).toBeInViewport({ ratio: 1 });

  const bar = (await saveBar(page).boundingBox())!;
  const tabs = (await tabBar(page).boundingBox())!;

  expect(bar.y).toBeGreaterThanOrEqual(0);
  expect(bar.y + bar.height).toBeLessThanOrEqual(tabs.y + 0.5);
}

async function expectFitsAPhone(page: Page, { submitLabel, segmented }: { submitLabel: RegExp; segmented: string[] }) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  // The content first, then «Publicación»: the panel starts below the content. Both read in one go, so a scroll between them cannot skew it.
  const contentFirst = await page.evaluate(() => {
    const content = document.querySelector("form > section")!.getBoundingClientRect();
    const panel = document.querySelector('form section[aria-label="Publicación"]')!.getBoundingClientRect();

    return panel.top >= content.bottom;
  });
  expect(contentFirst).toBe(true);

  // Every segmented control keeps its cells inside the content panel, and each label inside its cell, at least 44 px tall.
  for (const legend of segmented) {
    const cells = page.getByRole("group", { name: legend, exact: true }).locator("> div");

    expect(
      await cells.evaluate((element) => {
        const outer = element.closest("form > section")!.getBoundingClientRect();
        const labels = [...element.querySelectorAll<HTMLElement>("label > span")];

        return (
          element.getBoundingClientRect().right <= outer.right + 0.5 &&
          element.scrollWidth <= element.clientWidth &&
          labels.every((label) => label.scrollWidth <= label.clientWidth && label.getBoundingClientRect().height >= 44)
        );
      }),
    ).toBe(true);
  }

  // 44 px targets: the fields, the disclosures, the switches and the save button.
  const targets = [
    page.getByLabel("Título"),
    page.getByLabel(/^(Fecha|Mes)$/),
    page.getByLabel("Hora"),
    page.getByLabel("Lugar"),
    page.getByText("Más opciones", { exact: true }),
    page.getByText("Programar publicación y retiro", { exact: true }),
    page.locator("label").filter({ has: page.getByRole("switch", { name: "Publicado" }) }),
    page.locator("label").filter({ has: page.getByRole("switch", { name: "Destacado" }) }),
    saveBar(page).getByRole("button", { name: submitLabel }),
  ];
  for (const target of targets) expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // The preview card keeps every line, the registration chip included, inside the panel.
  const preview = page.getByRole("group", { name: "Así se verá en la línea de tiempo" });
  expect(await preview.evaluate((card) => [...card.children].every((line) => line.getBoundingClientRect().right <= card.getBoundingClientRect().right + 0.5))).toBe(true);

  // The save bar is in reach at the top of the page and halfway down it.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectSaveBarInReach(page, submitLabel);
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2));
  await expectSaveBarInReach(page, submitLabel);
}

test("a new event fits a phone, with the save bar in reach above the tab bar", async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/events/new", { waitUntil: "networkidle" });
  // The registration group adds «Quién se inscribe» and the chip in the preview.
  await page.getByRole("radio", { name: "Evento con inscripción", exact: true }).check();
  await page.getByLabel("Lugar").fill("Laboratorio de redes del bloque de Computación, segundo piso");

  await expectFitsAPhone(page, { submitLabel: /Crear evento/, segmented: ["Tipo de evento", "Tipo", "Tipo de fecha", "Quién se inscribe"] });
});

test("a new registration fits a phone, with the save bar in reach above the tab bar", async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/registrations/new", { waitUntil: "networkidle" });
  await page.getByLabel("Cupos").fill("120");
  await page.getByLabel("Cierre", { exact: true }).fill("2099-11-20T18:00");

  await expectFitsAPhone(page, { submitLabel: /Crear inscripción/, segmented: ["Tipo", "Tipo de fecha", "Quién se inscribe"] });
});

test("an event's edit page fits a phone, with the save bar in reach above the tab bar", async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/events/new", { waitUntil: "networkidle" });
  await page.getByLabel("Título").fill(`E2E editor celular ${Date.now()}`);
  await page.getByLabel("Fecha", { exact: true }).fill("2099-11-28");
  await page.getByRole("button", { name: "Crear evento" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit/);
  await page.goto(new URL(page.url()).pathname, { waitUntil: "networkidle" });

  await expectFitsAPhone(page, { submitLabel: /Guardar cambios/, segmented: ["Tipo", "Tipo de fecha"] });
});
