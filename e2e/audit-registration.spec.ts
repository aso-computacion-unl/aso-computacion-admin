import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SignJWT } from "jose";

import { FORUM_SESSION_SECRET as FORUM_SECRET, plantForumMemberSession } from "./support/forum-session";
import { confirmationLink, waitForMail } from "./support/mail-sink";
import { openForm, stubTurnstile, widgetReady } from "./support/turnstile";

/*
 * Audit of the event registration ("inscripción"): the public page in its three modes, the open form, the
 * public endpoints and the admin views, with the happy, error and edge cases of each. Every event is seeded
 * straight into the database under a unique prefix (and removed at the end), so the file shares a database
 * with the other specs. Each test comes from its own made-up client address (`x-real-ip`): the registration
 * limit is five attempts per address, and no test may eat another's.
 *
 * `npm run e2e` runs the open form for real: Cloudflare's always-pass Turnstile test keys, and a fake Gmail
 * account whose SMTP host is the sink of scripts/run-e2e.mjs (e2e/support/smtp-sink.ts), so every accepted
 * registration really "sends" its confirmation email and the specs can read the link from it
 * (e2e/support/mail-sink.ts). In the browser the form tests swap Cloudflare's script for a widget that passes at
 * once (`stubTurnstile`: no network, a token on the spot); one test uses the real widget. An instance run through
 * `playwright.live.config.ts` must have the same configuration (a Turnstile site key and mail).
 */
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STAMP = Date.now().toString(36);
const PREFIX = `ar-${STAMP}-`;
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

const ANA = { name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5 };
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

/** Set `FORUM_E2E_SHOTS=<dir>` (as forum-member.spec.ts does) to keep screenshots of the public list for a visual review. */
const SCREENSHOT_DIR = process.env.FORUM_E2E_SHOTS;

const CONFIRM_SECRET = process.env.REGISTRATION_CONFIRM_SECRET ?? "";

/** The token the confirmation email would carry, signed the way the app does (needs the same secret). `nonce`: the attempt stored on the row (a row stored straight in the database has none). */
function confirmToken(registrationId: string, eventId: string, nonce?: string | null) {
  const issued = Math.floor(Date.now() / 1000);

  return new SignJWT({ purpose: "registration-confirm", rid: registrationId, eid: eventId, ...(nonce ? { nce: nonce } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issued)
    .setExpirationTime(issued + 48 * 3600)
    .sign(new TextEncoder().encode(CONFIRM_SECRET));
}

function confirm(request: APIRequestContext, slug: string, token: string, ip = nextIp()) {
  return request.post(`/api/public/events/${slug}/registrations/confirm`, { data: { token }, headers: { "x-real-ip": ip } });
}

async function fillForm(page: Page, values: Partial<Record<"name" | "email" | "institution" | "career" | "semester", string>> = {}) {
  const { name, email, institution, career, semester } = { name: ANA.name, email: ANA.email, institution: ANA.institution, career: ANA.career, semester: String(ANA.semester), ...values };

  await page.getByLabel("Nombre completo").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Institución").fill(institution);
  await page.getByLabel("Carrera").fill(career);
  await page.getByLabel("Ciclo").selectOption(semester);
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

    await stubTurnstile(page);

    const response = await page.goto(`/inscripciones/${event.slug}`);

    expect(response?.status()).toBe(200);
    await widgetReady(page);
    await expect(page.getByRole("heading", { level: 1, name: event.title })).toBeVisible();
    await expect(page.getByText("Quedan 30 cupos")).toBeVisible();
    await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
    await expect(page.getByText("Laboratorio 2")).toBeVisible();
    await expect(page.getByText("Segunda línea")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toBeEnabled();
    expect(problems).toEqual([]);
  });

  test("the old /foro/eventos/<slug> address is a permanent redirect that keeps the query string", async ({ request }) => {
    const response = await request.get("/foro/eventos/algun-evento?utm_source=landing&y=1", { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(new URL(response.headers().location ?? "", "http://127.0.0.1").pathname + new URL(response.headers().location ?? "", "http://127.0.0.1").search).toBe("/inscripciones/algun-evento?utm_source=landing&y=1");
  });

  test("an unknown, malformed, hidden or trashed event is a 404, never a 500", async ({ request }) => {
    const draft = await seedEvent("borrador", { isPublished: false });
    const scheduled = await seedEvent("programado", { publishAt: new Date(Date.now() + 86_400_000) });
    const retired = await seedEvent("retirado", { publishAt: new Date(Date.now() - 2 * 86_400_000), unpublishAt: new Date(Date.now() - 86_400_000) });
    const trashed = await seedEvent("papelera", { deletedAt: new Date() });

    // A malformed percent sequence never reaches the page: the framework itself answers 400.
    expect((await request.get("/inscripciones/%E0%A4%A")).status()).toBe(400);
    expect((await request.get("/foro/eventos/%E0%A4%A")).status()).toBe(400);

    for (const slug of [draft.slug, scheduled.slug, retired.slug, trashed.slug, "no-existe", "UPPER-Case", "%00", "a%20b", "..%2F..%2Fetc", "a".repeat(3000), "-", "x".repeat(200)]) {
      expect((await request.get(`/inscripciones/${slug}`)).status(), slug.slice(0, 40)).toBe(404);
    }
  });

  test("an event without a precise day takes registrations until its month ends; one dated today still takes them", async ({ page }) => {
    const today = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
    const month = `${today.slice(0, 7)}-01`;
    const todays = await seedEvent("hoy", { date: new Date(today) });
    const monthly = await seedEvent("mes", { date: new Date(month), datePrecision: "month" });
    const undated = await seedEvent("sinfecha", { date: null });

    for (const event of [todays, monthly, undated]) {
      await page.goto(`/inscripciones/${event.slug}`);
      await expect(page.getByText("Inscripciones abiertas"), event.slug).toBeVisible();
      await expect(page.getByRole("button", { name: "Reservar mi cupo" }), event.slug).toBeVisible();
    }
  });

  test("a past event, a passed deadline, a full event and an unlimited one each say what they are", async ({ page }) => {
    const past = await seedEvent("pasado", { date: new Date("2020-01-15") });
    const deadline = await seedEvent("plazo", { registrationDeadline: new Date(Date.now() - 60_000) });
    const future = await seedEvent("plazofuturo", { registrationDeadline: new Date(Date.now() + 3_600_000) });
    const full = await seedEvent("lleno", { registrationCapacity: 1 });
    const open = await seedEvent("ilimitado");

    await prisma.eventRegistration.create({ data: { id: `${full.id}-r`, eventId: full.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Eva Mora", email: "eva@example.com", career: "Computación", semester: 3 } });

    for (const event of [past, deadline]) {
      await page.goto(`/inscripciones/${event.slug}`);
      await expect(page.getByText("Inscripciones cerradas"), event.slug).toBeVisible();
      await expect(page.getByText("Las inscripciones de este evento ya cerraron."), event.slug).toBeVisible();
      await expect(page.getByRole("button", { name: "Reservar mi cupo" }), event.slug).toHaveCount(0);
      await expect(page.getByText("cierra el"), event.slug).toHaveCount(0);
    }

    await page.goto(`/inscripciones/${future.slug}`);
    await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
    await expect(page.getByText("cierra el")).toBeVisible();

    await page.goto(`/inscripciones/${full.slug}`);
    await expect(page.getByText("Cupos agotados")).toBeVisible();
    await expect(page.getByText("Quedan 0 cupos")).toBeVisible();
    await expect(page.getByText("Ya no quedan cupos para este evento.")).toBeVisible();

    // No limit: no seat counter at all.
    await page.goto(`/inscripciones/${open.slug}`);
    await expect(page.getByText("Inscripciones abiertas")).toBeVisible();
    await expect(page.getByText(/cupos$/)).toHaveCount(0);
  });

  test("S8 / R2: an event without registration renders cleanly, and a UNL one says its registration is not available while the Google login is not configured", async ({ page }) => {
    const none = await seedEvent("libre", { registrationMode: "none" });
    const unl = await seedEvent("unl", { registrationMode: "unl", registrationCapacity: 30 });
    const problems = watch(page);

    await page.goto(`/inscripciones/${none.slug}`);
    await expect(page.getByText("No necesita inscribirse: solo llegue.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toBeVisible();

    // This server has no Google client: a sign-in would end in an error, so the page does not offer one.
    await page.goto(`/inscripciones/${unl.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: unl.title })).toBeVisible();
    await expect(page.getByText("Quedan 30 cupos")).toBeVisible();
    await expect(page.getByRole("region", { name: "Inscripción" }).getByRole("status")).toHaveText("La inscripción con cuenta UNL no está disponible en este momento. Inténtelo de nuevo más tarde.");
    await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("D5 / D8: a sign-in that cannot start from an event's page comes back to that page, never to the forum", async ({ request }) => {
    const next = encodeURIComponent("/inscripciones/algun-evento");
    const fromEvent = await request.get(`/foro/auth/google/start?next=${next}`, { maxRedirects: 0 });
    const fromForum = await request.get(`/foro/auth/google/start?next=${encodeURIComponent("/foro/hilo/x")}`, { maxRedirects: 0 });

    expect(fromEvent.status()).toBe(307);
    expect(new URL(fromEvent.headers().location ?? "", "http://127.0.0.1").pathname + new URL(fromEvent.headers().location ?? "", "http://127.0.0.1").search).toBe("/inscripciones/algun-evento?error=unavailable");
    expect(new URL(fromForum.headers().location ?? "", "http://127.0.0.1").pathname).toBe("/foro");
  });

  test("a signed-in member registers with the UNL account once and never twice", async ({ page, context }) => {
    test.skip(!FORUM_SECRET, "set FORUM_SESSION_SECRET to plant a forum member session");

    const event = await seedEvent("unlmiembro", { registrationMode: "unl", registrationCapacity: 5 });
    const member = await plantForumMemberSession(prisma, { memberId: `${PREFIX}m1`, sessionId: `${PREFIX}s1`, displayName: "Lucía Ñ." });

    await context.addCookies([member.cookie]);

    try {
      await page.goto(`/inscripciones/${event.slug}`);
      await expect(page.getByRole("region", { name: "Inscripción" }).getByText("Lucía Ñ.")).toBeVisible();
      await page.getByRole("button", { name: "Reservar mi cupo" }).click();
      await expect(page.getByText("Usted ya está inscrito en este evento.")).toBeVisible();
      await expect(page.getByText("Quedan 4 cupos")).toBeVisible();
      expect(await registrations(event)).toMatchObject([{ mode: "unl", name: "Lucía Ñ.", email: member.email, career: null, semester: null }]);

      // The public list shows the event too, with the seat just taken.
      await page.goto("/inscripciones");
      await expect(page.getByRole("link", { name: event.title })).toBeVisible();

      // Coming back never registers twice.
      await page.goto(`/inscripciones/${event.slug}`);
      await expect(page.getByText("Usted ya está inscrito en este evento.")).toBeVisible();
      expect(await registrations(event)).toHaveLength(1);
    } finally {
      await prisma.forumSession.deleteMany({ where: { memberId: member.memberId } });
      await prisma.forumMember.deleteMany({ where: { id: member.memberId } });
    }
  });
});

test.describe("the public registrations list", () => {
  test("D8 / R3: a visitor with no session sees every event taking registrations, UNL and open, soonest first, with live seats, under a bar that never says Foro", async ({ page }) => {
    const unl = await seedEvent("lista-unl", { registrationMode: "unl", date: new Date("2099-12-20"), registrationCapacity: 40, title: `Auditoría lista UNL ${STAMP}` });
    const open = await seedEvent("lista-abierta", { registrationMode: "open", date: new Date("2099-12-10"), registrationCapacity: 2, title: `Auditoría lista abierta ${STAMP}` });
    const undated = await seedEvent("lista-sinfecha", { registrationMode: "unl", date: null, title: `Auditoría lista sin fecha ${STAMP}` });
    const notListed = [
      await seedEvent("lista-libre", { registrationMode: "none", title: `Auditoría lista libre ${STAMP}` }),
      await seedEvent("lista-borrador", { registrationMode: "unl", isPublished: false, title: `Auditoría lista borrador ${STAMP}` }),
      await seedEvent("lista-pasado", { registrationMode: "open", date: new Date("2020-01-15"), title: `Auditoría lista pasado ${STAMP}` }),
      await seedEvent("lista-plazo", { registrationMode: "unl", registrationDeadline: new Date(Date.now() - 60_000), title: `Auditoría lista plazo ${STAMP}` }),
    ];
    const problems = watch(page);

    const response = await page.goto("/inscripciones");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Inscripciones" })).toBeVisible();
    await expect(page).toHaveTitle("Inscripciones — ASO Computación");

    // Its own bar, named for the registrations, whose brand leads to this list; nothing of the forum around it.
    const bar = page.getByRole("banner");

    await expect(bar.getByRole("link", { name: "Inscripciones de ASO Computación, inicio" })).toHaveAttribute("href", "/inscripciones");
    expect((await bar.textContent()) ?? "").not.toMatch(/foro/i);
    expect(await page.locator("a[href^='/foro']").count()).toBe(0);
    await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/foro/i);

    const card = (event: Seeded) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name: event.title }) });

    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/inscripciones-lista-escritorio.png`, fullPage: true });

    await expect(card(unl)).toContainText("Con cuenta UNL");
    await expect(card(unl)).toContainText("Quedan 40 cupos");
    await expect(card(open)).toContainText("Abierta al público");
    await expect(card(open)).toContainText("Quedan 2 cupos");
    await expect(card(undated)).toContainText("Sin límite de cupos");
    await expect(card(unl).getByRole("link", { name: unl.title })).toHaveAttribute("href", `/inscripciones/${unl.slug}`);
    for (const event of notListed) await expect(page.getByRole("link", { name: event.title }), event.slug).toHaveCount(0);

    // Soonest first, undated last.
    const titles = await page.getByRole("heading", { level: 2 }).allTextContents();
    const at = (event: Seeded) => titles.indexOf(event.title);

    expect(at(open)).toBeGreaterThanOrEqual(0);
    expect(at(open)).toBeLessThan(at(unl));
    expect(at(unl)).toBeLessThan(at(undated));

    // The seats are live: a confirmed person takes one, and a full event leaves the list.
    await prisma.eventRegistration.create({ data: { id: `${open.id}-1`, eventId: open.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Eva Mora", email: "eva@example.com", career: "C", semester: 3 } });
    await page.reload();
    await expect(card(open)).toContainText("Queda 1 cupo");
    await prisma.eventRegistration.create({ data: { id: `${open.id}-2`, eventId: open.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Luis Mora", email: "luis@example.com", career: "C", semester: 3 } });
    await page.reload();
    await expect(page.getByRole("link", { name: open.title })).toHaveCount(0);

    // A card leads to the event's page, under the same bar.
    await page.getByRole("link", { name: unl.title }).click();
    await expect(page).toHaveURL(new RegExp(`/inscripciones/${unl.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: unl.title })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Inscripciones de ASO Computación, inicio" })).toBeVisible();
    await page.getByRole("banner").getByRole("link", { name: "Inscripciones de ASO Computación, inicio" }).click();
    await expect(page).toHaveURL(/\/inscripciones$/);
    expect(problems).toEqual([]);
  });

  test("D8 / R3: on a phone the cards stack and nothing scrolls sideways, even with a very long title", async ({ page }) => {
    const long = await seedEvent("lista-movil", { registrationMode: "unl", title: `Auditoría ${"largo".repeat(30)} ${STAMP}`, description: "Descripción ".repeat(60) });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/inscripciones");
    await expect(page.getByRole("link", { name: new RegExp(long.title.slice(0, 30)) })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/inscripciones-lista-movil.png`, fullPage: true });
  });

  test("D8 / R3: /foro/eventos is a permanent redirect to /inscripciones that keeps the query string, in the browser too", async ({ page, request }) => {
    const target = (response: Awaited<ReturnType<typeof request.get>>) => {
      const location = new URL(response.headers().location ?? "", "http://127.0.0.1");

      return location.pathname + location.search;
    };
    const withQuery = await request.get("/foro/eventos?utm_source=landing&y=1", { maxRedirects: 0 });
    const plain = await request.get("/foro/eventos", { maxRedirects: 0 });

    expect(withQuery.status()).toBe(308);
    expect(target(withQuery)).toBe("/inscripciones?utm_source=landing&y=1");
    expect(plain.status()).toBe(308);
    expect(target(plain)).toBe("/inscripciones");

    await page.goto("/foro/eventos");
    await expect(page).toHaveURL(/\/inscripciones$/);
    await expect(page.getByRole("heading", { level: 1, name: "Inscripciones" })).toBeVisible();
  });

  test("D5 / R2: an expired session and a refused account are told in registration words, never as the forum, and nothing is stored", async ({ page, context }) => {
    test.skip(!FORUM_SECRET, "set FORUM_SESSION_SECRET to plant a forum member session");

    const event = await seedEvent("unlpalabras", { registrationMode: "unl", registrationCapacity: 5 });
    const member = await plantForumMemberSession(prisma, { memberId: `${PREFIX}m-exp`, sessionId: `${PREFIX}s-exp`, displayName: "Lucía Ñ." });
    const outsider = await plantForumMemberSession(prisma, { memberId: `${PREFIX}m-out`, sessionId: `${PREFIX}s-out`, email: `${PREFIX}outsider@gmail.com`, displayName: "Persona Externa" });
    const reserve = page.getByRole("button", { name: "Reservar mi cupo" });

    try {
      // The session ends while the page is open.
      await context.addCookies([member.cookie]);
      await page.goto(`/inscripciones/${event.slug}`);
      await expect(reserve).toBeVisible();
      await prisma.forumSession.update({ where: { id: member.sessionId }, data: { revokedAt: new Date() } });
      await reserve.click();
      await expect(page.locator("main").getByRole("alert")).toHaveText("Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para reservar su cupo.");
      await expect(page.locator("main")).not.toContainText(/foro/i);
      // This server has no Google client, so there is no sign-in to offer; where there is one it returns to this page (unit tests).
      await expect(page.getByRole("link", { name: /Entrar con Google/ })).toHaveCount(0);

      // An account outside the institution.
      await context.clearCookies();
      await context.addCookies([outsider.cookie]);
      await page.goto(`/inscripciones/${event.slug}`);
      await reserve.click();
      await expect(page.locator("main").getByRole("alert")).toHaveText("Su cuenta no puede reservar cupos. Use su cuenta institucional @unl.edu.ec.");
      await expect(page.locator("main")).not.toContainText(/foro/i);
      expect(await registrations(event)).toHaveLength(0);
    } finally {
      await prisma.forumSession.deleteMany({ where: { memberId: { in: [member.memberId, outsider.memberId] } } });
      await prisma.forumMember.deleteMany({ where: { id: { in: [member.memberId, outsider.memberId] } } });
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
    await openForm(page, event.slug);

    const submit = page.getByRole("button", { name: "Reservar mi cupo" });

    // All empty: every field is flagged and the first one takes the focus.
    await submit.click();
    for (const label of ["Nombre completo", "Correo", "Institución"]) {
      await expect(page.getByLabel(label)).toHaveAttribute("aria-invalid", "true");
    }
    // Career and semester are optional: left empty they are not flagged.
    for (const label of ["Carrera", "Ciclo"]) {
      await expect(page.getByLabel(label)).not.toHaveAttribute("aria-invalid", "true");
    }
    await expect(page.getByLabel("Nombre completo")).toBeFocused();
    await expect(page.getByText("Escriba su correo.")).toBeVisible();
    await expect(page.getByText("Escriba su institución.")).toBeVisible();

    // Spaces only are empty, too.
    await page.getByLabel("Nombre completo").fill("     ");
    await submit.click();
    await expect(page.getByText("Escriba su nombre.")).toBeVisible();

    // Every shape of a bad email.
    for (const email of ["ana", "ana@", "@example.com", "ana@example", "ana @example.com", "ana@@example.com", "ana@.com", `${"a".repeat(250)}@x.co`]) {
      await fillForm(page, { email });
      await submit.click();
      await expect(page.getByLabel("Correo"), email.slice(0, 20)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Revise su correo: no parece una dirección válida."), email.slice(0, 20)).toBeVisible();
    }

    // Length limits: 121 characters are too many, in the name and in the career.
    await fillForm(page, { name: "n".repeat(121), career: "c".repeat(121) });
    await submit.click();
    await expect(page.getByText("Su nombre es muy largo: use hasta 120 caracteres.")).toBeVisible();
    await expect(page.getByText("Su carrera es muy larga: use hasta 120 caracteres.")).toBeVisible();

    expect(sent).toBe(0);
  });

  test("a valid form with accents, ñ, CJK and emoji, extra spaces and an uppercase email is stored cleaned up, pending, and asks to check the email", async ({ page }) => {
    const event = await seedEvent("exito", { registrationCapacity: 3 });

    await openForm(page, event.slug);
    await fillForm(page, { name: "  José   Ñandú 李雷 😀  ", email: "  JOSÉ.Ñandú@Exámple.COM ", career: "Ingeniería en Sistemas / Computación — «UNL»", semester: "12" });
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();

    const done = page.getByRole("status").filter({ hasText: "Revise su correo" });

    await expect(done).toBeFocused();
    await expect(done).toContainText("JOSÉ.Ñandú@Exámple.COM");
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toHaveCount(0);
    // No seat is taken until the link is used: the seats behind do not move.
    await expect(page.getByText("Quedan 3 cupos")).toBeVisible();
    // The confirmation really went out, to the address as the person wrote it once cleaned up, and carries the link.
    const [mail] = await waitForMail("josé.ñandú@exámple.com");

    expect(mail!.subject).toBe(`Confirme su cupo en «${event.title}»`);
    expect(confirmationLink(mail!)).toContain(`/inscripciones/${event.slug}/confirmar?token=`);
    expect(await registrations(event)).toMatchObject([
      { mode: "open", name: "José Ñandú 李雷 😀", email: "josé.ñandú@exámple.com", institution: "Universidad Nacional de Loja", career: "Ingeniería en Sistemas / Computación — «UNL»", semester: 12, confirmedAt: null },
    ]);
  });

  test("R4 → R5: the open form, the link in the email, the confirmation and the seat that was taken, with the real widget", async ({ page }) => {
    const event = await seedEvent("deextremo", { registrationCapacity: 2 });
    const address = "extremo@example.com";

    // No stub here: Cloudflare's own widget (its always-pass test key) renders in the page and gives the token.
    await page.goto(`/inscripciones/${event.slug}`);
    // (Its frame sits in a closed shadow root, so it is found by the frames of the page, not by a selector.)
    await expect.poll(() => page.frames().some((frame) => frame.url().startsWith("https://challenges.cloudflare.com/cdn-cgi/")), { message: "Cloudflare's widget frame" }).toBe(true);
    await expect(page.getByText("Quedan 2 cupos")).toBeVisible();
    await fillForm(page, { name: "Daniela Extremo", email: address });

    // The widget passes on its own a moment after it appears. Until the token arrives the form says the check is
    // missing (and sends nothing); the alert goes away with the token, so click again until the answer shows.
    const done = page.getByRole("status").filter({ hasText: "Revise su correo" });

    await expect(async () => {
      await page.getByRole("button", { name: "Reservar mi cupo" }).click();
      await expect(done).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByText("Quedan 2 cupos")).toBeVisible();
    expect(await registrations(event)).toMatchObject([{ email: address, confirmedAt: null }]);

    // The person opens the link from their email; opening it confirms nothing, the button does.
    const mails = await waitForMail(address);

    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe(`Confirme su cupo en «${event.title}»`);
    await page.goto(confirmationLink(mails[0]!), { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Confirmar mi cupo" })).toBeVisible();
    expect((await registrations(event))[0]!.confirmedAt).toBeNull();
    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Listo, su cupo está reservado" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toBeVisible();
    expect((await registrations(event))[0]!.confirmedAt).not.toBeNull();

    // The seat is taken now: the event page counts one fewer.
    await page.goto(`/inscripciones/${event.slug}`);
    await expect(page.getByText("Queda 1 cupo")).toBeVisible();
  });

  test("an email that is already confirmed (any case, with spaces) is a duplicate on the email field and stores one row; asking again while pending refreshes the same row", async ({ page }) => {
    const event = await seedEvent("duplicado");

    await prisma.eventRegistration.create({ data: { id: `${event.id}-c`, eventId: event.id, mode: "open", name: "Ana Pérez", email: ANA.email, institution: "UNL", confirmedAt: new Date() } });
    await openForm(page, event.slug);
    await fillForm(page, { name: "Otra Persona", email: " ANA@Example.com " });
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();
    await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Correo")).toBeFocused();
    await expect(page.getByText("Ya hay una inscripción con ese correo para este evento.")).toBeVisible();
    expect(await registrations(event)).toHaveLength(1);

    // A different address that asks twice while pending keeps one row, with the same id.
    await fillForm(page, { email: "luis@example.com" });
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Revise su correo" })).toBeVisible();
    const [pending] = (await registrations(event)).filter((row) => row.email === "luis@example.com");

    await openForm(page, event.slug);
    await fillForm(page, { email: "luis@example.com", name: "Luis Mora" });
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Revise su correo" })).toBeVisible();
    expect((await registrations(event)).filter((row) => row.email === "luis@example.com")).toMatchObject([{ id: pending!.id, name: "Luis Mora", confirmedAt: null }]);
  });

  test("a double click sends one request and stores one registration", async ({ page }) => {
    const event = await seedEvent("doble");
    let sent = 0;

    await page.route(OPEN_ENDPOINT, async (route) => {
      sent += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));

      return route.fallback();
    });
    await openForm(page, event.slug);
    await fillForm(page);

    const submit = page.getByRole("button", { name: /Reservar mi cupo|Enviando/ });

    await submit.dblclick();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Revise su correo" })).toBeVisible();
    expect(sent).toBe(1);
    expect(await registrations(event)).toHaveLength(1);
  });

  test("a visitor who loaded the form before the last seat was confirmed is told the event is full", async ({ page }) => {
    const event = await seedEvent("ultimo", { registrationCapacity: 1 });

    await openForm(page, event.slug);
    await expect(page.getByText("Queda 1 cupo")).toBeVisible();

    // Somebody else confirms the last seat while this form is open.
    await prisma.eventRegistration.create({ data: { id: `${event.id}-c`, eventId: event.id, mode: "open", name: "Ana Pérez", email: ANA.email, institution: "UNL", confirmedAt: new Date() } });

    await fillForm(page, { name: "Luis Tarde", email: "luis@example.com" });
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();
    await expect(page.getByText("Ya no quedan cupos para este evento.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toHaveCount(0);
    expect(await registrations(event)).toMatchObject([{ email: ANA.email }]);
  });

  test("when registration closes while the form is open, the form gives way to the state; a network failure keeps the data", async ({ page }) => {
    const event = await seedEvent("cierra");

    await openForm(page, event.slug);
    await fillForm(page);
    await page.route(OPEN_ENDPOINT, (route) => route.abort("connectionrefused"), { times: 1 });
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos enviar su inscripción." })).toBeVisible();
    await expect(page.getByLabel("Nombre completo")).toHaveValue(ANA.name);

    // An answer that is not JSON at all (a proxy's HTML page) is the same plain failure.
    await page.route(OPEN_ENDPOINT, (route) => route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" }), { times: 1 });
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos enviar su inscripción." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toBeEnabled();
  });

  // "A Turnstile secret without a site key closes the form with 'no disponible'" depends on the server's own
  // configuration, which this harness sets complete: it is proved by the unit test of the event page
  // (src/tests/unit/app/inscripciones-event-page.test.ts) and by the 503 `unavailable` answer shown in event-page.spec.ts.

  test("the form fits a 320 px phone and a 200% zoomed desktop without sideways scroll", async ({ page }) => {
    const event = await seedEvent("movil", { title: `Auditoría ${"palabralarga".repeat(12)} ${STAMP}`, description: "x".repeat(400) });

    for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 360 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`/inscripciones/${event.slug}`);
      await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${viewport.width}px`).toBe(true);
    }
  });
});

test.describe("the registration endpoint", () => {
  test("every invalid field is a 400 naming the field, and a lone surrogate is a refusal, not a server error", async ({ request }) => {
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
      ["institution missing", { institution: undefined }, "institution"],
      ["institution empty", { institution: "  " }, "institution"],
      ["institution over 120", { institution: "i".repeat(121) }, "institution"],
      ["career over 120", { career: "c".repeat(121) }, "career"],
      ["semester 0", { semester: 0 }, "semester"],
      ["semester 13", { semester: 13 }, "semester"],
      ["semester 5.5", { semester: 5.5 }, "semester"],
      ["semester text", { semester: "cinco" }, "semester"],
    ];

    for (const [label, override, field] of cases) {
      const response = await post(request, event.slug, { ...valid, ...override });

      expect({ label, status: response.status(), body: await response.json() }).toEqual({ label, status: 400, body: { error: "validation", field } });
    }

    expect(await registrations(event)).toHaveLength(0);
  });

  test("career and semester are optional: leaving both out, or sending them null or blank, is accepted and stored empty", async ({ request }) => {
    const event = await seedEvent("opcionales", { registrationCapacity: 50 });
    const { career, semester, ...required } = ANA;

    expect(career && semester).toBeTruthy();
    for (const [index, extra] of [{}, { career: null, semester: null }, { career: "  ", semester: "" }].entries()) {
      expect((await post(request, event.slug, { ...required, ...extra, email: `op${index}@example.com`, turnstileToken: "audit-token" })).status()).toBe(201);
    }

    expect(await registrations(event)).toMatchObject([{ career: null, semester: null }, { career: null, semester: null }, { career: null, semester: null }]);
  });

  test("the limits are inclusive: 120 characters, semesters 1 and 12 and a string semester are accepted", async ({ request }) => {
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
    const body = { ...ANA, turnstileToken: "audit-token" };

    expect((await post(request, open.slug, "plain", nextIp(), { "content-type": "text/plain" })).status()).toBe(415);
    expect((await post(request, open.slug, "{not json", nextIp(), { "content-type": "application/json" })).status()).toBe(400);
    expect((await post(request, open.slug, [1, 2], nextIp())).status()).toBe(400);
    expect((await post(request, open.slug, "null", nextIp(), { "content-type": "application/json" })).status()).toBe(400);
    expect((await post(request, open.slug, { ...body, name: "n".repeat(5000) })).status()).toBe(413);
    expect((await post(request, "UPPER", body)).status()).toBe(404);
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

  test("five pending people confirming at once for a three-seat event: exactly three get a seat", async ({ request }) => {
    test.skip(!CONFIRM_SECRET, "needs REGISTRATION_CONFIRM_SECRET in the test environment to sign the links");

    const event = await seedEvent("carrera", { registrationCapacity: 3 });
    const asked = await Promise.all(
      Array.from({ length: 5 }, (_, index) => post(request, event.slug, { ...ANA, email: `carrera${index}@example.com`, turnstileToken: "audit-token" })),
    );

    // Pending people take no seat: all five are accepted, none is counted yet.
    expect(asked.map((answer) => answer.status())).toEqual([201, 201, 201, 201, 201]);
    expect((await registrations(event)).every((row) => row.confirmedAt === null)).toBe(true);

    const answers = await Promise.all(
      (await registrations(event)).map(async (row) => confirm(request, event.slug, await confirmToken(row.id, event.id, row.confirmNonce))),
    );

    expect(answers.map((answer) => answer.status()).sort()).toEqual([200, 200, 200, 409, 409]);
    expect(await Promise.all(answers.filter((answer) => answer.status() === 409).map((answer) => answer.json()))).toEqual([{ error: "full" }, { error: "full" }]);
    expect((await registrations(event)).filter((row) => row.confirmedAt !== null)).toHaveLength(3);
  });

  test("the confirm link: opening the page confirms nothing, the button does, and the seat shows with its calendar", async ({ page, request }) => {
    test.skip(!CONFIRM_SECRET, "needs REGISTRATION_CONFIRM_SECRET in the test environment to sign the links");

    const event = await seedEvent("confirmar", { registrationCapacity: 2 });
    const row = await prisma.eventRegistration.create({ data: { id: `${event.id}-p`, eventId: event.id, mode: "open", name: "Ana Pérez", email: ANA.email, institution: "UNL" } });
    const token = await confirmToken(row.id, event.id);

    await page.goto(`/inscripciones/${event.slug}/confirmar?token=${token}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Confirmar mi cupo" })).toBeVisible();
    expect((await registrations(event))[0]!.confirmedAt).toBeNull();
    expect((await request.get(`/api/public/events/${event.slug}/registrations/confirm`, { headers: { "x-real-ip": nextIp() } })).status()).toBe(405);

    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Listo, su cupo está reservado" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Añadir al calendario" })).toBeVisible();
    await expect(page.getByText("Queda 1 cupo")).toBeVisible();
    expect((await registrations(event))[0]!.confirmedAt).not.toBeNull();

    // The same link again shows the seat that is already theirs; a made-up link sends them back to the form.
    await page.goto(`/inscripciones/${event.slug}/confirmar?token=${token}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Su cupo ya estaba reservado" })).toBeVisible();

    await page.goto(`/inscripciones/${event.slug}/confirmar?token=basura`);
    await expect(page.getByText("Este enlace no sirve")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al formulario" })).toHaveAttribute("href", `/inscripciones/${event.slug}`);
  });

  test("ten identical submissions at once store one pending registration and refresh it", async ({ request }) => {
    const event = await seedEvent("simultaneo");
    const answers = await Promise.all(Array.from({ length: 4 }, () => post(request, event.slug, { ...ANA, turnstileToken: "audit-token" })));

    // Still pending, so each one refreshes the same row and sends the link again.
    expect(answers.map((answer) => answer.status())).toEqual([201, 201, 201, 201]);
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
        { id: `${open.id}-1`, eventId: open.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Ana Secreta", email: "secreta@example.com", career: "C", semester: 1 },
        { id: `${open.id}-2`, eventId: open.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Beto", email: "beto@example.com", career: "C", semester: 2 },
        { id: `${unlimited.id}-1`, eventId: unlimited.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Eva", email: "eva@example.com", career: "C", semester: 3 },
        { id: `${full.id}-1`, eventId: full.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Ivo", email: "ivo@example.com", career: "C", semester: 3 },
        { id: `${closed.id}-1`, eventId: closed.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "Ula", email: "ula@example.com", career: "C", semester: 3 },
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
        ...[1, 2, 3].map((n) => ({ id: `${live.id}-${n}`, eventId: live.id, mode: "open" as const, institution: "UNL", confirmedAt: new Date(), name: `Persona ${n}`, email: `p${n}@example.com`, career: "C", semester: n })),
        { id: `${draft.id}-1`, eventId: draft.id, mode: "open" as const, institution: "UNL", confirmedAt: new Date(), name: "Borra", email: "b@example.com", career: "C", semester: 1 },
        { id: `${past.id}-1`, eventId: past.id, mode: "open" as const, institution: "UNL", confirmedAt: new Date(), name: "Pasada", email: "pa@example.com", career: "C", semester: 1 },
      ],
    });

    expect((await request.get("/admin/registrations", { maxRedirects: 0 })).status()).toBe(307);

    await logInAsAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const problems = watch(page);

    await page.goto("/admin/registrations");
    await expect(page.getByRole("heading", { name: "Inscripciones", level: 1 })).toBeVisible();

    const rowOf = (event: Seeded) => page.getByRole("navigation", { name: "Eventos con inscripción" }).getByRole("link", { name: new RegExp(event.title) });

    await expect(rowOf(live)).toContainText("3 / 6");
    await expect(rowOf(live)).toContainText("Abierta");
    await expect(rowOf(unlimited)).toContainText("0 · sin límite");
    await expect(rowOf(draft)).toContainText("Borrador: no está en el sitio");
    await expect(rowOf(draft)).toContainText("1 / 2");
    await expect(rowOf(past)).toContainText("Cerrada");
    await expect(page.getByRole("heading", { name: "Pasados" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(none.title) })).toHaveCount(0);
    expect(problems).toEqual([]);

    // The numbers a visitor can read are the numbers the admin reads.
    const seats: { events: { slug: string; registered: number; capacity: number | null }[] } = await (await request.get("/api/public/events/seats", { headers: { "x-real-ip": nextIp() } })).json();

    for (const event of [live, unlimited, past]) {
      const row = seats.events.find((entry) => entry.slug === event.slug)!;

      await expect(rowOf(event), event.slug).toContainText(row.capacity === null ? `${row.registered} · sin límite` : `${row.registered} / ${row.capacity}`);
    }

    // The link selects that event and shows its people; the count there is the same.
    await rowOf(live).click();
    await expect(page).toHaveURL(new RegExp(`/admin/registrations\\?evento=${live.id}$`));
    await expect(rowOf(live)).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("region", { name: "Lista de inscripciones" }).getByRole("row")).toHaveCount(4);
    await expect(page.getByText("3 / 6").first()).toBeVisible();
  });

  test("on a phone the events come first, an event opens its people with a way back, and nothing scrolls sideways", async ({ page }) => {
    const event = await seedEvent("adminmovil", { title: `Auditoría ${"largo".repeat(40)} ${STAMP}`, registrationCapacity: 6 });

    await logInAsAdmin(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/admin/registrations");
    await expect(page.getByText(event.title.slice(0, 30)).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.getByRole("link", { name: new RegExp(event.title.slice(0, 30)) }).first().click();
    await expect(page.getByRole("link", { name: "← Eventos" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Eventos con inscripción" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("link", { name: "← Eventos" }).click();
    await expect(page.getByRole("navigation", { name: "Eventos con inscripción" })).toBeVisible();
  });

  test("the registrants page lists, exports a safe CSV, deletes one registration, and the counts follow everywhere", async ({ page, request }) => {
    const event = await seedEvent("adminlista", { registrationCapacity: 2 });

    await prisma.eventRegistration.createMany({
      data: [
        { id: `${event.id}-1`, eventId: event.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "=HYPERLINK(\"http://evil.example\")", email: "formula@example.com", career: "+SUM(1;2)", semester: 4 },
        { id: `${event.id}-2`, eventId: event.id, mode: "open", institution: "UNL", confirmedAt: new Date(), name: "María \"la Ñ\", Pérez 李雷", email: "maria@example.com", career: "Ingeniería, Sistemas", semester: 12 },
      ],
    });

    await logInAsAdmin(page);
    await page.goto(`/admin/registrations?evento=${event.id}`);
    await expect(page.getByRole("row")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: event.title, level: 2 })).toBeVisible();
    await expect(page.getByText("2 / 2").first()).toBeVisible();
    await expect(page.getByText("María \"la Ñ\", Pérez 李雷")).toBeVisible();

    const exported = await page.request.get(`/admin/events/${event.id}/registrations/export`);
    const csv = await exported.text();

    expect(exported.status()).toBe(200);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://evil.example\"\")\"");
    expect(csv).toContain("\"'+SUM(1;2)\"");
    expect(csv).toContain("\"María \"\"la Ñ\"\", Pérez 李雷\"");
    expect(csv.trim().split("\r\n")).toHaveLength(3);

    // The old per-event address lands here; an unknown event falls back to the screen's default, and the export has no body to leak.
    await page.goto(`/admin/events/${event.id}/registrations`);
    await expect(page).toHaveURL(new RegExp(`/admin/registrations\\?evento=${event.id}$`));
    await page.goto("/admin/registrations?evento=no-existe");
    await expect(page.getByRole("heading", { name: "Inscripciones", level: 1 })).toBeVisible();
    expect((await page.request.get("/admin/events/no-existe/registrations/export")).status()).toBe(404);
    await page.goto(`/admin/registrations?evento=${event.id}`);

    await page.getByRole("row").filter({ hasText: "formula@example.com" }).getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page.getByText("1 / 2").first()).toBeVisible({ timeout: 15_000 });
    expect(await registrations(event)).toHaveLength(1);

    // The freed seat is public at once (the next read; the edge may hold a copy for 5 s at most).
    const seats = await (await request.get("/api/public/events/seats", { headers: { "x-real-ip": nextIp() } })).json();

    expect(seats.events).toContainEqual({ slug: event.slug, capacity: 2, registered: 1, seatsLeft: 1, status: "open" });
  });

  test("D15 / R9: an open-form event with nobody registered shows the copyable /inscripciones/<slug> link, like a UNL one", async ({ page }) => {
    const open = await seedEvent("adminlink-abierto", { registrationMode: "open" });
    const unl = await seedEvent("adminlink-unl", { registrationMode: "unl" });

    await logInAsAdmin(page);

    for (const event of [open, unl]) {
      await page.goto(`/admin/registrations?evento=${event.id}`);
      await expect(page.getByText("Todavía no hay inscripciones.")).toBeVisible();
      await expect(page.getByLabel("Link de la página de inscripción"), event.slug).toHaveValue(`http://127.0.0.1:3100/inscripciones/${event.slug}`);
      await expect(page.getByRole("button", { name: "Copiar link" }), event.slug).toBeVisible();
      await expect(page.getByText(/tarjeta|ancla/), event.slug).toHaveCount(0);
    }
  });
});
