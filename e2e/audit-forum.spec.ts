import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { FORUM_SESSION_SECRET as SECRET, plantForumMemberSession, type PlantedForumMemberSession } from "./support/forum-session";

/*
 * Code in forum posts, as students actually write it: inline backticks, indented fences, tilde fences and
 * fences with words after the language, through the composer, its toolbar and the published thread.
 * Opt-in like forum-member.spec.ts (a planted member session needs the signing secret):
 *
 *   FORUM_SESSION_SECRET=<at least 32 characters> npm run e2e
 */
const prisma = createPrismaClient(process.env.DATABASE_URL);
const CATEGORY = { id: "af-cat", slug: "audit-codigo", name: "Código (auditoría)" };
const MEMBER = { id: "af-m1", session: "af-s1" };

let member: PlantedForumMemberSession;

test.skip(!SECRET, "set FORUM_SESSION_SECRET to run the signed-in forum suite");

test.beforeAll(async () => {
  if (!SECRET) return;

  member = await plantForumMemberSession(prisma, { memberId: MEMBER.id, sessionId: MEMBER.session, displayName: "Lucía A." });
  await prisma.forumCategory.upsert({ where: { id: CATEGORY.id }, update: {}, create: { ...CATEGORY, description: "Bloques de código", sortOrder: 99, updatedAt: new Date() } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function memberContext(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL });
  await context.addCookies([member.cookie]);

  return context;
}

const preview = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: "Vista previa" }) });

test("code written in the usual ways renders as code, without its backticks, in the preview and in the published thread", async ({ browser, baseURL }) => {
  const context = await memberContext(browser, baseURL);
  const page = await context.newPage();
  const title = `Código de auditoría ${Date.now()}`;
  const body = [
    "Uso `printf` y ``a`b`` en línea.",
    "",
    "  ```c",
    "  int x = 0;",
    "  ```",
    "",
    "~~~",
    "ls -la",
    "~~~",
    "",
    "```js title=demo",
    "console.log(1)",
    "```",
  ].join("\n");

  await page.goto(`/foro/c/${CATEGORY.slug}/nuevo`);
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Texto (Markdown)").fill(body);

  for (const scope of [preview(page)]) {
    await expect(scope.locator("p code")).toHaveText(["printf", "a`b"]);
    await expect(scope.locator("pre code")).toHaveText(["int x = 0;", "ls -la", "console.log(1)"]);
    await expect(scope.locator("pre").first()).toHaveAttribute("data-language", "c");
    await expect(scope).not.toContainText("```");
    await expect(scope).not.toContainText("~~~");
  }

  await page.getByRole("button", { name: "Publicar hilo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 15_000 });
  const post = page.locator("article").first();
  await expect(post.locator("p code")).toHaveText(["printf", "a`b"]);
  await expect(post.locator("pre code")).toHaveText(["int x = 0;", "ls -la", "console.log(1)"]);
  await expect(post).not.toContainText("```");

  await context.close();
});

test("the toolbar wraps a word as inline code and the very first keystroke after the block button lands inside the block", async ({ browser, baseURL }) => {
  const context = await memberContext(browser, baseURL);
  const page = await context.newPage();
  const field = page.getByLabel("Texto (Markdown)");

  await page.goto(`/foro/c/${CATEGORY.slug}/nuevo`);
  await field.fill("Use printf ya");
  await field.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(4, 10));
  await page.getByRole("button", { name: "Código en línea" }).click();
  await expect(field).toHaveValue("Use `printf` ya");
  await expect(preview(page).locator("p code")).toHaveText(["printf"]);

  await field.fill("");
  await page.getByRole("button", { name: "Bloque de código" }).click();
  await page.keyboard.type("int main(void) {}");
  await expect(field).toHaveValue("```\nint main(void) {}\n```");
  await expect(preview(page).locator("pre code")).toHaveText(["int main(void) {}"]);

  await context.close();
});

test("edge cases stay safe: HTML inside code is text, a fence or backtick that never closes stays literal", async ({ browser, baseURL }) => {
  const context = await memberContext(browser, baseURL);
  const page = await context.newPage();

  await page.goto(`/foro/c/${CATEGORY.slug}/nuevo`);
  await page.getByLabel("Texto (Markdown)").fill("Mire `<img src=x onerror=alert(1)>` y un ` suelto\n\n```ts\nsin cerrar");

  await expect(preview(page).locator("p code").first()).toHaveText("<img src=x onerror=alert(1)>");
  await expect(preview(page).locator("img")).toHaveCount(0);
  await expect(preview(page)).toContainText("un ` suelto");
  await expect(preview(page).locator("pre")).toHaveCount(0);
  await expect(preview(page)).toContainText("```ts sin cerrar");

  await context.close();
});

test("errors: an empty thread is refused next to its fields, and unknown threads and categories are not found", async ({ browser, baseURL }) => {
  const context = await memberContext(browser, baseURL);
  const page = await context.newPage();

  await page.goto(`/foro/c/${CATEGORY.slug}/nuevo`);
  await expect(page.getByLabel("Título")).toHaveAttribute("maxlength", "120");
  await expect(page.getByLabel("Texto (Markdown)")).toHaveAttribute("maxlength", "10000");
  await page.getByLabel("Título").fill("   ");
  await page.getByLabel("Texto (Markdown)").fill("   ");
  // The domain reports one field at a time: the title first, then the text once the title is fixed.
  await page.getByRole("button", { name: "Publicar hilo" }).click();
  await expect(page.getByLabel("Título")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Título").fill("Un título");
  await page.getByRole("button", { name: "Publicar hilo" }).click();
  await expect(page.getByLabel("Texto (Markdown)")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Título")).not.toHaveAttribute("aria-invalid", "true");

  expect((await page.goto("/foro/hilo/no-existe-este-hilo"))?.status()).toBe(404);
  expect((await page.goto("/foro/c/no-existe-esta-categoria/nuevo"))?.status()).toBe(404);

  await context.close();
});
