import { expect, test, type Page } from "@playwright/test";

import { openMoreOptions } from "./more-options";
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

test("the rail asks before it leaves unsaved changes, and leaves only on 'Salir sin guardar'", async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/faqs/new");
  await page.getByLabel("Pregunta", { exact: true }).fill(`¿Sin guardar ${STAMP}?`);

  const rail = page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Inscripciones" }).first();
  const question = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });

  await rail.click();
  await expect(question).toBeVisible();
  await expect(question.getByRole("button", { name: "Seguir editando" })).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/faqs\/new$/);

  await page.keyboard.press("Escape");
  await expect(question).toHaveCount(0);
  await expect(rail).toBeFocused();
  await expect(page.getByLabel("Pregunta", { exact: true })).toHaveValue(`¿Sin guardar ${STAMP}?`);

  await rail.click();
  await question.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/registrations$/);
});

test("a link inside a page's own content asks before it leaves unsaved changes, and leaves only on 'Salir sin guardar'", async ({ page }) => {
  await logInAsAdmin(page);

  // A published upcoming event without registration: its edit page links to «Crear inscripción» from its own content, and
  // a published item never autosaves, so the change stays unsaved.
  await page.goto("/admin/events/new", { waitUntil: "networkidle" });
  await page.getByLabel("Título").fill(`E2E enlace ${STAMP}`);
  await page.getByLabel("Fecha", { exact: true }).fill("2099-11-28");
  await openMoreOptions(page);
  await page.getByLabel("Hora").fill("09:00 - 11:00");
  await page.getByLabel("Lugar").fill("Laboratorio 2");
  await page.locator("label").filter({ has: page.getByRole("switch", { name: /Publicado/ }) }).click();
  await publish(page);
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit(?:[?#].*)?$/);
  const id = /\/admin\/events\/([^/]+)\/edit/.exec(page.url())![1]!;

  await page.getByLabel("Título").fill(`E2E enlace ${STAMP} sin guardar`);

  const link = page.getByRole("link", { name: "Crear inscripción" });
  const question = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });

  await link.click();
  await expect(question).toBeVisible();
  await expect(question.getByRole("button", { name: "Seguir editando" })).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/admin/events/${id}/edit`));

  await page.keyboard.press("Escape");
  await expect(question).toHaveCount(0);
  await expect(link).toBeFocused();
  await expect(page.getByLabel("Título")).toHaveValue(`E2E enlace ${STAMP} sin guardar`);

  await link.click();
  await question.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/registrations/new\\?evento=${id}$`));
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the top bar's logo asks before it leaves unsaved changes, and goes home only on 'Salir sin guardar'", async ({ page }) => {
    await logInAsAdmin(page);
    await page.goto("/admin/faqs/new");
    await page.getByLabel("Pregunta", { exact: true }).fill(`¿Logo sin guardar ${STAMP}?`);

    const logo = page.getByRole("link", { name: "ASO Computación, inicio de la administración" });
    const question = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });

    await logo.click();
    await expect(question).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/faqs\/new$/);

    await page.keyboard.press("Escape");
    await expect(question).toHaveCount(0);
    await expect(logo).toBeFocused();
    await expect(page.getByLabel("Pregunta", { exact: true })).toHaveValue(`¿Logo sin guardar ${STAMP}?`);

    await logo.click();
    await question.getByRole("button", { name: "Salir sin guardar" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test("'Cerrar sesión' asks before it leaves unsaved changes, and signs out only on 'Salir sin guardar'", async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/faqs/new");
  await page.getByLabel("Pregunta", { exact: true }).fill(`¿Salida sin guardar ${STAMP}?`);

  const chip = page.locator('header button[aria-haspopup="true"]');
  const signOut = page.getByRole("button", { name: "Cerrar sesión" });
  const question = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });

  await chip.click();
  await signOut.click();
  await expect(question).toBeVisible();

  await question.getByRole("button", { name: "Seguir editando" }).click();
  await expect(question).toHaveCount(0);
  await expect(chip).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/faqs\/new$/);
  await expect(page.getByLabel("Pregunta", { exact: true })).toHaveValue(`¿Salida sin guardar ${STAMP}?`);

  await chip.click();
  await signOut.click();
  await question.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
