import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
// Signed cookie value of an editor session that scripts/run-e2e.mjs planted in the database.
const EDITOR_SESSION = process.env.E2E_EDITOR_SESSION ?? "";
const BASE_URL = "http://127.0.0.1:3100";

async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Creates a published FAQ and comes back to the list. */
async function createFaq(page: Page, question: string) {
  await page.goto("/admin/faqs/new");
  await page.getByLabel("Pregunta").fill(question);
  await page.getByLabel("Respuesta").fill("Una respuesta corta.");
  await page.getByRole("switch", { name: /Publicada/ }).setChecked(true, { force: true });
  await page.getByRole("button", { name: "Crear pregunta" }).click();
  await expect(page).toHaveURL(/\/admin\/faqs$/);
  await expect(page.getByRole("link", { name: question }).first()).toBeVisible();
}

test("a list can be searched, and the rows selected on it can be unpublished and trashed in one step", async ({ page, request }) => {
  const stamp = Date.now();
  const questions = [`Alfa ${stamp}`, `Beta ${stamp}`, `Gamma ${stamp}`];
  // A list under five rows is short and hides its search and select-all bar: two more rows make this one long enough to have them.
  const fillers = [`Relleno uno ${stamp}`, `Relleno dos ${stamp}`];
  const publicQuestions = async () => ((await (await request.get("/api/public/content")).json()).faqs as { question: string }[]).map((faq) => faq.question);

  await logInAsAdmin(page);
  for (const question of [...questions, ...fillers]) await createFaq(page, question);
  expect(await publicQuestions()).toEqual(expect.arrayContaining(questions));

  // Search narrows the list to what matches, with the count, and clearing it brings the rest back.
  await page.goto("/admin/faqs");
  await page.getByRole("searchbox", { name: "Buscar en preguntas" }).fill(`Beta ${stamp}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.getByRole("link", { name: questions[1]! }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: questions[0]! })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "1 resultado" })).toBeVisible();
  await page.getByRole("link", { name: "Quitar búsqueda" }).click();
  await expect(page.getByRole("link", { name: questions[0]! }).first()).toBeVisible();

  // Select two rows and send them back to draft: they leave the public API, the third stays.
  await page.getByRole("checkbox", { name: `Seleccionar: ${questions[0]}` }).check();
  await page.getByRole("checkbox", { name: `Seleccionar: ${questions[2]}` }).check();
  await expect(page.getByText("2 seleccionados")).toBeVisible();
  await page.getByRole("button", { name: "Pasar a borrador" }).click();
  await expect(page.getByText("¿Pasar 2 elementos a borrador?")).toBeVisible();
  await page.getByRole("button", { name: "Sí, pasar a borrador" }).click();
  await expect(page.getByRole("status").getByText("2 elementos pasados a borrador.")).toBeVisible();
  await expect(page.getByRole("switch", { name: `Publicado: ${questions[0]}` })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: `Publicado: ${questions[1]}` })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Nada seleccionado")).toBeVisible();
  const afterUnpublish = await publicQuestions();
  expect(afterUnpublish).toContain(questions[1]);
  expect(afterUnpublish).not.toContain(questions[0]);
  expect(afterUnpublish).not.toContain(questions[2]);

  // Trash all of them with one confirmation: they leave the list and show up in the trash.
  for (const question of [...questions, ...fillers]) await page.getByRole("checkbox", { name: `Seleccionar: ${question}` }).check();
  await page.getByRole("button", { name: "Mover a la papelera", exact: true }).click();
  await page.getByRole("button", { name: "Sí, mover" }).click();
  await expect(page.getByRole("status").getByText("5 elementos movidos a la papelera.")).toBeVisible();
  await expect(page.getByRole("link", { name: questions[0]! })).toHaveCount(0);
  expect(await publicQuestions()).not.toEqual(expect.arrayContaining([questions[1]!]));
  await page.goto("/admin/papelera");
  for (const question of questions) await expect(page.getByText(question).first()).toBeVisible();
});

test("an ordered list can be reordered by dragging a row's handle or with the keyboard, and the order sticks", async ({ page, request }) => {
  const stamp = Date.now();
  const questions = [`Uno ${stamp}`, `Dos ${stamp}`, `Tres ${stamp}`];
  const shownOrder = () => page.getByRole("list", { name: "Preguntas frecuentes, en el orden en que se muestran" }).getByRole("heading", { level: 2 }).allTextContents();
  const mine = async () => (await shownOrder()).filter((question) => question.endsWith(String(stamp)));
  const publicOrder = async () =>
    ((await (await request.get("/api/public/content")).json()).faqs as { question: string }[]).map((faq) => faq.question).filter((question) => question.endsWith(String(stamp)));

  await logInAsAdmin(page);
  for (const question of questions) await createFaq(page, question);
  await expect.poll(mine).toEqual(questions);

  // Drag the first row down onto the last one.
  const handle = (question: string) => page.getByRole("button", { name: `Arrastrar para reordenar: ${question}` });
  // The list holds whatever other specs left in it, so the new rows may start below the fold: center the middle one,
  // which keeps the first and the last on screen (scrolling the last just into view leaves the first above the top
  // and the last at the bottom edge). Instant: the page scrolls smoothly, and the boxes below would be read mid-scroll.
  await handle(questions[1]!).evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));

  const from = (await handle(questions[0]!).boundingBox())!;
  const to = (await handle(questions[2]!).boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 4, { steps: 15 });
  await page.mouse.up();

  // The place counts the rows other specs left in the list; the order of the three is checked below.
  await expect(page.getByRole("status").getByText(new RegExp(`${questions[0]}: posición \\d+ de`))).toBeVisible();
  await expect.poll(mine).toEqual([questions[1], questions[2], questions[0]]);
  expect(await publicOrder()).toEqual([questions[1], questions[2], questions[0]]);
  await page.reload();
  await expect.poll(mine).toEqual([questions[1], questions[2], questions[0]]);

  // The same with the keyboard: pick the last row up, one place up, drop it (once the page has hydrated, or the keys go nowhere).
  await page.waitForLoadState("networkidle");
  await handle(questions[0]!).focus();
  await page.keyboard.press("Space");
  const over = (place: number | string) => page.getByText(new RegExp(`«${questions[0]}» está sobre la posición ${place} de`));

  await expect(over("\\d+")).toBeAttached();

  const last = Number(/posición (\d+)/.exec((await over("\\d+").textContent()) ?? "")?.[1]);

  await page.keyboard.press("ArrowUp");
  await expect(over(last - 1)).toBeAttached();
  await page.keyboard.press("Space");

  await expect.poll(mine).toEqual([questions[1], questions[0], questions[2]]);
  await page.reload();
  await expect.poll(mine).toEqual([questions[1], questions[0], questions[2]]);
  expect(await publicOrder()).toEqual([questions[1], questions[0], questions[2]]);

  // Searching hides the handles: a place in the whole list is not known for a subset.
  await page.goto(`/admin/faqs?q=${stamp}`);
  await expect(page.getByRole("link", { name: questions[0]! }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Arrastrar para reordenar/ })).toHaveCount(0);
});

test("the media library opens even when the image storage is not configured, and says so", async ({ page }) => {
  await logInAsAdmin(page);
  await page.getByRole("link", { name: "Medios" }).first().click();

  await expect(page).toHaveURL(/\/admin\/medios$/);
  await expect(page.getByRole("heading", { name: "Medios", level: 1 })).toBeVisible();
  await expect(page.getByText("El almacén de imágenes no está configurado")).toBeVisible();
});

test("the unused-image cleanup is for admins: it opens for them as a dry run, and an editor is sent home without a way in", async ({ page, context }) => {
  await logInAsAdmin(page);
  await page.goto("/admin/medios");
  await page.getByRole("link", { name: "Buscar imágenes sin uso" }).click();

  await expect(page).toHaveURL(/\/admin\/medios\/limpieza$/);
  await expect(page.getByRole("heading", { name: "Imágenes sin uso", level: 1 })).toBeVisible();
  await expect(page.getByText("Esta revisión no borra nada")).toBeVisible();
  // No storage in the test environment: nothing to choose, nothing to delete.
  await expect(page.getByText("El almacén de imágenes no está configurado")).toBeVisible();
  await expect(page.getByRole("button", { name: /Eliminar/ })).toHaveCount(0);

  await context.clearCookies();
  await context.addCookies([{ name: "admin_session", value: EDITOR_SESSION, url: BASE_URL }]);
  await page.goto("/admin/medios");
  await expect(page.getByRole("heading", { name: "Medios", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Buscar imágenes sin uso" })).toHaveCount(0);
  await page.goto("/admin/medios/limpieza");
  await expect(page).toHaveURL(/\/admin\?acceso=restringido$/);
});
