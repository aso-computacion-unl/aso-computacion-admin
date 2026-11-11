import { Prisma } from "@/generated/prisma/client";
import { REMINDER_SHARE_OF_DAILY_MAIL } from "@/domain/registration-reminder";
import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { PUBLISHED_TEXT } from "./publish";
import { confirmationLink, receivedMail, waitForMail } from "./support/mail-sink";
import { openForm } from "./support/turnstile";

/*
 * The registration rules decided with the product owner (docs/JOURNEYS.md "Decisions"), in the browser and over the
 * public endpoints, each with the rows it must leave behind:
 *   D9  (R4, R5)  registering again while pending: only the latest confirmation link works.
 *   D11 (R5)      the confirm page of an event that no longer takes registrations says so, not a 404.
 *   D12 (R4, R6)  reminders keep 30 % of the day's mail for confirmations, which may use all that is left.
 *   D14 (R8)      the event form asks before a change that affects the people already registered.
 * D12's reminders half is a unit test (the cron needs CRON_SECRET, which `npm run e2e` blanks): what shows here is that
 * a confirmation still goes out after the reminders took their share, and stops only when the whole cap is spent.
 *
 * Every event is seeded into the database under a unique prefix and removed at the end; every email address carries
 * the run's stamp, because the mail sink keeps everything the app sent during the whole run.
 */
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STAMP = Date.now().toString(36);
const PREFIX = `rr-${STAMP}-`;
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

const ANA = { name: "Ana Pérez", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5 };
const octet = () => 20 + Math.floor(Math.random() * 200);
const subnet = `10.${octet()}.${octet()}`;
let addresses = 0;
const nextIp = () => `${subnet}.${++addresses}`;
const email = (name: string) => `${name}-${STAMP}@example.com`;

interface Seeded {
  id: string;
  slug: string;
  title: string;
}

async function seedEvent(name: string, overrides: Partial<Prisma.EventUncheckedCreateInput> = {}): Promise<Seeded> {
  const slug = `${PREFIX}${name}`;
  const title = `Reglas ${name} ${STAMP}`;

  await prisma.event.create({
    data: { id: slug, slug, date: new Date("2099-11-28"), hora: "09:00 - 11:00", lugar: "Laboratorio 2", isPublished: true, registrationMode: "open", updatedAt: new Date(), ...overrides, title },
  });

  return { id: slug, slug, title };
}

const registrations = (event: Seeded) => prisma.eventRegistration.findMany({ where: { eventId: event.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const eventRow = (event: Seeded) => prisma.event.findUniqueOrThrow({ where: { id: event.id } });

function post(request: APIRequestContext, slug: string, who: string, name = ANA.name) {
  return request.post(`/api/public/events/${slug}/registrations`, { data: { ...ANA, name, email: who, turnstileToken: "audit-token" }, headers: { "x-real-ip": nextIp() } });
}

async function fillForm(page: Page, name: string, who: string) {
  await page.getByLabel("Nombre completo").fill(name);
  await page.getByLabel("Correo").fill(who);
  await page.getByLabel("Institución").fill(ANA.institution);
  await page.getByLabel("Carrera").fill(ANA.career);
  await page.getByLabel("Ciclo").selectOption(String(ANA.semester));
}

/** The visitor registers through the page, as a person would: the form is answered with "Revise su correo". */
async function registerThroughThePage(page: Page, event: Seeded, name: string, who: string) {
  await openForm(page, event.slug);
  await fillForm(page, name, who);
  await page.getByRole("button", { name: "Reservar mi cupo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Revise su correo" })).toBeVisible();
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

const tokenOf = (link: string) => new URL(link, "http://127.0.0.1").searchParams.get("token")!;
const result = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

test.describe.configure({ timeout: 120_000 });

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
});

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-real-ip": nextIp() });
});

test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

test.describe("D9 (R4, R5): only the latest confirmation link works", () => {
  test("registering again while pending retires the first link, which answers 'Este enlace no sirve' and changes nothing; the second confirms", async ({ page }) => {
    const event = await seedEvent("ultimoenlace", { registrationCapacity: 5 });
    const who = email("ultimo");

    await registerThroughThePage(page, event, "Ana Pérez", who);
    await registerThroughThePage(page, event, "Ana María Pérez", who);

    const mails = await waitForMail(who, { count: 2 });

    expect(mails).toHaveLength(2);

    const [oldLink, newLink] = mails.map(confirmationLink) as [string, string];

    expect(oldLink).not.toBe(newLink);

    // Two registrations, one pending row (same person, refreshed), no seat taken.
    const [pending, ...others] = await registrations(event);

    expect(others).toEqual([]);
    expect(pending).toMatchObject({ email: who, name: "Ana María Pérez", confirmedAt: null });

    // The first link: the page opens, the click is refused, the row stays as it was.
    await page.goto(oldLink, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(result(page, "Este enlace no sirve")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al formulario" })).toHaveAttribute("href", `/inscripciones/${event.slug}`);
    await expect(result(page, "Listo, su cupo está reservado")).toHaveCount(0);
    expect(await registrations(event)).toEqual([pending]);

    await page.goto(`/inscripciones/${event.slug}`);
    await expect(page.getByText("Quedan 5 cupos")).toBeVisible();

    // The newest link confirms the same row.
    await page.goto(newLink, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(result(page, "Listo, su cupo está reservado")).toBeVisible();

    const [confirmed, ...rest] = await registrations(event);

    expect(rest).toEqual([]);
    expect(confirmed).toMatchObject({ id: pending!.id, email: who, confirmedAt: expect.any(Date) });

    // Afterwards the old link is still no use, while the new one finds its seat already taken.
    await page.goto(oldLink, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(result(page, "Este enlace no sirve")).toBeVisible();
    await page.goto(newLink, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(result(page, "Su cupo ya estaba reservado")).toBeVisible();
    expect(await registrations(event)).toEqual([confirmed]);
  });

  test("the confirm endpoint answers the first link 400 invalid and the second 200", async ({ request }) => {
    const event = await seedEvent("ultimoapi", { registrationCapacity: 5 });
    const who = email("ultimoapi");

    expect((await post(request, event.slug, who)).status()).toBe(201);
    expect((await post(request, event.slug, who, "Ana M. Pérez")).status()).toBe(201);

    const [oldToken, newToken] = (await waitForMail(who, { count: 2 })).map((mail) => tokenOf(confirmationLink(mail)));
    const before = await registrations(event);
    const stale = await request.post(`/api/public/events/${event.slug}/registrations/confirm`, { data: { token: oldToken }, headers: { "x-real-ip": nextIp() } });

    expect(stale.status()).toBe(400);
    expect(await stale.json()).toEqual({ error: "invalid" });
    expect(await registrations(event)).toEqual(before);

    const fresh = await request.post(`/api/public/events/${event.slug}/registrations/confirm`, { data: { token: newToken }, headers: { "x-real-ip": nextIp() } });

    expect(fresh.status()).toBe(200);
    expect(await fresh.json()).toEqual({ ok: true, status: "confirmed" });
    expect((await registrations(event))[0]!.confirmedAt).not.toBeNull();
  });
});

test.describe("D11 (R5): the confirm page of an event that no longer takes registrations", () => {
  const GONE: [string, Partial<Prisma.EventUncheckedCreateInput>][] = [
    ["switched to no registration", { registrationMode: "none", registrationCapacity: null }],
    ["switched to UNL accounts", { registrationMode: "unl" }],
    ["unpublished", { isPublished: false }],
    ["moved to the trash", { deletedAt: new Date() }],
  ];

  for (const [index, [label, change]] of GONE.entries()) {
    test(`says "Este evento ya no recibe inscripciones", not a 404, with no button and the registration untouched, when the event was ${label}`, async ({ page, request }) => {
      const event = await seedEvent(`gone${index}`, { registrationCapacity: 5 });
      const who = email(`gone${index}`);

      expect((await post(request, event.slug, who)).status()).toBe(201);

      const link = confirmationLink((await waitForMail(who))[0]!);
      const before = await registrations(event);

      await prisma.event.update({ where: { id: event.id }, data: change });

      const response = await page.goto(link, { waitUntil: "networkidle" });

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Este evento ya no recibe inscripciones", level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver las inscripciones abiertas" })).toHaveAttribute("href", "/inscripciones");
      await expect(page.getByRole("button", { name: "Confirmar mi cupo" })).toHaveCount(0);
      await expect(page.getByText("Este enlace no sirve")).toHaveCount(0);

      // Nothing could be confirmed through the endpoint either: the same refusal, the row as it was.
      const refused = await request.post(`/api/public/events/${event.slug}/registrations/confirm`, { data: { token: tokenOf(link) }, headers: { "x-real-ip": nextIp() } });

      expect(refused.status()).toBe(404);
      expect(await registrations(event)).toEqual(before);
      expect(before[0]!.confirmedAt).toBeNull();
    });
  }

  test("a bad token still says 'Este enlace no sirve' for an event that is public but no longer open, and stays a 404 for one that is gone", async ({ page, request }) => {
    const mode = await seedEvent("badtokenmode", { registrationMode: "unl" });
    const trashed = await seedEvent("badtokentrash", { deletedAt: new Date() });

    const response = await page.goto(`/inscripciones/${mode.slug}/confirmar?token=basura`);

    expect(response?.status()).toBe(200);
    await expect(page.getByText("Este enlace no sirve")).toBeVisible();
    await expect(page.getByText("Este evento ya no recibe inscripciones")).toHaveCount(0);

    expect((await request.get(`/inscripciones/${trashed.slug}/confirmar?token=basura`)).status()).toBe(404);
    expect((await request.get("/inscripciones/no-existe-nunca/confirmar?token=basura")).status()).toBe(404);
  });

  test("an event that is still open keeps its confirm page: the button is there, and a bad token still says 'Este enlace no sirve'", async ({ page, request }) => {
    const event = await seedEvent("sigueabierto", { registrationCapacity: 5 });
    const who = email("sigue");

    expect((await post(request, event.slug, who)).status()).toBe(201);
    await page.goto(confirmationLink((await waitForMail(who))[0]!), { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Confirmar mi cupo" })).toBeVisible();

    await page.goto(`/inscripciones/${event.slug}/confirmar?token=basura`);
    await expect(page.getByText("Este enlace no sirve")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar mi cupo" })).toHaveCount(0);
  });
});

test.describe("D12 (R4): the reserve for confirmation emails", () => {
  // Ecuador's day, the one the mail counter is kept by (UTC-5, no daylight saving).
  const today = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
  const sentToday = async () => (await prisma.mailDailyCounter.findUnique({ where: { day: today() } }))?.sent ?? 0;
  const setSent = (sent: number) => prisma.mailDailyCounter.upsert({ where: { day: today() }, create: { day: today(), sent }, update: { sent } });

  test("after the reminders took their 70 %, confirmations still go out with what is left, and the form says so only when the whole cap is spent", async ({ request }) => {
    const event = await seedEvent("reserva", { registrationCapacity: 20 });
    const original = await sentToday();
    // The default cap is 400 messages a day (the e2e run leaves MAIL_DAILY_LIMIT unset).
    const cap = 400;
    const reminders = Math.floor(cap * REMINDER_SHARE_OF_DAILY_MAIL);
    const [a, b, c] = [email("reserva-a"), email("reserva-b"), email("reserva-c")] as const;

    try {
      await setSent(reminders);

      expect((await post(request, event.slug, a)).status()).toBe(201);
      expect((await waitForMail(a)).length).toBe(1);
      expect(await sentToday()).toBe(reminders + 1);

      // The last message of the day still goes to a confirmation.
      await setSent(cap - 1);

      expect((await post(request, event.slug, b)).status()).toBe(201);
      expect((await waitForMail(b)).length).toBe(1);
      expect(await sentToday()).toBe(cap);

      // Cap spent: refused before anything is stored, nothing sent.
      const refused = await post(request, event.slug, c);

      expect(refused.status()).toBe(503);
      expect(await refused.json()).toEqual({ error: "email_budget" });
      expect((await registrations(event)).map((row) => row.email).sort()).toEqual([a, b]);
      expect(receivedMail().filter((mail) => mail.to.includes(c))).toEqual([]);
      expect(await sentToday()).toBe(cap);
    } finally {
      await setSent(original);
    }
  });
});

test.describe("D14 (R8): the event form asks before a change that affects the people already registered", () => {
  /** An event with three confirmed registrations and two pending ones (which hold no seat and are not counted). */
  async function seedWithPeople(name: string, overrides: Partial<Prisma.EventUncheckedCreateInput> = {}) {
    const event = await seedEvent(name, { registrationCapacity: 30, ...overrides });
    const person = (suffix: string, confirmed: boolean) => ({
      id: `${event.id}-${suffix}`,
      eventId: event.id,
      mode: "open" as const,
      name: `Persona ${suffix}`,
      email: `${suffix}@example.com`,
      institution: "UNL",
      createdAt: new Date(),
      confirmedAt: confirmed ? new Date() : null,
    });

    await prisma.eventRegistration.createMany({ data: [person("a", true), person("b", true), person("c", true), person("p1", false), person("p2", false)] });

    return event;
  }

  const openEditor = async (page: Page, event: Seeded) => {
    await page.goto(`/admin/events/${event.id}/edit`, { waitUntil: "networkidle" });
    await expect(page.getByLabel("Título")).toHaveValue(event.title);
  };
  const question = (page: Page) => page.getByRole("alertdialog");
  const preview = (page: Page) => page.getByRole("dialog", { name: "Así queda" });

  test("changing the mode asks 'Este evento ya tiene 3 inscritos…', states the consequence, stores nothing until confirmed, and keeps every registration", async ({ page }) => {
    const event = await seedWithPeople("modo");
    const people = await registrations(event);

    await logInAsAdmin(page);
    await openEditor(page, event);
    await page.getByRole("radio", { name: "Cuenta UNL" }).check();
    await page.getByRole("button", { name: "Publicar", exact: true }).click();

    await expect(question(page)).toBeVisible();
    await expect(question(page)).toContainText("Este evento ya tiene 3 inscritos.");
    await expect(question(page)).toContainText("conservan su cupo");
    await expect(preview(page)).toHaveCount(0);
    expect((await eventRow(event)).registrationMode).toBe("open");

    // Keep editing: still nothing stored, the edit is still in the form.
    await question(page).getByRole("button", { name: "Seguir editando" }).click();
    await expect(question(page)).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Cuenta UNL" })).toBeChecked();
    expect((await eventRow(event)).registrationMode).toBe("open");

    // Accept: the publish preview follows, and the save goes through.
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await question(page).getByRole("button", { name: "Guardar el cambio" }).click();
    await expect(preview(page)).toBeVisible();
    await preview(page).getByRole("button", { name: "Sí, publicar" }).click();
    await expect(page.getByText(PUBLISHED_TEXT).first()).toBeVisible();

    expect((await eventRow(event)).registrationMode).toBe("unl");
    expect(await registrations(event)).toEqual(people);
  });

  test("lowering the seats below the registered asks and says the event will be full; at their number it saves without asking", async ({ page }) => {
    const event = await seedWithPeople("cupos");
    const people = await registrations(event);

    await logInAsAdmin(page);
    await openEditor(page, event);
    await page.getByLabel("Cupos").fill("2");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();

    await expect(question(page)).toContainText("Este evento ya tiene 3 inscritos.");
    await expect(question(page)).toContainText("2 cupos");
    await expect(question(page)).toContainText("agotado");
    expect((await eventRow(event)).registrationCapacity).toBe(30);

    await question(page).getByRole("button", { name: "Guardar el cambio" }).click();
    await preview(page).getByRole("button", { name: "Sí, publicar" }).click();
    await expect(page.getByText(PUBLISHED_TEXT).first()).toBeVisible();
    expect((await eventRow(event)).registrationCapacity).toBe(2);
    expect(await registrations(event)).toEqual(people);

    // Seats equal to the registered people are not below them: no question, straight to the preview.
    await page.getByLabel("Cupos").fill("3");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(preview(page)).toBeVisible();
    await expect(question(page)).toHaveCount(0);
    await preview(page).getByRole("button", { name: "Seguir editando" }).click();
    expect((await eventRow(event)).registrationCapacity).toBe(2);
  });

  test("an event nobody has confirmed yet saves a mode change without asking: pending registrations do not count", async ({ page }) => {
    const event = await seedEvent("sinnadie", { registrationCapacity: 30 });

    await prisma.eventRegistration.create({ data: { id: `${event.id}-p`, eventId: event.id, mode: "open", name: "Pendiente", email: "pendiente@example.com", institution: "UNL", confirmedAt: null } });
    await logInAsAdmin(page);
    await openEditor(page, event);
    await page.getByRole("radio", { name: "Cuenta UNL" }).check();
    await page.getByRole("button", { name: "Publicar", exact: true }).click();

    await expect(question(page)).toHaveCount(0);
    await preview(page).getByRole("button", { name: "Sí, publicar" }).click();
    await expect(page.getByText(PUBLISHED_TEXT).first()).toBeVisible();
    expect((await eventRow(event)).registrationMode).toBe("unl");
  });

  test("the server does not take the change without the confirmation: a draft that saves by itself is refused with the question's words and stores nothing, and the button then asks", async ({ page }) => {
    const event = await seedWithPeople("borrador", { isPublished: false });

    await logInAsAdmin(page);
    await openEditor(page, event);
    await page.getByLabel("Cupos").fill("1");

    // The autosave sends the edit without the confirmation: the server refuses it.
    await expect(page.locator('[data-slot="autosave-status"]')).toContainText("Este evento ya tiene 3 inscritos.", { timeout: 15_000 });
    expect((await eventRow(event)).registrationCapacity).toBe(30);

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(question(page)).toContainText("Este evento ya tiene 3 inscritos.");
    expect((await eventRow(event)).registrationCapacity).toBe(30);

    await question(page).getByRole("button", { name: "Guardar el cambio" }).click();
    await expect(question(page)).toHaveCount(0);
    await expect.poll(async () => (await eventRow(event)).registrationCapacity).toBe(1);
    expect(await prisma.eventRegistration.count({ where: { eventId: event.id } })).toBe(5);
  });
});
