import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

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
  const publicQuestions = async () => ((await (await request.get("/api/public/content")).json()).faqs as { question: string }[]).map((faq) => faq.question);

  await logInAsAdmin(page);
  for (const question of questions) await createFaq(page, question);
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

  // Trash all three with one confirmation: they leave the list and show up in the trash.
  await page.getByRole("checkbox", { name: `Seleccionar: ${questions[0]}` }).check();
  await page.getByRole("checkbox", { name: `Seleccionar: ${questions[1]}` }).check();
  await page.getByRole("checkbox", { name: `Seleccionar: ${questions[2]}` }).check();
  await page.getByRole("button", { name: "Mover a la papelera", exact: true }).click();
  await page.getByRole("button", { name: "Sí, mover" }).click();
  await expect(page.getByRole("status").getByText("3 elementos movidos a la papelera.")).toBeVisible();
  await expect(page.getByRole("link", { name: questions[0]! })).toHaveCount(0);
  expect(await publicQuestions()).not.toEqual(expect.arrayContaining([questions[1]!]));
  await page.goto("/admin/papelera");
  for (const question of questions) await expect(page.getByText(question).first()).toBeVisible();
});
