import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SignJWT } from "jose";

/*
 * Audit of the event registration ("inscripción"): the public page in its three modes, the open form, the
 * public endpoints and the admin views, with the happy, error and edge cases of each. Every event is seeded
 * straight into the database under a unique prefix (and removed at the end), so the file shares a database
 * with the other specs. Each test comes from its own made-up client address (`x-real-ip`): the registration
 * limit is five attempts per address, and no test may eat another's.
 *
 * Two harnesses run this file. `npm run e2e` builds production without a Turnstile secret, where the open form
 * fails closed (503): the tests that need an accepted registration skip themselves there. The live local
 * instance (`playwright.live.config.ts`) accepts any token, so they run; the browser has no widget in either
 * (no site key), so those tests add a token the way the widget would.
 */
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const FORUM_SECRET = process.env.FORUM_SESSION_SECRET ?? "";
const STAMP = Date.now().toString(36);
const PREFIX = `ar-${STAMP}-`;
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

const ANA = { name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5 };
const OPEN_ENDPOINT = "**/api/public/events/*/registrations";

const octet = () => 20 + Math.floor(Math.random() * 200);
const subnet = `10.${octet()}.${octet()}`;
let addresses = 0;
const nextIp = () => `${subnet}.${++addresses}`;

interface Seeded {
  id: string;
  slug: string;
  title: string;
}

async function seedEvent(name: string, overrides: Partial<Prisma.EventUncheckedCreateInput> = {}): Promise<Seeded> {
  const slug = `${PREFIX}${name}`;
  const title = overrides.title ?? `Auditoría ${name} ${STAMP}`;

  await prisma.event.create({
    data: { id: slug, slug, date: new Date("2099-11-28"), hora: "09:00 - 11:00", lugar: "Laboratorio 2", isPublished: true, registrationMode: "open", updatedAt: new Date(), ...overrides, title },
  });

  return { id: slug, slug, title };
}

const registrations = (event: Seeded) => prisma.eventRegistration.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "asc" } });

/** The visitor's address: the server reads it from `x-real-ip`. */
function post(request: APIRequestContext, slug: string, data: unknown, ip = nextIp(), headers: Record<string, string> = {}) {
  return request.post(`/api/public/events/${slug}/registrations`, { data, headers: { "x-real-ip": ip, ...headers } });
}

let accepts: boolean | undefined;

/** Whether this server takes registrations at all: the production harness has no Turnstile secret and refuses them all. */
async function takesRegistrations(request: APIRequestContext): Promise<boolean> {
  accepts ??= (await post(request, `${PREFIX}probe`, { turnstileToken: "audit-token" })).status() !== 503;

  return accepts;
}

/** What the Turnstile widget does on a deployment that has a site key: adds the token the server asks for. */
async function actAsWidget(page: Page) {
  await page.route(OPEN_ENDPOINT, (route) => route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), turnstileToken: "audit-token" }) }));
}

async function fillForm(page: Page, values: Partial<Record<"name" | "email" | "career" | "semester", string>> = {}) {
  const { name, email, career, semester } = { name: ANA.name, email: ANA.email, career: ANA.career, semester: String(ANA.semester), ...values };

  await page.getByLabel("Nombre completo").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Carrera").fill(career);
  await page.getByLabel("Semestre").selectOption(semester);
}

/** Console errors, uncaught exceptions and server errors a page produced while it was open. */
function watch(page: Page): string[] {
  const problems: string[] = [];

  page.on("pageerror", (error) => problems.push(`exception: ${error.message}`));
  page.on("console", (message) => message.type() === "error" && problems.push(`console: ${message.text()}`));
  page.on("response", (response) => response.status() >= 500 && problems.push(`${response.status()} ${response.url()}`));

  return problems;
}

async function logInAsAdmin(page: Page) {
  await page.goto("/login");

  // With Google sign-in configured, the password form sits folded under the emergency access.
  const emergency = page.getByText("Acceso de emergencia");

  await emergency.or(page.getByLabel("Contraseña")).first().waitFor();
  if (await emergency.isVisible()) await emergency.click();

  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-real-ip": nextIp() });
});

test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

test.describe("the public event page", () => {
  test("an open event renders without a single console or server error, with its seats, details and form", async ({ page }) => {
    const event = await seedEvent("pagina", { registrationCapacity: 30, description: "Primera línea\nSegunda línea" });
    const problems = watch(page);

    const response = await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: event.title })).toBeVisible();
    await expect(page.getByText("Quedan 30 de 30 cupos")).toBeVisible();
    await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
    await expect(page.getByText("Laboratorio 2")).toBeVisible();
    await expect(page.getByText("Segunda línea")).toBeVisible();
    await expect(page.getByRole("button", { name: "Inscribirme" })).toBeEnabled();
    expect(problems).toEqual([]);
  });

  test("an unknown, malformed, hidden or trashed event is a 404, never a 500", async ({ request }) => {
    const draft = await seedEvent("borrador", { isPublished: false });
    const scheduled = await seedEvent("programado", { publishAt: new Date(Date.now() + 86_400_000) });
    const retired = await seedEvent("retirado", { publishAt: new Date(Date.now() - 2 * 86_400_000), unpublishAt: new Date(Date.now() - 86_400_000) });
    const trashed = await seedEvent("papelera", { deletedAt: new Date() });

    // A malformed percent sequence never reaches the page: the framework itself answers 400.
    expect((await request.get("/foro/eventos/%E0%A4%A")).status()).toBe(400);

    for (const slug of [draft.slug, scheduled.slug, retired.slug, trashed.slug, "no-existe", "UPPER-Case", "%00", "a%20b", "..%2F..%2Fetc", "a".repeat(3000), "-", "x".repeat(200)]) {
      expect((await request.get(`/foro/eventos/${slug}`)).status(), slug.slice(0, 40)).toBe(404);
    }
  });

  test("an event without a precise day takes registrations until its month ends; one dated today still takes them", async ({ page }) => {
    const today = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
    const month = `${today.slice(0, 7)}-01`;
    const todays = await seedEvent("hoy", { date: new Date(today) });
    const monthly = await seedEvent("mes", { date: new Date(month), datePrecision: "month" });
    const undated = await seedEvent("sinfecha", { date: null });

    for (const event of [todays, monthly, undated]) {
      await page.goto(`/foro/eventos/${event.slug}`);
      await expect(page.getByText("Inscripciones abiertas"), event.slug).toBeVisible();
      await expect(page.getByRole("button", { name: "Inscribirme" }), event.slug).toBeVisible();
    }
  });

  test("a past event, a passed deadline, a full event and an unlimited one each say what they are", async ({ page }) => {
    const past = await seedEvent("pasado", { date: new Date("2020-01-15") });
    const deadline = await seedEvent("plazo", { registrationDeadline: new Date(Date.now() - 60_000) });
    const future = await seedEvent("plazofuturo", { registrationDeadline: new Date(Date.now() + 3_600_000) });
    const full = await seedEvent("lleno", { registrationCapacity: 1 });
    const open = await seedEvent("ilimitado");

    await prisma.eventRegistration.create({ data: { id: `${full.id}-r`, eventId: full.id, mode: "open", name: "Eva Mora", email: "eva@example.com", career: "Computación", semester: 3 } });

    for (const event of [past, deadline]) {
      await page.goto(`/foro/eventos/${event.slug}`);
      await expect(page.getByText("Inscripciones cerradas"), event.slug).toBeVisible();
      await expect(page.getByText("Las inscripciones de este evento ya cerraron."), event.slug).toBeVisible();
      await expect(page.getByRole("button", { name: "Inscribirme" }), event.slug).toHaveCount(0);
      await expect(page.getByText("Inscripciones hasta"), event.slug).toHaveCount(0);
    }

    await page.goto(`/foro/eventos/${future.slug}`);
    await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
    await expect(page.getByText("Inscripciones hasta")).toBeVisible();

    await page.goto(`/foro/eventos/${full.slug}`);
    await expect(page.getByText("Cupos agotados")).toBeVisible();
    await expect(page.getByText("Quedan 0 de 1 cupos")).toBeVisible();
    await expect(page.getByText("Ya no quedan cupos para este evento.")).toBeVisible();

    // No limit: no seat counter at all.
    await page.goto(`/foro/eventos/${open.slug}`);
    await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
    await expect(page.getByText(/cupos$/)).toHaveCount(0);
  });

  test("an event without registration and a UNL one render cleanly; the visitor lists need a sign-in", async ({ page, request }) => {
    const none = await seedEvent("libre", { registrationMode: "none" });
    const unl = await seedEvent("unl", { registrationMode: "unl" });
    const problems = watch(page);

    await page.goto(`/foro/eventos/${none.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Este evento es de pase libre: no necesitas inscribirte, solo llegar.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toBeVisible();

    await page.goto(`/foro/eventos/${unl.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Entrar con Google/ })).toBeVisible();
    expect(problems).toEqual([]);

    // The forum's registrations list is the member's: a visitor meets the sign-in, not an error.
    const list = await request.get("/foro/eventos");

    expect(list.status()).toBe(200);
    expect(await list.text()).toContain("Entrar con Google");
  });

  test("a signed-in member registers with the UNL account once and never twice", async ({ page, context }) => {
    test.skip(!FORUM_SECRET, "set FORUM_SESSION_SECRET to plant a forum member session");

    const event = await seedEvent("unlmiembro", { registrationMode: "unl", registrationCapacity: 5 });
    const now = new Date();
    const member = { id: `${PREFIX}m1`, session: `${PREFIX}s1`, email: `${PREFIX}m1@unl.edu.ec` };

    await prisma.forumMember.create({ data: { id: member.id, email: member.email, googleSub: `sub-${member.id}`, displayName: "Lucía Ñ." } });
    await prisma.forumSession.create({ data: { id: member.session, memberId: member.id, expiresAt: new Date(now.getTime() + 3_600_000), lastSeenAt: now } });

    const issued = Math.floor(now.getTime() / 1000);
    const token = await new SignJWT({ sid: member.session, mid: member.id, typ: "forum-session" })
      .setSubject(member.id)
      .setAudience("aso-computacion-forum")
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(issued)
      .setExpirationTime(issued + 3600)
      .sign(new TextEncoder().encode(FORUM_SECRET));

    await context.addCookies([{ name: "forum_session", value: token, domain: "127.0.0.1", path: "/foro" }]);

    try {
      await page.goto(`/foro/eventos/${event.slug}`);
      await expect(page.getByRole("complementary", { name: "Inscripción" }).getByText("Lucía Ñ.")).toBeVisible();
      await page.getByRole("button", { name: "Inscribirme" }).click();
      await expect(page.getByText("Usted ya está inscrito en este evento.")).toBeVisible();
      await expect(page.getByText("Quedan 4 de 5 cupos")).toBeVisible();
      expect(await registrations(event)).toMatchObject([{ mode: "unl", name: "Lucía Ñ.", email: member.email, career: null, semester: null }]);

      // The member's list shows the event too.
      await page.goto("/foro/eventos");
      await expect(page.getByText(event.title)).toBeVisible();

      // Coming back never registers twice.
      await page.goto(`/foro/eventos/${event.slug}`);
      await expect(page.getByText("Usted ya está inscrito en este evento.")).toBeVisible();
      expect(await registrations(event)).toHaveLength(1);
    } finally {
      await prisma.forumSession.deleteMany({ where: { memberId: member.id } });
      await prisma.forumMember.deleteMany({ where: { id: member.id } });
    }
  });
});

test.describe("the open form in the browser", () => {
  test("every field is checked before sending, with a message under it; nothing reaches the server", async ({ page }) => {
    const event = await seedEvent("validacion");
    let sent = 0;

    await page.route(OPEN_ENDPOINT, (route) => {
      sent += 1;

      return route.abort();
    });
    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });

    const submit = page.getByRole("button", { name: "Inscribirme" });

    // All empty: every field is flagged and the first one takes the focus.
    await submit.click();
    for (const label of ["Nombre completo", "Correo", "Carrera", "Semestre"]) {
      await expect(page.getByLabel(label)).toHaveAttribute("aria-invalid", "true");
    }
    await expect(page.getByLabel("Nombre completo")).toBeFocused();
    await expect(page.getByText("Escribe tu correo.")).toBeVisible();
    await expect(page.getByText("Escribe tu carrera.")).toBeVisible();

    // Spaces only are empty, too.
    await page.getByLabel("Nombre completo").fill("     ");
    await submit.click();
    await expect(page.getByText("Escribe tu nombre.")).toBeVisible();

    // Every shape of a bad email.
    for (const email of ["ana", "ana@", "@example.com", "ana@example", "ana @example.com", "ana@@example.com", "ana@.com", `${"a".repeat(250)}@x.co`]) {
      await fillForm(page, { email });
      await submit.click();
      await expect(page.getByLabel("Correo"), email.slice(0, 20)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Revisa tu correo: no parece una dirección válida."), email.slice(0, 20)).toBeVisible();
    }

    // Length limits: 121 characters are too many, in the name and in the career.
    await fillForm(page, { name: "n".repeat(121), career: "c".repeat(121) });
    await submit.click();
    await expect(page.getByText("Tu nombre es muy largo: usa hasta 120 caracteres.")).toBeVisible();
    await expect(page.getByText("Tu carrera es muy larga: usa hasta 120 caracteres.")).toBeVisible();

    expect(sent).toBe(0);
  });

  test("a valid form with accents, ñ, CJK and emoji, extra spaces and an uppercase email is stored cleaned up", async ({ page, request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("exito", { registrationCapacity: 3 });

    await actAsWidget(page);
    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    await fillForm(page, { name: "  José   Ñandú 李雷 😀  ", email: "  JOSÉ.Ñandú@Exámple.COM ", career: "Ingeniería en Sistemas / Computación — «UNL»", semester: "12" });
    await page.getByRole("button", { name: "Inscribirme" }).click();

    const done = page.getByRole("status").filter({ hasText: `Quedaste inscrito en ${event.title}.` });

    await expect(done).toBeFocused();
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);
    // The page behind refreshes by itself: the seats follow, the confirmation stays.
    await expect(page.getByText("Quedan 2 de 3 cupos")).toBeVisible();
    await expect(done).toBeVisible();
    expect(await registrations(event)).toMatchObject([{ mode: "open", name: "José Ñandú 李雷 😀", email: "josé.ñandú@exámple.com", career: "Ingeniería en Sistemas / Computación — «UNL»", semester: 12 }]);
  });

  test("the same email twice (any case, with spaces) is a duplicate on the email field and stores one row", async ({ page, request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("duplicado");

    await actAsWidget(page);
    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    await fillForm(page);
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Quedaste inscrito" })).toBeVisible();

    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    await fillForm(page, { name: "Otra Persona", email: " ANA@Example.com " });
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Correo")).toBeFocused();
    await expect(page.getByText("Ya hay una inscripción con ese correo para este evento.")).toBeVisible();
    expect(await registrations(event)).toHaveLength(1);
  });

  test("a double click sends one request and stores one registration", async ({ page, request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("doble");
    let sent = 0;

    await actAsWidget(page);
    await page.route(OPEN_ENDPOINT, async (route) => {
      sent += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));

      return route.fallback();
    });
    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    await fillForm(page);

    const submit = page.getByRole("button", { name: /Inscribirme|Enviando/ });

    await submit.dblclick();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Quedaste inscrito" })).toBeVisible();
    expect(sent).toBe(1);
    expect(await registrations(event)).toHaveLength(1);
  });

  test("whoever takes the last seat keeps the confirmation; the next visitor sees the event full", async ({ page, request, browser }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("ultimo", { registrationCapacity: 1 });

    await actAsWidget(page);
    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Queda 1 de 1 cupos")).toBeVisible();

    // Another visitor loaded the form before the seat was taken.
    const late = await browser.newContext({ baseURL: page.url().split("/foro")[0], extraHTTPHeaders: { "x-real-ip": nextIp() } });
    const latePage = await late.newPage();

    await actAsWidget(latePage);
    await latePage.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    await fillForm(page);
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Quedaste inscrito" })).toBeVisible();
    await expect(page.getByText("Cupos agotados")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Quedaste inscrito" })).toBeVisible();

    await fillForm(latePage, { name: "Luis Tarde", email: "luis@example.com" });
    await latePage.getByRole("button", { name: "Inscribirme" }).click();
    await expect(latePage.getByText("Ya no quedan cupos para este evento.")).toBeVisible();
    await expect(latePage.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);
    expect(await registrations(event)).toMatchObject([{ email: ANA.email }]);
    await late.close();
  });

  test("when registration closes while the form is open, the form gives way to the state; a network failure keeps the data", async ({ page }) => {
    const event = await seedEvent("cierra");

    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    await fillForm(page);
    await page.route(OPEN_ENDPOINT, (route) => route.abort("connectionrefused"), { times: 1 });
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos enviar tu inscripción." })).toBeVisible();
    await expect(page.getByLabel("Nombre completo")).toHaveValue(ANA.name);

    // An answer that is not JSON at all (a proxy's HTML page) is the same plain failure.
    await page.route(OPEN_ENDPOINT, (route) => route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" }), { times: 1 });
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos enviar tu inscripción." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inscribirme" })).toBeEnabled();
  });

  test("a deployment with a Turnstile secret but no site key offers no form that can never pass, and says the registration is unavailable", async ({ page, request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness answers unavailable on its own");

    const event = await seedEvent("sinwidget");

    await page.goto(`/foro/eventos/${event.slug}`, { waitUntil: "networkidle" });
    // Without a site key there is no widget to complete, so the page does not ask for data it cannot send.
    await expect(page.getByText("La inscripción no está disponible en este momento.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
  });

  test("the form fits a 320 px phone and a 200% zoomed desktop without sideways scroll", async ({ page }) => {
    const event = await seedEvent("movil", { title: `Auditoría ${"palabralarga".repeat(12)} ${STAMP}`, description: "x".repeat(400) });

    for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 360 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`/foro/eventos/${event.slug}`);
      await expect(page.getByRole("button", { name: "Inscribirme" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${viewport.width}px`).toBe(true);
    }
  });
});

test.describe("the registration endpoint", () => {
  test("every invalid field is a 400 naming the field, and a lone surrogate is a refusal, not a server error", async ({ request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("campos", { registrationCapacity: 50 });
    const valid = { ...ANA, turnstileToken: "audit-token" };
    const cases: [string, Record<string, unknown>, string][] = [
      ["empty name", { name: "" }, "name"],
      ["name over 120", { name: "n".repeat(121) }, "name"],
      ["name with a NUL", { name: "Ana\u0000" }, "name"],
      ["name that is a number", { name: 42 }, "name"],
      ["name with a lone surrogate", { name: "Ana \ud800 Pérez" }, "name"],
      ["career with a lone surrogate", { career: "Computaci\udc00n" }, "career"],
      ["email with a lone surrogate", { email: "ana\ud800@example.com" }, "email"],
      ["email without a domain", { email: "ana@b" }, "email"],
      ["email that is an object", { email: { x: 1 } }, "email"],
      ["email missing", { email: undefined }, "email"],
      ["career over 120", { career: "c".repeat(121) }, "career"],
      ["semester 0", { semester: 0 }, "semester"],
      ["semester 13", { semester: 13 }, "semester"],
      ["semester 5.5", { semester: 5.5 }, "semester"],
      ["semester null", { semester: null }, "semester"],
      ["semester text", { semester: "cinco" }, "semester"],
    ];

    for (const [label, override, field] of cases) {
      const response = await post(request, event.slug, { ...valid, ...override });

      expect({ label, status: response.status(), body: await response.json() }).toEqual({ label, status: 400, body: { error: "validation", field } });
    }

    expect(await registrations(event)).toHaveLength(0);
  });

  test("the limits are inclusive: 120 characters, semesters 1 and 12 and a string semester are accepted", async ({ request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("limites", { registrationCapacity: 50 });
    const base = { ...ANA, turnstileToken: "audit-token" };

    for (const override of [{ name: "n".repeat(120), email: "a1@example.com" }, { career: "c".repeat(120), email: "a2@example.com" }, { semester: 1, email: "a3@example.com" }, { semester: "12", email: "a4@example.com" }, { name: "Ana\n\tPérez", email: "a5@example.com" }]) {
      expect((await post(request, event.slug, { ...base, ...override })).status()).toBe(201);
    }

    // A line break between words is whitespace like any other: it collapses to one space (only NUL and the like are refused).
    expect(await registrations(event)).toHaveLength(5);
    expect((await registrations(event)).at(-1)?.name).toBe("Ana Pérez");
  });

  test("the request is judged before it is trusted: content type, size, JSON shape, slug, mode, state and token", async ({ request }) => {
    const open = await seedEvent("pedido");
    const unl = await seedEvent("pedidounl", { registrationMode: "unl" });
    const none = await seedEvent("pedidonone", { registrationMode: "none" });
    const past = await seedEvent("pedidopasado", { date: new Date("2020-01-15") });
    const draft = await seedEvent("pedidoborrador", { isPublished: false });
    const works = await takesRegistrations(request);
    const body = { ...ANA, turnstileToken: "audit-token" };

    expect((await post(request, open.slug, "plain", nextIp(), { "content-type": "text/plain" })).status()).toBe(415);
    expect((await post(request, open.slug, "{not json", nextIp(), { "content-type": "application/json" })).status()).toBe(400);
    expect((await post(request, open.slug, [1, 2], nextIp())).status()).toBe(400);
    expect((await post(request, open.slug, "null", nextIp(), { "content-type": "application/json" })).status()).toBe(400);
    expect((await post(request, open.slug, { ...body, name: "n".repeat(5000) })).status()).toBe(413);
    expect((await post(request, "UPPER", body)).status()).toBe(404);
    expect((await post(request, "no-existe", body)).status()).toBe(works ? 404 : 503);

    if (!works) return;

    expect(await (await post(request, "no-existe", body)).json()).toEqual({ error: "not_found" });
    expect(await (await post(request, unl.slug, body)).json()).toEqual({ error: "not_found" });
    expect(await (await post(request, none.slug, body)).json()).toEqual({ error: "not_found" });
    expect(await (await post(request, draft.slug, body)).json()).toEqual({ error: "not_found" });
    expect(await (await post(request, past.slug, body)).json()).toEqual({ error: "closed" });

    // No token is refused before anything is read; the answer never echoes what was sent.
    const refused = await post(request, open.slug, ANA);

    expect(refused.status()).toBe(400);
    expect(await refused.json()).toEqual({ error: "captcha" });
    expect(await registrations(open)).toHaveLength(0);
  });

  test("a sixth attempt from one address is rate limited with a Retry-After, and another address is not", async ({ request }) => {
    const event = await seedEvent("limite");
    const ip = nextIp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await post(request, event.slug, "{not json", ip, { "content-type": "application/json" })).status()).toBe(400);
    }

    const limited = await post(request, event.slug, "{not json", ip, { "content-type": "application/json" });

    expect(limited.status()).toBe(429);
    expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect((await post(request, event.slug, "{not json", nextIp(), { "content-type": "application/json" })).status()).toBe(400);
  });

  test("five people racing for the last seats of a three-seat event: exactly three get in", async ({ request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("carrera", { registrationCapacity: 3 });
    const answers = await Promise.all(
      Array.from({ length: 5 }, (_, index) => post(request, event.slug, { ...ANA, email: `carrera${index}@example.com`, turnstileToken: "audit-token" })),
    );
    const statuses = answers.map((answer) => answer.status()).sort();

    expect(statuses).toEqual([201, 201, 201, 409, 409]);
    expect(await registrations(event)).toHaveLength(3);

    const full = await Promise.all(answers.filter((answer) => answer.status() === 409).map((answer) => answer.json()));

    expect(full).toEqual([{ error: "full" }, { error: "full" }]);
  });

  test("ten identical submissions at once store one registration and answer the rest as duplicates", async ({ request }) => {
    test.skip(!(await takesRegistrations(request)), "the production harness has no Turnstile secret: the open form is closed");

    const event = await seedEvent("simultaneo");
    const answers = await Promise.all(Array.from({ length: 4 }, () => post(request, event.slug, { ...ANA, turnstileToken: "audit-token" })));

    expect(answers.map((answer) => answer.status()).sort()).toEqual([201, 409, 409, 409]);
    expect(await registrations(event)).toHaveLength(1);
  });
});

test.describe("the public seats endpoint", () => {
  test("it lists the events that take registrations with their live counts, in every state, and nothing personal", async ({ request }) => {
    const open = await seedEvent("cuposabierto", { registrationCapacity: 4 });
    const unlimited = await seedEvent("cuposlibre");
    const unl = await seedEvent("cuposunl", { registrationMode: "unl", registrationCapacity: 2 });
    const full = await seedEvent("cuposlleno", { registrationCapacity: 1 });
    const closed = await seedEvent("cuposcerrado", { date: new Date("2020-01-15"), registrationCapacity: 10 });
    const hidden = [
      await seedEvent("cuposnone", { registrationMode: "none" }),
      await seedEvent("cuposborrador", { isPublished: false }),
      await seedEvent("cuposprogramado", { publishAt: new Date(Date.now() + 86_400_000) }),
      await seedEvent("cuposretirado", { publishAt: new Date(Date.now() - 2 * 86_400_000), unpublishAt: new Date(Date.now() - 86_400_000) }),
      await seedEvent("cuposbasura", { deletedAt: new Date() }),
    ];

    await prisma.eventRegistration.createMany({
      data: [
        { id: `${open.id}-1`, eventId: open.id, mode: "open", name: "Ana Secreta", email: "secreta@example.com", career: "C", semester: 1 },
        { id: `${open.id}-2`, eventId: open.id, mode: "open", name: "Beto", email: "beto@example.com", career: "C", semester: 2 },
        { id: `${unlimited.id}-1`, eventId: unlimited.id, mode: "open", name: "Eva", email: "eva@example.com", career: "C", semester: 3 },
        { id: `${full.id}-1`, eventId: full.id, mode: "open", name: "Ivo", email: "ivo@example.com", career: "C", semester: 3 },
        { id: `${closed.id}-1`, eventId: closed.id, mode: "open", name: "Ula", email: "ula@example.com", career: "C", semester: 3 },
      ],
    });

    const response = await request.get("/api/public/events/seats", { headers: { origin: "https://preview.example", "x-real-ip": nextIp() } });
    const text = await response.text();
    const events: { slug: string }[] = JSON.parse(text).events;
    const mine = events.filter((event) => event.slug.startsWith(`${PREFIX}cupos`));

    expect(response.status()).toBe(200);
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
    expect(response.headers()["cache-control"]).toBe("public, max-age=0, s-maxage=5, must-revalidate");
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(text).not.toMatch(/secreta|beto@|email|name/i);
    expect(mine.map((event) => event.slug).sort()).toEqual([open, unlimited, unl, full, closed].map((event) => event.slug).sort());
    expect(mine).toContainEqual({ slug: open.slug, capacity: 4, registered: 2, seatsLeft: 2, status: "open" });
    expect(mine).toContainEqual({ slug: unlimited.slug, capacity: null, registered: 1, seatsLeft: null, status: "open" });
    expect(mine).toContainEqual({ slug: unl.slug, capacity: 2, registered: 0, seatsLeft: 2, status: "open" });
    expect(mine).toContainEqual({ slug: full.slug, capacity: 1, registered: 1, seatsLeft: 0, status: "full" });
    expect(mine).toContainEqual({ slug: closed.slug, capacity: 10, registered: 1, seatsLeft: 9, status: "closed" });

    for (const event of hidden) {
      expect(events.map((entry) => entry.slug)).not.toContain(event.slug);
    }

    // The same list on the page: what the endpoint says is what the visitor reads.
    expect(events.indexOf(events.find((event) => event.slug === closed.slug)!)).toBeLessThan(events.indexOf(events.find((event) => event.slug === open.slug)!));
  });

  test("a query string, a bad encoding, a huge one, a trailing slash and other methods change nothing", async ({ request }) => {
    const headers = { "x-real-ip": nextIp() };
    const plain = await (await request.get("/api/public/events/seats", { headers })).text();

    for (const query of ["?slug=no-existe", "?slug=%00", "?%E0%A4%A", `?a=${"a".repeat(9000)}`, "?events[]=1&events[]=2", "?"]) {
      const response = await request.get(`/api/public/events/seats${query}`, { headers });

      expect(response.status(), query.slice(0, 20)).toBe(200);
      expect(JSON.parse(await response.text()).events.length, query.slice(0, 20)).toBe(JSON.parse(plain).events.length);
    }

    expect((await request.post("/api/public/events/seats", { headers })).status()).toBe(405);
    expect((await request.fetch("/api/public/events/seats", { method: "OPTIONS", headers: { ...headers, origin: "https://x.example", "access-control-request-method": "GET" } })).status()).toBe(204);
    expect((await request.get("/api/public/events/seats/", { headers, maxRedirects: 0 })).status()).toBe(308);
  });

  test("a burst from one address is limited with a Retry-After and is not cached", async ({ request }) => {
    const headers = { "x-real-ip": nextIp() };
    let limited;

    for (let attempt = 0; attempt < 70 && !limited; attempt += 1) {
      const response = await request.get("/api/public/events/seats", { headers });

      if (response.status() === 429) limited = response;
    }

    expect(limited).toBeDefined();
    expect(limited!.headers()["cache-control"]).toBe("no-store");
    expect(Number(limited!.headers()["retry-after"])).toBeGreaterThan(0);
  });
});

test.describe("the admin registrations", () => {
  test("a visitor is sent to the login; an admin sees every event that takes registrations, and the counts match the public seats", async ({ page, request }) => {
    const live = await seedEvent("adminvivo", { registrationCapacity: 6 });
    const unlimited = await seedEvent("adminlibre");
    const draft = await seedEvent("adminborrador", { isPublished: false, registrationCapacity: 2 });
    const past = await seedEvent("adminpasado", { date: new Date("2020-01-15"), registrationCapacity: 3 });
    const none = await seedEvent("adminnone", { registrationMode: "none" });

    await prisma.eventRegistration.createMany({
      data: [
        ...[1, 2, 3].map((n) => ({ id: `${live.id}-${n}`, eventId: live.id, mode: "open" as const, name: `Persona ${n}`, email: `p${n}@example.com`, career: "C", semester: n })),
        { id: `${draft.id}-1`, eventId: draft.id, mode: "open" as const, name: "Borra", email: "b@example.com", career: "C", semester: 1 },
        { id: `${past.id}-1`, eventId: past.id, mode: "open" as const, name: "Pasada", email: "pa@example.com", career: "C", semester: 1 },
      ],
    });

    expect((await request.get("/admin/registrations", { maxRedirects: 0 })).status()).toBe(307);

    await logInAsAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const problems = watch(page);

    await page.goto("/admin/registrations");
    await expect(page.getByRole("heading", { name: "Inscripciones", level: 1 })).toBeVisible();

    const rowOf = (event: Seeded) => page.getByRole("row").filter({ hasText: event.title });

    await expect(rowOf(live)).toContainText("3 / 6");
    await expect(rowOf(live)).toContainText("Abierta");
    await expect(rowOf(unlimited)).toContainText("0 · sin límite");
    await expect(rowOf(draft)).toContainText("Borrador: no está en el sitio");
    await expect(rowOf(draft)).toContainText("1 / 2");
    await expect(rowOf(past)).toContainText("Cerrada");
    await expect(page.getByRole("heading", { name: "Pasados" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: none.title })).toHaveCount(0);

    // The header total counts exactly what the rows add up to.
    const rows = await page.getByRole("table").first().getByRole("row").count();

    expect(rows).toBeGreaterThan(1);
    expect(problems).toEqual([]);

    // The numbers a visitor can read are the numbers the admin reads.
    const seats: { events: { slug: string; registered: number; capacity: number | null }[] } = await (await request.get("/api/public/events/seats", { headers: { "x-real-ip": nextIp() } })).json();

    for (const event of [live, unlimited, past]) {
      const row = seats.events.find((entry) => entry.slug === event.slug)!;

      await expect(rowOf(event), event.slug).toContainText(row.capacity === null ? `${row.registered} · sin límite` : `${row.registered} / ${row.capacity}`);
    }

    // The link opens that event's registrants, and the count there is the same.
    await rowOf(live).getByRole("link", { name: /Ver inscritos/ }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/events/${live.id}/registrations$`));
    await expect(page.getByRole("row")).toHaveCount(4);
    await expect(page.getByText("3 de 6 cupos")).toBeVisible();
  });

  test("on a phone the events stack as blocks and nothing scrolls sideways", async ({ page }) => {
    const event = await seedEvent("adminmovil", { title: `Auditoría ${"largo".repeat(40)} ${STAMP}`, registrationCapacity: 6 });

    await logInAsAdmin(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/admin/registrations");
    await expect(page.getByText(event.title.slice(0, 30)).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("the registrants page lists, exports a safe CSV, deletes one registration, and the counts follow everywhere", async ({ page, request }) => {
    const event = await seedEvent("adminlista", { registrationCapacity: 2 });

    await prisma.eventRegistration.createMany({
      data: [
        { id: `${event.id}-1`, eventId: event.id, mode: "open", name: "=HYPERLINK(\"http://evil.example\")", email: "formula@example.com", career: "+SUM(1;2)", semester: 4 },
        { id: `${event.id}-2`, eventId: event.id, mode: "open", name: "María \"la Ñ\", Pérez 李雷", email: "maria@example.com", career: "Ingeniería, Sistemas", semester: 12 },
      ],
    });

    await logInAsAdmin(page);
    await page.goto(`/admin/events/${event.id}/registrations`);
    await expect(page.getByRole("row")).toHaveCount(3);
    await expect(page.getByText("2 de 2 cupos")).toBeVisible();
    await expect(page.getByText("María \"la Ñ\", Pérez 李雷")).toBeVisible();

    const exported = await page.request.get(`/admin/events/${event.id}/registrations/export`);
    const csv = await exported.text();

    expect(exported.status()).toBe(200);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://evil.example\"\")\"");
    expect(csv).toContain("\"'+SUM(1;2)\"");
    expect(csv).toContain("\"María \"\"la Ñ\"\", Pérez 李雷\"");
    expect(csv.trim().split("\r\n")).toHaveLength(3);

    // Unknown event: a 404 page, not a crash; the export has no body to leak.
    expect((await page.request.get("/admin/events/no-existe/registrations")).status()).toBe(404);
    expect((await page.request.get("/admin/events/no-existe/registrations/export")).status()).toBe(404);

    await page.getByRole("row").filter({ hasText: "formula@example.com" }).getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page.getByText("1 de 2 cupos")).toBeVisible({ timeout: 15_000 });
    expect(await registrations(event)).toHaveLength(1);

    // The freed seat is public at once (the next read; the edge may hold a copy for 5 s at most).
    const seats = await (await request.get("/api/public/events/seats", { headers: { "x-real-ip": nextIp() } })).json();

    expect(seats.events).toContainEqual({ slug: event.slug, capacity: 2, registered: 1, seatsLeft: 1, status: "open" });
  });
});
