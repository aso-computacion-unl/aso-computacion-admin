import { expect, test, type Page } from "@playwright/test";

import { publish } from "./publish";

/*
 * S6: an unpublished draft that is being edited saves by itself once the typing stops ("Guardado");
 * a published item and a create page never do. The FAQ editor stands for all eight editors: they share one hook.
 */
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STAMP = Date.now().toString(36);
// The debounce is 1.8 s: waiting twice that long without a save shows there will not be one.
const QUIET_MS = 4000;

test.use({ extraHTTPHeaders: { "x-real-ip": `198.51.100.${(Date.now() % 250) + 1}` } });

async function logInAsAdmin(page: Page) {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const saveStatus = (page: Page) => page.locator('[data-slot="autosave-status"]');

/** Creates a FAQ (a draft unless `published`) and opens its edit page. */
async function openFaq(page: Page, question: string, published: boolean) {
  await page.goto("/admin/faqs/new");
  await page.getByLabel("Pregunta", { exact: true }).fill(question);
  await page.getByLabel("Respuesta").fill("Respuesta inicial");
  if (published) {
    await page.locator("label").filter({ has: page.getByRole("switch", { name: /Publicada/ }) }).click();
    await publish(page);
  } else {
    await page.getByRole("button", { name: "Crear pregunta" }).click();
  }
  await expect(page).toHaveURL(/\/admin\/faqs$/);
  await page.goto(`/admin/faqs?q=${STAMP}`);
  await page.getByRole("link", { name: `Editar: ${question}` }).click();
  await expect(page).toHaveURL(/\/admin\/faqs\/[^/]+\/edit$/);
  await expect(page.getByLabel("Pregunta", { exact: true })).toHaveValue(question);
}

test("a draft that is edited saves by itself, says Guardado and the change is there after a reload", async ({ page }) => {
  const question = `¿Borrador ${STAMP}?`;

  await logInAsAdmin(page);
  await openFaq(page, question, false);
  await expect(saveStatus(page)).toHaveText("");

  await page.getByLabel("Respuesta").fill("Respuesta autoguardada");
  await expect(saveStatus(page)).toHaveText("Guardado", { timeout: 15_000 });
  // The save needs no button and raises no toast.
  await expect(page.getByRole("status").getByText("Cambios guardados.")).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel("Respuesta")).toHaveValue("Respuesta autoguardada");
});

test("a published item is not saved by itself: only 'Sí, publicar' stores the edit", async ({ page, context }) => {
  const question = `¿Publicada ${STAMP}?`;

  await logInAsAdmin(page);
  await openFaq(page, question, true);

  await page.getByLabel("Respuesta").fill("Respuesta sin publicar");
  await page.waitForTimeout(QUIET_MS);
  await expect(saveStatus(page)).toHaveText("");

  // Another tab still reads the stored answer.
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel("Respuesta")).toHaveValue("Respuesta inicial");

  await publish(page);
  await other.reload();
  await expect(other.getByLabel("Respuesta")).toHaveValue("Respuesta sin publicar");
});

test("a create page never saves by itself: nothing exists until 'Crear pregunta'", async ({ page, context }) => {
  const question = `¿Sin crear ${STAMP}?`;

  await logInAsAdmin(page);
  await page.goto("/admin/faqs/new");
  await page.getByLabel("Pregunta", { exact: true }).fill(question);
  await page.getByLabel("Respuesta").fill("Respuesta");
  await page.waitForTimeout(QUIET_MS);
  await expect(saveStatus(page)).toHaveCount(0);

  const other = await context.newPage();
  await other.goto(`/admin/faqs?q=${STAMP}`);
  await expect(other.getByRole("link", { name: `Editar: ${question}` })).toHaveCount(0);
});
