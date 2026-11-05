import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { SignJWT } from "jose";

/*
 * Audit of the admin panel (T3): what e2e/admin.spec.ts and e2e/scale.spec.ts do not cover. Login (the
 * emergency password path), access control, the CRUD sections one by one (validation, bad dates and URLs, long
 * text, unicode, unknown ids), the editor/admin split, trash + restore and what reaches /api/public/content.
 * The editor sessions are planted in the database the same way scripts/run-e2e.mjs does; every title carries a
 * stamp so the specs can share a database with the rest of the suite.
 */
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const SECRET = process.env.ADMIN_SECRET ?? "";
const STAMP = Date.now().toString(36);

// Fixed ids, planted with upsert: a rerun reuses them instead of piling up users. They are this file's own.
const EDITOR = { id: "audit-admin-editor", session: "audit-admin-editor-session", agent: "Mozilla/5.0 (X11; Linux x86_64) Edg/126.0" };
const ROLE_USER = { id: "audit-admin-role-user", session: "audit-admin-role-session", agent: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0" };
const VICTIM = { id: "audit-admin-victim", session: "audit-admin-victim-session", agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15" };

const prisma = createPrismaClient(process.env.DATABASE_URL);
const tokens = new Map<string, string>();

// The login throttle keys on the client address: a made-up one keeps this file's wrong passwords from spending the attempts of the other specs.
const CLIENT_IP = `198.51.100.${(Date.now() % 250) + 1}`;
const CLIENT_HEADERS = { "x-real-ip": CLIENT_IP };

test.use({ extraHTTPHeaders: CLIENT_HEADERS });
// A dev server compiles each route on its first hit; a built server answers well inside this.
test.describe.configure({ timeout: 120_000 });

/** Plants an active user with one open session, the way scripts/run-e2e.mjs does, and signs the cookie value for it. */
async function plantUser(user: { id: string; session: string; agent: string }, role: "EDITOR" | "ADMIN", name: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

  await prisma.user.upsert({
    where: { id: user.id },
    update: { role, active: true, name },
    create: { id: user.id, email: `${user.id}@example.org`, name, role },
  });
  await prisma.session.upsert({
    where: { id: user.session },
    update: { revokedAt: null, expiresAt, lastSeenAt: now },
    create: { id: user.session, kind: "user", userId: user.id, createdAt: now, expiresAt, lastSeenAt: now, userAgent: user.agent },
  });

  const issuedAt = Math.floor(now.getTime() / 1000);

  tokens.set(
    user.id,
    await new SignJWT({ sid: user.session, kind: "user", uid: user.id, role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 3600)
      .sign(new TextEncoder().encode(SECRET)),
  );
}

test.beforeAll(async () => {
  expect(PASSWORD, "ADMIN_PASSWORD must match the running server").not.toBe("");
  expect(SECRET, "ADMIN_SECRET must match the running server").not.toBe("");

  await plantUser(EDITOR, "EDITOR", "Editora auditoría");
  await plantUser(ROLE_USER, "EDITOR", "Rol cambiante");
  await plantUser(VICTIM, "EDITOR", "Víctima auditoría");
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

/** Opens the emergency password form when the login keeps it behind "Acceso de emergencia" (Google is configured). */
async function openPasswordForm(page: Page) {
  const summary = page.locator("details.emergency > summary");

  if (await summary.count()) await summary.click();
}

/** A dev server answers 404 for a while after any source edit (it is recompiling); a built one never does. */
async function openLogin(page: Page) {
  await expect(async () => {
    expect((await page.goto("/login"))?.status()).toBe(200);
  }).toPass({ timeout: 100_000, intervals: [2_000] });
}

async function submitPassword(page: Page, password: string) {
  await openLogin(page);
  await openPasswordForm(page);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

async function logInAsAdmin(page: Page) {
  await submitPassword(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
}

async function asAdmin(browser: Browser, baseURL: string | undefined): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: CLIENT_HEADERS });
  const page = await context.newPage();

  await logInAsAdmin(page);

  return { context, page };
}

/** A browser that carries the planted session of `user` (the editor unless told otherwise). */
async function asEditor(browser: Browser, baseURL: string | undefined, user: { id: string } = EDITOR): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL });

  await context.addCookies([{ name: "admin_session", value: tokens.get(user.id)!, url: baseURL ?? "http://127.0.0.1:3100" }]);

  return { context, page: await context.newPage() };
}

/** `fill` honours `maxlength` like typing does; the server has to hold the limit when a client does not. */
async function fillPastLimit(field: Locator, value: string) {
  await field.evaluate((element) => element.removeAttribute("maxlength"));
  await field.fill(value);
}

// The first hit of a route on a dev server compiles it; assertions that wait for a freshly navigated page use this.
const SLOW = { timeout: 30_000 };

/** The error message wired to a labelled field (`aria-describedby` ends with `-error` only when the field has one). */
async function errorOf(page: Page, label: string | RegExp, options: { exact?: boolean } = { exact: true }): Promise<Locator> {
  const id = await page.getByLabel(label, options).getAttribute("id");

  return page.locator(`[id="${id}-error"]`);
}

/** The real checkbox is visually hidden: a click on its label is what a person does. */
async function setSwitch(page: Page, name: RegExp, on: boolean) {
  const control = page.getByRole("switch", { name });

  if ((await control.isChecked()) !== on) await control.locator("xpath=ancestor::label").click();
  await expect(control).toBeChecked({ checked: on });
}

const publicContent = async (page: Page) => (await page.request.get("/api/public/content")).json();

test.describe("login", () => {
  test("the emergency password path signs in, a wrong, blank, very long or unicode password is refused with the same message", async ({ page }) => {
    await openLogin(page);
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();

    // A blank password never reaches the server: the browser stops the submit on the required field.
    await openPasswordForm(page);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Contraseña")).toHaveJSProperty("validity.valueMissing", true);

    for (const wrong of ["   ", "ñandú-contraseña-€-日本語-🔐", "x".repeat(20_000)]) {
      await submitPassword(page, wrong);
      await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
      // The error is tied to the field for screen readers.
      await expect(page.getByLabel("Contraseña")).toHaveAttribute("aria-invalid", "true");
    }

    await submitPassword(page, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  });

  test("after five wrong passwords the sixth try is held back even with the right one, for that address only", async ({ browser, baseURL }) => {
    const ip = `203.0.113.${(Date.now() % 250) + 1}`;
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": ip } });
    const page = await context.newPage();

    try {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await submitPassword(page, `wrong-${attempt}`);
        await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
      }

      await submitPassword(page, PASSWORD);
      await expect(page.getByText("Demasiados intentos. Intente de nuevo más tarde.")).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);

      // Another address is unaffected.
      const other = await browser.newContext({ baseURL, extraHTTPHeaders: CLIENT_HEADERS });
      await logInAsAdmin(await other.newPage());
      await other.close();
    } finally {
      await prisma.loginAttempt.deleteMany({ where: { key: { contains: ip } } });
      await context.close();
    }
  });

  test("signing out ends the session: the admin sends the browser back to the login", async ({ page }) => {
    await logInAsAdmin(page);
    await page.getByRole("button", { name: /Menú de cuenta/ }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin/events");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a forged, tampered or empty session cookie is treated as no session", async ({ browser, baseURL }) => {
    for (const value of ["", "not-a-jwt", `${tokens.get(EDITOR.id)!}x`, tokens.get(EDITOR.id)!.split(".").slice(0, 2).join(".") + "."]) {
      const context = await browser.newContext({ baseURL });

      await context.addCookies([{ name: "admin_session", value: value || "x", url: baseURL ?? "http://127.0.0.1:3100" }]);
      const page = await context.newPage();

      await page.goto("/admin");
      await expect(page, `cookie ${value.slice(0, 12) || "(blank)"}`).toHaveURL(/\/login/);
      await context.close();
    }
  });
});

test.describe("access control", () => {
  const SECTIONS = [
    "/admin",
    "/admin/events",
    "/admin/events/new",
    "/admin/news",
    "/admin/news/new",
    "/admin/sponsors",
    "/admin/sponsors/new",
    "/admin/commands",
    "/admin/commands/new",
    "/admin/faqs",
    "/admin/faqs/new",
    "/admin/pillars",
    "/admin/pillars/new",
    "/admin/board",
    "/admin/board/new",
    "/admin/socials",
    "/admin/socials/new",
    "/admin/medios",
    "/admin/settings",
    "/admin/usuarios",
    "/admin/sesiones",
    "/admin/papelera",
    "/admin/registro",
    "/admin/vista-previa",
    "/admin/does-not-exist",
  ];

  test("every admin page sends an anonymous visitor to the login without rendering anything", async ({ request }) => {
    for (const path of SECTIONS) {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status(), path).toBe(307);
      expect(response.headers()["location"], path).toMatch(/\/login$/);
    }
  });

  test("the root and spelling variants of an admin path never serve the page to an anonymous visitor", async ({ request }) => {
    expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);

    for (const path of ["/admin/events/", "/%61dmin/events", "/admin//events", "/admin/./events", "/admin/%2e/events", "/admin/events%2f", "/admin/events;a=1", "/admin/events?x=/login"]) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).not.toBe(200);
    }
  });

  test("an editor opens the content sections, and the admin-only sections bounce them with the reason", async ({ browser, baseURL }) => {
    const { context } = await asEditor(browser, baseURL);

    for (const path of ["/admin", "/admin/events", "/admin/news", "/admin/sponsors", "/admin/commands", "/admin/faqs", "/admin/pillars", "/admin/board", "/admin/socials", "/admin/medios", "/admin/papelera", "/admin/sesiones", "/admin/vista-previa"]) {
      expect((await context.request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
    }

    for (const path of ["/admin/usuarios", "/admin/registro", "/admin/settings", "/admin/foro/categorias", "/admin/foro/categorias/new"]) {
      const response = await context.request.get(path, { maxRedirects: 0 });

      expect(response.status(), path).toBe(307);
      expect(response.headers()["location"], path).toMatch(/\/admin\?acceso=restringido$/);
    }

    await context.close();
  });
});

/** Fills the news form (new or edit) with the given fields; a field left out is not touched. */
async function fillNews(page: Page, fields: { title?: string; summary?: string; body?: string; slug?: string; date?: string }) {
  if (fields.title !== undefined) await page.getByLabel("Título").fill(fields.title);
  if (fields.summary !== undefined) await page.getByLabel("Resumen").fill(fields.summary);
  if (fields.body !== undefined) await page.getByLabel("Texto", { exact: true }).fill(fields.body);
  if (fields.slug !== undefined) await page.getByLabel("Identificador (slug)").fill(fields.slug);
  if (fields.date !== undefined) await page.getByLabel("Fecha de publicación").fill(fields.date);
}

test.describe("news", () => {
  test("required fields are reported all at once, each on its own field, with one summary and the focus on the first, and nothing is created", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Noticia incompleta ${STAMP}`;
    const feedback = page.locator('[data-slot="form-feedback"]');

    await page.goto("/admin/news/new");
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(page.getByText("El título es obligatorio y admite hasta 120 caracteres.")).toBeVisible();
    await expect(await errorOf(page, "Resumen")).toBeVisible();
    await expect(await errorOf(page, "Texto")).toBeVisible();
    await expect(feedback).toContainText("Revise 3 campos.");
    await expect(page.getByLabel("Título")).toBeFocused();
    // One announcement for the whole failure: the field errors are read with their fields, not as alerts.
    await expect(page.getByRole("alert")).toHaveCount(1);

    await fillNews(page, { title });
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(feedback).toContainText("Revise 2 campos.");
    await expect(page.getByLabel("Resumen")).toBeFocused();

    await fillNews(page, { summary: "Resumen" });
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(feedback).toContainText("Revise 1 campo.");
    await expect(page.getByLabel("Texto", { exact: true })).toBeFocused();
    await expect(page).toHaveURL(/\/admin\/news\/new$/);

    await page.goto("/admin/news");
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
    await context.close();
  });

  test("limits are enforced by the server, not only by the inputs: 121-character title, 281-character summary, 10001-character body", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);

    await page.goto("/admin/news/new");
    await fillNews(page, { summary: "Resumen", body: "Cuerpo" });
    await fillPastLimit(page.getByLabel("Título"), "T".repeat(121));
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(page.getByText("El título es obligatorio y admite hasta 120 caracteres.")).toBeVisible();

    await fillNews(page, { title: `Límites ${STAMP}` });
    await fillPastLimit(page.getByLabel("Resumen"), "S".repeat(281));
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(page.locator("#" + (await page.getByLabel("Resumen").getAttribute("id")) + "-error")).toBeVisible();

    await fillNews(page, { summary: "S".repeat(280) });
    await fillPastLimit(page.getByLabel("Texto", { exact: true }), "B".repeat(10_001));
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(page.locator("#" + (await page.getByLabel("Texto", { exact: true }).getAttribute("id")) + "-error")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/news\/new$/);
    await context.close();
  });

  test("a news item with unicode and Markdown is created, shown in the preview without live links, published and trashed with the public content following", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Ñandú & café ☕ ${STAMP}`;
    const body = ["Párrafo con **negrita**, *cursiva* y [enlace](https://example.org/ñ).", "", "[trampa](javascript:alert(1)) y <script>alert(1)</script>", "", "- uno", "- dos 🚀"].join("\n");

    await page.goto("/admin/news/new");
    await fillNews(page, { title, summary: "Resumen con ñ y 日本語", body });

    // The preview follows the typing and never turns a javascript: link into a link.
    const preview = page.getByRole("region", { name: "Vista previa" });
    await expect(preview.locator("strong", { hasText: "negrita" })).toBeVisible();
    await expect(preview.locator('a[href="https://example.org/ñ"], a[href="https://example.org/%C3%B1"]')).toHaveCount(1);
    await expect(preview.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(preview.locator("script")).toHaveCount(0);
    await expect(preview.getByText("dos 🚀")).toBeVisible();

    await setSwitch(page, /Publicada/, true);
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit$/, SLOW);

    const news = (await publicContent(page)).news as { title: string; slug: string; publishedAt: string; body: string }[];
    const published = news.find((item) => item.title === title);

    expect(published, "the published news item is in the public content").toBeTruthy();
    expect(published?.slug).toBe(`nandu-cafe-${STAMP}`);
    expect(published?.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(published?.body).toContain("**negrita**");

    await page.goto("/admin/news");
    await page.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
    await page.getByRole("button", { name: "Sí, mover" }).click();
    await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();
    expect(((await publicContent(page)).news as { title: string }[]).map((item) => item.title)).not.toContain(title);
    await context.close();
  });

  test("two news items with the same title get different slugs, and an explicit slug already taken is refused on the slug field", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Mismo título ${STAMP}`;

    for (const expectedSlug of [`mismo-titulo-${STAMP}`, `mismo-titulo-${STAMP}-2`]) {
      await page.goto("/admin/news/new");
      await fillNews(page, { title, summary: "Resumen", body: "Cuerpo" });
      await page.getByRole("button", { name: "Crear noticia" }).click();
      await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit$/, SLOW);
      await expect(page.getByLabel("Identificador (slug)")).toHaveValue(expectedSlug, SLOW);
    }

    await page.getByLabel("Identificador (slug)").fill(`mismo-titulo-${STAMP}`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("El identificador solo admite minúsculas, números y guiones, y no puede repetirse.")).toBeVisible();
    await context.close();
  });

  test("saving a news item that was trashed from another tab says it is gone, in the news wording", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Noticia huérfana ${STAMP}`;

    await page.goto("/admin/news/new");
    await fillNews(page, { title, summary: "Resumen", body: "Cuerpo" });
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit$/, SLOW);
    await expect(page.getByLabel("Título")).toHaveValue(title, SLOW);

    // Another tab sends it to the trash while this one still has the form open.
    const other = await context.newPage();
    await other.goto("/admin/news");
    await other.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
    await other.getByRole("button", { name: "Sí, mover" }).click();
    await expect(other.getByRole("status").getByText("Movido a la papelera")).toBeVisible();

    await page.getByLabel("Resumen").fill("Cambiado");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("No se encontró la novedad.")).toBeVisible();
    await context.close();
  });

  test("a title with no Latin letters or digits still creates the item, with a generic slug the owner did not have to think of", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);

    await page.goto("/admin/news/new");
    await fillNews(page, { title: "日本語🚀", summary: "Resumen", body: "Cuerpo" });
    await page.getByRole("button", { name: "Crear noticia" }).click();

    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit$/, SLOW);
    await expect(page.getByLabel("Título")).toHaveValue("日本語🚀", SLOW);
    await expect(page.getByLabel("Identificador (slug)")).toHaveValue(/^noticia(-\d+)?$/);
    await context.close();
  });
});

test.describe("events", () => {
  test("every bad value is refused on its own field: insecure or script links, a label without a link, over-long and over-many lines, an impossible date", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Evento inválido ${STAMP}`;
    const create = page.getByRole("button", { name: "Crear evento" });
    const cases: { label: string; value: string; past?: true }[] = [
      { label: "Enlace", value: "http://inseguro.example.org" },
      { label: "Enlace", value: "javascript:alert(1)" },
      { label: "Enlace", value: "ftp://archivos.example.org" },
      { label: "Enlace", value: "https://" },
      { label: "Enlace", value: "example.org/sin-esquema" },
      { label: "Descripción", value: "D".repeat(601), past: true },
      { label: "Hora", value: "H".repeat(81), past: true },
      { label: "Puntos destacados", value: Array.from({ length: 9 }, (_, index) => `Punto ${index + 1}`).join("\n") },
      { label: "Puntos destacados", value: "P".repeat(81) },
      { label: "Fecha", value: "0001-01-01" },
    ];

    await page.goto("/admin/events/new");
    await page.getByLabel("Título").fill(title);

    for (const { label, value, past } of cases) {
      const field = page.getByLabel(label, { exact: true });
      const original = await field.inputValue();

      if (past) await fillPastLimit(field, value);
      else await field.fill(value);

      await create.click();
      await expect(await errorOf(page, label), `${label} = ${value.slice(0, 24)}`).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/events\/new$/);
      await field.fill(original);
    }

    // A label for a link that is not there.
    await page.getByLabel("Texto del enlace").fill("Inscríbase aquí");
    await create.click();
    await expect(await errorOf(page, "Texto del enlace")).toBeVisible();
    await page.getByLabel("Texto del enlace").fill("");

    await page.goto("/admin/events");
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
    await context.close();
  });

  test("a full event with unicode, a month-only date and a link is created, shown in the public content as written, edited, and unpublished", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Taller de açaí 🍇 ${STAMP}`;
    const highlights = ["Café ☕ y piano", "日本語 en vivo", "Tercer punto"];

    await page.goto("/admin/events/new");
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Mensaje de commit").fill("feat: açaí 🍇");
    await page.getByRole("radio", { name: "Solo mes" }).check({ force: true });
    await page.getByLabel("Mes", { exact: true }).fill("2031-03");
    await page.getByLabel("Descripción", { exact: true }).fill("Una descripción con ñ, tildes y «comillas».");
    await page.getByLabel("Lugar").fill("Auditorio Ñandú");
    await page.getByLabel("Enlace", { exact: true }).fill("https://example.org/inscripcion?a=1&b=ñ");
    await page.getByLabel("Texto del enlace").fill("Inscripción");
    await page.getByLabel("Puntos destacados").fill(highlights.join("\n\n"));
    await setSwitch(page, /Publicado/, true);
    await page.getByRole("button", { name: "Crear evento" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/, SLOW);

    type PublicEvent = { title: string; slug: string; date: string; datePrecision: string; linkUrl: string; linkLabel: string; highlights: string[]; lugar: string; commitMessage: string };
    const find = async () => ((await publicContent(page)).events as PublicEvent[]).find((event) => event.title === title);
    const event = await find();

    expect(event, "published event is in the public content").toBeTruthy();
    expect(event).toMatchObject({
      slug: `taller-de-acai-${STAMP}`,
      date: "2031-03-01",
      datePrecision: "month",
      linkUrl: "https://example.org/inscripcion?a=1&b=ñ",
      linkLabel: "Inscripción",
      highlights,
      lugar: "Auditorio Ñandú",
      commitMessage: "feat: açaí 🍇",
    });

    // Edit: a changed place reaches the public content; unpublishing removes the event from it.
    // "Cambios guardados." stays on screen after a save, so the public content is what says the next save landed.
    await page.getByLabel("Lugar").fill("Sala 2");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(async () => (await find())?.lugar).toBe("Sala 2");

    await setSwitch(page, /Publicado/, false);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(find).toBeUndefined();
    await context.close();
  });

  test("an event whose slug is taken by another one is refused on the slug field, and one title with no Latin letters still gets an address", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Slug repetido ${STAMP}`;

    await page.goto("/admin/events/new");
    await page.getByLabel("Título").fill(title);
    await page.getByRole("button", { name: "Crear evento" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/, SLOW);

    await page.goto("/admin/events/new");
    await page.getByLabel("Título").fill(`Otro ${STAMP}`);
    await page.getByLabel("Identificador (slug)").fill(`slug-repetido-${STAMP}`);
    await page.getByRole("button", { name: "Crear evento" }).click();
    await expect(await errorOf(page, "Identificador (slug)")).toBeVisible();

    await page.getByLabel("Título").fill("日本語🚀");
    await page.getByLabel("Identificador (slug)").fill("");
    await page.getByRole("button", { name: "Crear evento" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/, SLOW);
    await expect(page.getByLabel("Identificador (slug)")).toHaveValue(/^evento(-\d+)?$/, SLOW);
    await context.close();
  });
});

/** Four letters of the stamp make a command name no other run shares. */
const COMMAND_SUFFIX = STAMP.replace(/[^a-z0-9]/g, "").slice(-6);

async function createCommand(page: Page, fields: { command: string; description?: string; output?: string; published?: boolean }) {
  await page.goto("/admin/commands/new");
  await page.getByLabel("Comando", { exact: true }).fill(fields.command);
  await page.getByLabel("Descripción").fill(fields.description ?? "Una descripción");
  await page.getByLabel("Respuesta").fill(fields.output ?? "Una respuesta");
  if (fields.published) await setSwitch(page, /Publicado/, true);
  await page.getByRole("button", { name: "Crear comando" }).click();
}

test.describe("terminal commands", () => {
  test("a command name must be 2-28 lowercase letters, digits and single hyphens starting with a letter, and not a shell word", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);

    await page.goto("/admin/commands/new");
    await page.getByLabel("Descripción").fill("Descripción");
    await page.getByLabel("Respuesta").fill("Respuesta");

    const bad = ["", "a", "Hola", "mi comando", "1abc", "-abc", "abc-", "ab--cd", "ñandú", "a".repeat(29), "cmd_x", "日本語"];

    for (const name of bad) {
      await fillPastLimit(page.getByLabel("Comando", { exact: true }), name);
      await page.getByRole("button", { name: "Crear comando" }).click();
      await expect(await errorOf(page, "Comando"), `name ${JSON.stringify(name)}`).toContainText("2 a 28 caracteres", SLOW);
    }

    for (const reserved of ["help", "ayuda", "ls", "clear", "git"]) {
      await page.getByLabel("Comando", { exact: true }).fill(reserved);
      await page.getByRole("button", { name: "Crear comando" }).click();
      await expect(await errorOf(page, "Comando"), reserved).toContainText(`«${reserved}» es una palabra reservada del terminal`);
    }

    await expect(page).toHaveURL(/\/admin\/commands\/new$/);
    await context.close();
  });

  test("description and answer limits hold on the server, and a published command reaches the public content with its line breaks", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const command = `lim-${COMMAND_SUFFIX}`;

    await page.goto("/admin/commands/new");
    await page.getByLabel("Comando", { exact: true }).fill(command);
    await fillPastLimit(page.getByLabel("Descripción"), "D".repeat(81));
    await page.getByLabel("Respuesta").fill("Respuesta");
    await page.getByRole("button", { name: "Crear comando" }).click();
    await expect(await errorOf(page, "Descripción")).toBeVisible();

    await page.getByLabel("Descripción").fill("D".repeat(80));
    await fillPastLimit(page.getByLabel("Respuesta"), "R".repeat(601));
    await page.getByRole("button", { name: "Crear comando" }).click();
    await expect(await errorOf(page, "Respuesta")).toBeVisible();

    // Exactly 600 characters, line breaks included: a form post sends each break as CRLF, which must not count twice.
    const lines = ["Línea ñ 🚀", "", "Segunda línea con 日本語", ""];
    const output = [...lines.slice(0, 3), "x".repeat(600 - lines.slice(0, 3).join("\n").length - 1)].join("\n");

    expect(output).toHaveLength(600);
    await page.getByLabel("Respuesta").fill(output);
    await setSwitch(page, /Publicado/, true);
    await page.getByRole("button", { name: "Crear comando" }).click();
    await expect(page).toHaveURL(/\/admin\/commands$/, SLOW);

    const published = ((await publicContent(page)).commands as { command: string; output: string }[]).find((item) => item.command === command);

    expect(published?.output).toBe(output);
    await context.close();
  });

  test("a command name already taken by another command or by a FAQ is refused with who owns it, and a trashed command cannot be restored over a new owner", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const command = `dup-${COMMAND_SUFFIX}`;
    const faqCommand = `faq-${COMMAND_SUFFIX}`;

    await createCommand(page, { command });
    await expect(page).toHaveURL(/\/admin\/commands$/, SLOW);

    await createCommand(page, { command });
    await expect(page.getByText(`«${command}» ya lo usa otro comando. Elija otro nombre.`)).toBeVisible();

    await page.goto("/admin/faqs/new");
    await page.getByLabel("Pregunta").fill(`¿Pregunta de ${faqCommand}?`);
    await page.getByLabel("Respuesta").fill("Respuesta");
    await page.getByLabel("Comando (opcional)").fill(faqCommand);
    await page.getByRole("button", { name: "Crear pregunta" }).click();
    await expect(page).toHaveURL(/\/admin\/faqs$/, SLOW);

    await createCommand(page, { command: faqCommand });
    await expect(page.getByText(`«${faqCommand}» ya lo usa una pregunta frecuente. Elija otro nombre.`)).toBeVisible();

    // The other direction: a FAQ cannot take a command's name either.
    await page.goto("/admin/faqs/new");
    await page.getByLabel("Pregunta").fill(`¿Otra pregunta de ${command}?`);
    await page.getByLabel("Respuesta").fill("Respuesta");
    await page.getByLabel("Comando (opcional)").fill(command);
    await page.getByRole("button", { name: "Crear pregunta" }).click();
    await expect(await errorOf(page, "Comando (opcional)")).toContainText(`«${command}» ya lo usa otro comando`);

    // Trash the command, give its name to a new one, then try to restore the old one.
    await page.goto("/admin/commands");
    await page.getByRole("button", { name: `Mover a la papelera: ${command}` }).click();
    await page.getByRole("button", { name: "Sí, mover" }).click();
    await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();
    await createCommand(page, { command });
    await expect(page).toHaveURL(/\/admin\/commands$/, SLOW);

    await page.goto("/admin/papelera");
    await page.getByRole("button", { name: new RegExp(`Restaurar: .*${command}`) }).click();
    await expect(page.getByText(`No se puede restaurar: «${command}» ya lo usa otro comando.`)).toBeVisible();
    await context.close();
  });
});

/** Submits the open "new" form and reports the first error the page shows, if any. */
const rowFor = (page: Page, label: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name: label, exact: true }) });

test.describe("pillars", () => {
  test("limits and required fields hold; a published pillar keeps its line breaks as plain line breaks in the public content", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Pilar ${STAMP}`;
    const create = page.getByRole("button", { name: "Crear pilar" });

    await page.goto("/admin/pillars/new");
    await create.click();
    await expect(await errorOf(page, "Palabra")).toBeVisible();

    await fillPastLimit(page.getByLabel("Palabra"), "P".repeat(21));
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Texto").fill("Texto");
    await create.click();
    await expect(await errorOf(page, "Palabra")).toBeVisible();

    await page.getByLabel("Palabra").fill("VOZ ñ");
    await fillPastLimit(page.getByLabel("Título"), "T".repeat(61));
    await create.click();
    await expect(await errorOf(page, "Título")).toBeVisible();

    await page.getByLabel("Título").fill(title);
    await fillPastLimit(page.getByLabel("Texto"), "X".repeat(301));
    await create.click();
    await expect(await errorOf(page, "Texto")).toBeVisible();

    const text = ["Primera línea 🚀", "", "Segunda línea"].join("\n");

    await page.getByLabel("Texto").fill(text);
    await setSwitch(page, /Publicado/, true);
    await create.click();
    await expect(page).toHaveURL(/\/admin\/pillars/, SLOW);
    await expect(page).not.toHaveURL(/\/new$/, SLOW);

    const pillar = ((await publicContent(page)).pillars as { title: string; text: string; word: string }[]).find((item) => item.title === title);

    expect(pillar, "the published pillar is in the public content").toBeTruthy();
    expect(pillar?.text).toBe(text);
    expect(pillar?.word).toBe("VOZ ñ");
    await context.close();
  });
});

test.describe("board", () => {
  test("a member without a photo can be saved as a draft but not published, from the form or from the list", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const name = `Ñuño Ángel 日本 ${STAMP}`;
    const add = page.getByRole("button", { name: "Agregar integrante" });

    await page.goto("/admin/board/new");
    await add.click();
    await expect(await errorOf(page, "Nombre")).toBeVisible();

    await fillPastLimit(page.getByLabel("Nombre"), "N".repeat(61));
    await page.getByLabel("Cargo").fill("Presidente");
    await add.click();
    await expect(await errorOf(page, "Nombre")).toBeVisible();

    await page.getByLabel("Nombre").fill(name);
    await fillPastLimit(page.getByLabel("Cargo"), "C".repeat(61));
    await add.click();
    await expect(await errorOf(page, "Cargo")).toBeVisible();

    await page.getByLabel("Cargo").fill("Vocal ñ");
    await setSwitch(page, /Publicado/, true);
    await add.click();
    await expect(page.getByText("Suba una foto antes de publicar al integrante.")).toBeVisible();
    expect(((await publicContent(page)).board as { name: string }[]).map((member) => member.name)).not.toContain(name);

    await setSwitch(page, /Publicado/, false);
    await add.click();
    await expect(page).not.toHaveURL(/\/new$/, SLOW);

    // The list refuses it too, on the row, and the switch falls back to a draft.
    await page.goto("/admin/board");
    const toggle = page.getByRole("switch", { name: `Publicado: ${name}` });

    await toggle.click();
    await expect(page.getByText("Suba una foto antes de publicar al integrante.")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(((await publicContent(page)).board as { name: string }[]).map((member) => member.name)).not.toContain(name);
    await context.close();
  });
});

test.describe("sponsors", () => {
  test("a sponsor needs a name, an https link and, to be published, a logo", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const name = `Aliado ñ ${STAMP}`;
    const create = page.getByRole("button", { name: "Crear aliado" });

    await page.goto("/admin/sponsors/new");
    await create.click();
    await expect(await errorOf(page, "Nombre")).toBeVisible();

    await fillPastLimit(page.getByLabel("Nombre"), "A".repeat(61));
    await create.click();
    await expect(await errorOf(page, "Nombre")).toBeVisible();

    await page.getByLabel("Nombre").fill(name);
    for (const url of ["http://aliado.example.org", "javascript:alert(1)", "aliado.example.org", "https://"]) {
      await page.getByLabel("Enlace (opcional)").fill(url);
      await create.click();
      await expect(await errorOf(page, "Enlace (opcional)"), url).toBeVisible();
    }

    await page.getByLabel("Enlace (opcional)").fill(`https://aliado.example.org/ñ?x=1&y=2#${STAMP}`);
    await setSwitch(page, /Publicado/, true);
    await create.click();
    await expect(page.getByText("Suba un logo antes de publicar al aliado.")).toBeVisible();

    await setSwitch(page, /Publicado/, false);
    await create.click();
    await expect(page).toHaveURL(/\/admin\/sponsors\/[^/]+\/edit$/, SLOW);
    await expect(page.getByLabel("Nombre")).toHaveValue(name, SLOW);

    // Cleared link: saved without one.
    await page.getByLabel("Enlace (opcional)").fill("");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator('[data-slot="form-feedback"]').getByText("Cambios guardados.")).toBeVisible();
    await page.goto("/admin/sponsors");
    await expect(rowFor(page, name).getByText("Sin enlace")).toBeVisible();

    await rowFor(page, name).getByRole("switch").click();
    await expect(page.getByText("Suba un logo antes de publicar al aliado.")).toBeVisible();
    expect(((await publicContent(page)).sponsors as { name: string }[]).map((sponsor) => sponsor.name)).not.toContain(name);
    await context.close();
  });
});

test.describe("social links", () => {
  test("a link needs a network from the list and an https address; the name follows the network until it is edited; a published one reaches the public content", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const handle = `@aso_ñandú_${STAMP}`;
    const add = page.getByRole("button", { name: "Agregar red" });

    await page.goto("/admin/socials/new");
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Instagram");
    await page.getByLabel("Red").selectOption("github");
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("GitHub");
    await page.getByLabel("Nombre", { exact: true }).fill("Nuestro código");
    await page.getByLabel("Red").selectOption("youtube");
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Nuestro código");

    await add.click();
    await expect(await errorOf(page, "Usuario")).toBeVisible();

    await page.getByLabel("Usuario").fill(handle);
    for (const url of ["http://youtube.example.org/aso", "javascript:alert(1)", "youtube.com/aso", ""]) {
      await page.getByLabel("Enlace", { exact: true }).fill(url);
      await add.click();
      await expect(await errorOf(page, "Enlace", { exact: true }), JSON.stringify(url)).toBeVisible();
    }

    await page.getByLabel("Enlace", { exact: true }).fill(`https://youtube.com/@aso?x=${STAMP}`);
    await fillPastLimit(page.getByLabel("Nota (opcional)"), "N".repeat(41));
    await add.click();
    await expect(await errorOf(page, "Nota (opcional)")).toBeVisible();
    await page.getByLabel("Nota (opcional)").fill("Nota ñ");
    await fillPastLimit(page.getByLabel("Descripción corta (opcional)"), "B".repeat(81));
    await add.click();
    await expect(await errorOf(page, "Descripción corta (opcional)")).toBeVisible();
    await page.getByLabel("Descripción corta (opcional)").fill("Videos 🎥 de los talleres");

    await setSwitch(page, /Publicada/, true);
    await add.click();
    await expect(page).not.toHaveURL(/\/new$/, SLOW);

    const link = ((await publicContent(page)).socials as { handle: string; label: string; platform: string; url: string; note: string; blurb: string }[]).find((item) => item.handle === handle);

    expect(link).toMatchObject({ platform: "youtube", label: "Nuestro código", url: `https://youtube.com/@aso?x=${STAMP}`, note: "Nota ñ", blurb: "Videos 🎥 de los talleres" });
    await context.close();
  });
});

test.describe("site settings", () => {
  test("the preview follows the typing, cancel discards it, bad values are refused on their field, and a save reaches the public content (restored afterwards)", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const original = (await publicContent(page)).settings as { tagline: string; description: string; about: string } | null;
    const tagline = `Lema ñ 🚀 ${STAMP}`;
    const about = ["Acerca de: primera línea", "", "Segunda línea con 日本語"].join("\n");

    await page.goto("/admin/settings");
    const preview = page.getByRole("region", { name: "Vista previa" });
    await page.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByLabel("Lema")).toBeFocused();

    // Live preview, and cancel puts the saved texts back.
    const saved = { tagline: await page.getByLabel("Lema").inputValue(), description: await page.getByLabel("Descripción").inputValue(), about: await page.getByLabel("Acerca de").inputValue() };
    await page.getByLabel("Lema").fill("Un lema provisional");
    await expect(preview.getByText("ASO Computación · Un lema provisional")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("button", { name: "Editar" })).toBeFocused();
    await expect(preview.getByText("Un lema provisional")).toHaveCount(0);

    // Required and over-long values never reach the public content.
    await page.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Lema").fill("");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(await errorOf(page, "Lema")).toBeVisible();
    await fillPastLimit(page.getByLabel("Lema"), "L".repeat(121));
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(await errorOf(page, "Lema")).toBeVisible();
    await page.getByLabel("Lema").fill(tagline);
    await fillPastLimit(page.getByLabel("Descripción"), "D".repeat(301));
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(await errorOf(page, "Descripción")).toBeVisible();
    await page.getByLabel("Descripción").fill(saved.description || "Descripción de auditoría");
    await fillPastLimit(page.getByLabel("Acerca de"), "A".repeat(601));
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(await errorOf(page, "Acerca de")).toBeVisible();
    // A fresh database has no settings row yet (the form shows defaults), so the public content may say null.
    expect(((await publicContent(page)).settings as { tagline: string } | null)?.tagline).not.toBe(tagline);

    // The save: line breaks arrive as plain line breaks, and the fields close.
    await page.getByLabel("Acerca de").fill(about);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator('[data-slot="form-feedback"]').getByText("Cambios guardados.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar" })).toBeFocused();
    expect((await publicContent(page)).settings).toMatchObject({ tagline, about });

    if (original) {
      await page.getByRole("button", { name: "Editar" }).click();
      await page.getByLabel("Lema").fill(original.tagline);
      await page.getByLabel("Descripción").fill(original.description);
      await page.getByLabel("Acerca de").fill(original.about);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[data-slot="form-feedback"]').getByText("Cambios guardados.")).toBeVisible();
    }

    await context.close();
  });
});

test.describe("users and sessions", () => {
  test("a role change applies on the person's next request in both directions, and the last active admin cannot be demoted", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const editor = await asEditor(browser, baseURL, ROLE_USER);
    const usersPage = () => editor.context.request.get("/admin/usuarios", { maxRedirects: 0 });

    try {
      expect((await usersPage()).status(), "an editor is bounced").toBe(307);

      await page.goto("/admin/usuarios");
      await page.getByLabel("Rol de Rol cambiante").selectOption("ADMIN");
      await expect(page.getByRole("status").getByText("Rol de «Rol cambiante» cambiado.")).toBeVisible();

      // The cookie still claims EDITOR; the database decides.
      expect((await usersPage()).status(), "promoted: the same cookie now opens the users page").toBe(200);

      const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true, id: { not: ROLE_USER.id } } });

      await page.reload();
      await page.getByLabel("Rol de Rol cambiante").selectOption("EDITOR");

      if (otherAdmins === 0) {
        await expect(page.getByText("No se puede quitar ni degradar al último administrador activo.")).toBeVisible();
        expect((await usersPage()).status(), "refused: still an admin").toBe(200);
      } else {
        await expect(page.getByRole("status").getByText("Rol de «Rol cambiante» cambiado.")).toBeVisible();
        expect((await usersPage()).status(), "demoted: bounced again").toBe(307);
      }
    } finally {
      await prisma.user.update({ where: { id: ROLE_USER.id }, data: { role: "EDITOR" } });
      await editor.context.close();
      await context.close();
    }
  });

  test("deactivating a user ends their sessions at once; reactivating does not bring the old session back", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const victim = await asEditor(browser, baseURL, VICTIM);

    try {
      await victim.page.goto("/admin");
      await expect(victim.page).toHaveURL(/\/admin$/);

      await page.goto("/admin/usuarios");
      await page.getByRole("button", { name: "Desactivar: Víctima auditoría" }).click();
      await page.getByRole("button", { name: "Sí, desactivar" }).click();
      await expect(page.getByRole("status").getByText("Usuario desactivado.")).toBeVisible();

      expect((await victim.context.request.get("/admin", { maxRedirects: 0 })).status()).toBe(307);
      expect((await prisma.session.findUnique({ where: { id: VICTIM.session } }))?.revokedAt).not.toBeNull();

      await page.getByRole("button", { name: "Reactivar: Víctima auditoría" }).click();
      await expect(page.getByRole("status").getByText("Usuario reactivado.")).toBeVisible();
      expect((await victim.context.request.get("/admin", { maxRedirects: 0 })).status(), "the revoked session stays revoked").toBe(307);
    } finally {
      await plantUser(VICTIM, "EDITOR", "Víctima auditoría");
      await victim.context.close();
      await context.close();
    }
  });

  test("an editor sees only their own sessions, and a revoke they are not allowed to make is refused and changes nothing", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const editor = await asEditor(browser, baseURL);

    try {
      await editor.page.goto("/admin/sesiones");
      await expect(editor.page.getByText("Edge en Linux").first()).toBeVisible({ timeout: 30_000 });
      await expect(editor.page.getByText("esta sesión", { exact: true })).toBeVisible();
      await expect(editor.page.getByText("Safari")).toHaveCount(0);
      await expect(editor.page.getByText("emergencia", { exact: true })).toHaveCount(0);
      await expect(editor.page.getByText(/@example\.org/)).toHaveCount(0);

      // The admin opens the confirmation for someone else's session; the click lands with the editor's cookie.
      await page.goto("/admin/sesiones");
      await page.getByRole("button", { name: /Cerrar sesión: Safari/ }).click();
      await expect(page.getByRole("button", { name: "Sí, cerrar la sesión" })).toBeVisible();
      await context.clearCookies();
      await context.addCookies([{ name: "admin_session", value: tokens.get(EDITOR.id)!, url: baseURL ?? "http://127.0.0.1:3100" }]);
      await page.getByRole("button", { name: "Sí, cerrar la sesión" }).click();
      await expect(page.getByText("No tiene permiso para realizar esta acción.")).toBeVisible();
      expect((await prisma.session.findUnique({ where: { id: VICTIM.session } }))?.revokedAt).toBeNull();
    } finally {
      await editor.context.close();
      await context.close();
    }
  });

  test("an editor who closes their own current session lands on the login", async ({ browser, baseURL }) => {
    await plantUser(ROLE_USER, "EDITOR", "Rol cambiante");
    const editor = await asEditor(browser, baseURL, ROLE_USER);

    try {
      await editor.page.goto("/admin/sesiones");
      await editor.page.getByRole("button", { name: /Cerrar sesión: Firefox/ }).click();
      await editor.page.getByRole("button", { name: "Sí, cerrar la sesión" }).click();
      await expect(editor.page).toHaveURL(/\/login/, { timeout: 30_000 });
    } finally {
      await plantUser(ROLE_USER, "EDITOR", "Rol cambiante");
      await editor.context.close();
    }
  });
});

test.describe("trash", () => {
  test("a published FAQ, news item and social link leave the public content when trashed, and come back from the trash as drafts that stay out of it", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const question = `¿Pregunta de papelera ñ ${STAMP}?`;
    const newsTitle = `Noticia de papelera ${STAMP}`;
    const socialLabel = `Red de papelera ${STAMP}`;
    const publicText = async () => {
      const content = await publicContent(page);

      return {
        faqs: (content.faqs as { question: string }[]).map((item) => item.question),
        news: (content.news as { title: string }[]).map((item) => item.title),
        socials: (content.socials as { label: string }[]).map((item) => item.label),
      };
    };

    await page.goto("/admin/faqs/new");
    await page.getByLabel("Pregunta").fill(question);
    await page.getByLabel("Respuesta").fill("Respuesta");
    await setSwitch(page, /Publicada/, true);
    await page.getByRole("button", { name: "Crear pregunta" }).click();
    await expect(page).toHaveURL(/\/admin\/faqs$/, SLOW);

    await page.goto("/admin/news/new");
    await fillNews(page, { title: newsTitle, summary: "Resumen", body: "Cuerpo" });
    await setSwitch(page, /Publicada/, true);
    await page.getByRole("button", { name: "Crear noticia" }).click();
    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit$/, SLOW);

    await page.goto("/admin/socials/new");
    await page.getByLabel("Nombre", { exact: true }).fill(socialLabel);
    await page.getByLabel("Usuario").fill("@papelera");
    await page.getByLabel("Enlace", { exact: true }).fill("https://example.org/papelera");
    await setSwitch(page, /Publicada/, true);
    await page.getByRole("button", { name: "Agregar red" }).click();
    await expect(page).not.toHaveURL(/\/new$/, SLOW);

    const before = await publicText();

    expect(before.faqs).toContain(question);
    expect(before.news).toContain(newsTitle);
    expect(before.socials).toContain(socialLabel);

    // Searched by the stamp: the FAQ and news lists page at 20 rows, and a rerun leaves older rows behind.
    for (const [path, label] of [[`/admin/faqs?q=${STAMP}`, question], [`/admin/news?q=${STAMP}`, newsTitle], ["/admin/socials", socialLabel]] as const) {
      await page.goto(path);
      await page.getByRole("button", { name: `Mover a la papelera: ${label}` }).click();
      await page.getByRole("button", { name: "Sí, mover" }).click();
      await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();
    }

    const trashed = await publicText();

    expect(trashed.faqs).not.toContain(question);
    expect(trashed.news).not.toContain(newsTitle);
    expect(trashed.socials).not.toContain(socialLabel);

    await page.goto("/admin/papelera");
    for (const label of [question, newsTitle, socialLabel]) {
      const restore = page.getByRole("button", { name: `Restaurar: ${label}` });

      await restore.click();
      // The row leaving the trash is the proof; a built server answers fast enough for two toasts to be on screen at once.
      await expect(page.getByRole("status").getByText("Restaurado como borrador.").first()).toBeVisible();
      await expect(restore).toBeHidden();
    }

    const restored = await publicText();

    expect(restored.faqs).not.toContain(question);
    expect(restored.news).not.toContain(newsTitle);
    expect(restored.socials).not.toContain(socialLabel);

    for (const [path, label] of [[`/admin/faqs?q=${STAMP}`, question], [`/admin/news?q=${STAMP}`, newsTitle], ["/admin/socials", socialLabel]] as const) {
      await page.goto(path);
      await expect(page.getByRole("switch", { name: `Publicado: ${label}` })).toHaveAttribute("aria-checked", "false");
    }

    await context.close();
  });

  test("restoring an event whose address was taken meanwhile is refused with the reason; a stale trash row says so instead of failing silently", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Evento con dirección ${STAMP}`;
    const slug = `direccion-${STAMP}`;

    const create = async (eventTitle: string, eventSlug: string) => {
      await page.goto("/admin/events/new");
      await page.getByLabel("Título").fill(eventTitle);
      await page.getByLabel("Identificador (slug)").fill(eventSlug);
      await page.getByRole("button", { name: "Crear evento" }).click();
      await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/, SLOW);
    };

    await create(title, slug);
    // Searched by the stamp: the events list pages at 20 rows, and a rerun leaves older events behind.
    await page.goto(`/admin/events?q=${STAMP}`);
    await page.getByRole("button", { name: `Mover a la papelera: ${title}` }).click();
    await page.getByRole("button", { name: "Sí, mover" }).click();
    await expect(page.getByRole("status").getByText("Movido a la papelera")).toBeVisible();
    await create(`Ocupa la dirección ${STAMP}`, slug);

    await page.goto("/admin/papelera");
    await page.getByRole("button", { name: `Restaurar: ${title}` }).click();
    await expect(page.getByText(`No se puede restaurar: el identificador «${slug}» ya lo usa otro evento.`)).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();

    // Two tabs: the second one still lists a row that the first already purged for good.
    const stale = await context.newPage();
    await stale.goto("/admin/papelera");
    await expect(stale.getByText(title).first()).toBeVisible();

    await page.getByRole("button", { name: `Eliminar definitivamente: ${title}` }).click();
    await page.getByRole("button", { name: "Sí, eliminar definitivamente" }).click();
    await expect(page.getByRole("status").getByText("Eliminado definitivamente.")).toBeVisible();

    await stale.getByRole("button", { name: `Restaurar: ${title}` }).click();
    await expect(stale.getByText("El elemento ya no está en la papelera.")).toBeVisible();
    await context.close();
  });
});

test.describe("audit log", () => {
  test("a change shows up under its type and its actor without the content that was typed; the filters and a hostile query string behave", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const marker = `Secreto-${STAMP}`;

    await page.goto("/admin/faqs/new");
    await page.getByLabel("Pregunta").fill(`¿${marker}?`);
    await page.getByLabel("Respuesta").fill(`Respuesta ${marker}`);
    await page.getByRole("button", { name: "Crear pregunta" }).click();
    await expect(page).toHaveURL(/\/admin\/faqs$/, SLOW);

    await page.goto("/admin/registro");
    await expect(page.getByRole("heading", { name: "Registro de cambios", level: 1 })).toBeVisible();
    await expect(page.getByText("Pregunta frecuente creada").first()).toBeVisible();
    await expect(page.getByText(marker)).toHaveCount(0);

    // Filter by who: the emergency access made the entry; by type: only FAQ entries remain.
    await page.getByLabel("Quién").selectOption("break_glass");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/actor=break_glass/);
    await expect(page.getByText("Pregunta frecuente creada").first()).toBeVisible();

    await page.getByLabel("Quién").selectOption("");
    await page.getByLabel("Tipo").selectOption({ label: "Pregunta frecuente" });
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/tipo=faq/);
    await expect(page.getByText("Evento creado")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Quitar filtros" })).toBeVisible();

    // A filter nobody matches says so; nonsense in the query string never breaks the page.
    for (const query of ["?tipo=nada&actor=nadie", "?pagina=-5", "?pagina=abc", "?pagina=999999", "?tipo=%00&actor=%E2%9C%93", `?tipo=${"x".repeat(3000)}`]) {
      const response = await context.request.get(`/admin/registro${query}`, { maxRedirects: 0, timeout: 60_000 });

      expect(response.status(), query.slice(0, 40)).toBe(200);
    }

    await page.goto("/admin/registro?tipo=nada&actor=nadie");
    await expect(page.getByText("Ninguna entrada coincide con el filtro.")).toBeVisible();
    await context.close();
  });

  test("a wrong emergency password is recorded as rejected, with no password in the log", async ({ browser, baseURL }) => {
    const wrong = `contraseña-equivocada-${STAMP}`;
    const stranger = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": `192.0.2.${(Date.now() % 250) + 1}` } });
    const page = await stranger.newPage();

    await submitPassword(page, wrong);
    await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
    await stranger.close();

    const { context, page: admin } = await asAdmin(browser, baseURL);

    await admin.goto("/admin/registro");
    await expect(admin.getByText("Contraseña de emergencia rechazada").first()).toBeVisible();
    await expect(admin.getByText(wrong)).toHaveCount(0);
    await context.close();
  });
});

test.describe("faqs and line breaks", () => {
  test("a FAQ needs a question and an answer, holds its limits on the server, and keeps the answer's line breaks as plain line breaks", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const question = `¿Pregunta con saltos ñ 🚀 ${STAMP}?`;
    const answer = ["Primera línea.", "", "Segunda línea con 日本語.", "x".repeat(100)].join("\n");
    const create = page.getByRole("button", { name: "Crear pregunta" });

    await page.goto("/admin/faqs/new");
    await create.click();
    await expect(await errorOf(page, "Pregunta")).toBeVisible();

    await fillPastLimit(page.getByLabel("Pregunta"), "P".repeat(201));
    await page.getByLabel("Respuesta").fill("Respuesta");
    await create.click();
    await expect(await errorOf(page, "Pregunta")).toBeVisible();

    await page.getByLabel("Pregunta").fill(question);
    await fillPastLimit(page.getByLabel("Respuesta"), "R".repeat(1001));
    await create.click();
    await expect(await errorOf(page, "Respuesta")).toBeVisible();

    await page.getByLabel("Respuesta").fill("");
    await create.click();
    await expect(await errorOf(page, "Respuesta")).toBeVisible();

    for (const command of ["Hola", "a", "1x", "dos--guiones", "con espacio"]) {
      await page.getByLabel("Respuesta").fill(answer);
      await fillPastLimit(page.getByLabel("Comando (opcional)"), command);
      await create.click();
      await expect(await errorOf(page, "Comando (opcional)"), command).toBeVisible();
    }

    await page.getByLabel("Comando (opcional)").fill("");
    await setSwitch(page, /Publicada/, true);
    await create.click();
    await expect(page).toHaveURL(/\/admin\/faqs$/, SLOW);

    const faq = ((await publicContent(page)).faqs as { question: string; answer: string; command: string }[]).find((item) => item.question === question);

    expect(faq?.answer).toBe(answer);
    await context.close();
  });

  test("an event description keeps its line breaks as plain line breaks and counts a break as one character", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const title = `Evento con saltos ${STAMP}`;
    const lines = ["Primera línea", "", "Segunda línea 🚀"];
    const description = [...lines, "d".repeat(600 - lines.join("\n").length - 1)].join("\n");

    expect(description).toHaveLength(600);
    await page.goto("/admin/events/new");
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Descripción", { exact: true }).fill(description);
    await setSwitch(page, /Publicado/, true);
    await page.getByRole("button", { name: "Crear evento" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/edit$/, SLOW);

    const event = ((await publicContent(page)).events as { title: string; description: string }[]).find((item) => item.title === title);

    expect(event?.description).toBe(description);
    await context.close();
  });
});

test.describe("lists and pages under hostile query strings", () => {
  test("no admin page answers a malformed filter, search, page or cursor with an error", async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    const { context } = await asAdmin(browser, baseURL);
    const queries = ["?q=%00", "?q=" + "ñ".repeat(500), "?estado=zzz", "?estado[]=a&estado[]=b", "?pagina=-1", "?pagina=1e9", "?pagina=99999999999999999999", "?pagina=0&q=%E2%80%AE", "?despues=%00", "?despues=" + "z".repeat(2000), "?acceso=<script>"];

    for (const path of ["/admin", "/admin/events", "/admin/news", "/admin/faqs", "/admin/commands", "/admin/board", "/admin/pillars", "/admin/socials", "/admin/sponsors", "/admin/papelera", "/admin/medios", "/admin/sesiones", "/admin/usuarios", "/admin/vista-previa"]) {
      for (const query of queries) {
        const response = await context.request.get(`${path}${query}`, { maxRedirects: 0, timeout: 90_000 });

        expect(response.status(), `${path}${query.slice(0, 30)}`).toBe(200);
      }
    }

    await context.close();
  });
});

test.describe("theme and dashboard", () => {
  test("the theme toggle switches the page, remembers the choice across pages and reloads, on the login and in the admin", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: CLIENT_HEADERS });
    const page = await context.newPage();
    const theme = () => page.locator("html").getAttribute("data-theme");

    await openLogin(page);
    const initial = await theme();
    const toggled = initial === "dark" ? "light" : "dark";

    await page.locator("[data-theme-toggle]").click();
    expect(await theme()).toBe(toggled);
    await page.reload();
    expect(await theme(), "the choice survives a reload").toBe(toggled);

    await logInAsAdmin(page);
    expect(await theme(), "and follows the person into the admin").toBe(toggled);

    await page.getByRole("button", { name: /Menú de cuenta/ }).click();
    await page.locator("[data-theme-toggle]").last().click();
    expect(await theme()).toBe(initial);
    await page.goto("/admin/events");
    expect(await theme()).toBe(initial);

    // Leaves the browser storage as found.
    await page.evaluate(() => localStorage.clear());
    await context.close();
  });

  test("the dashboard counts follow what is created: a new draft raises the draft count of its section", async ({ browser, baseURL }) => {
    const { context, page } = await asAdmin(browser, baseURL);
    const draftsOf = async (section: string) => {
      await page.goto("/admin");
      const text = await page.getByRole("link", { name: new RegExp(`^${section}`) }).filter({ hasText: /publicados?/ }).first().innerText();

      return Number(/(\d+) borradores?/.exec(text)?.[1] ?? NaN);
    };

    const before = await draftsOf("FAQ");

    await page.goto("/admin/faqs/new");
    await page.getByLabel("Pregunta").fill(`¿Borrador del panel ${STAMP}?`);
    await page.getByLabel("Respuesta").fill("Respuesta");
    await page.getByRole("button", { name: "Crear pregunta" }).click();
    await expect(page).toHaveURL(/\/admin\/faqs$/, SLOW);

    expect(await draftsOf("FAQ")).toBe(before + 1);
    await context.close();
  });
});
