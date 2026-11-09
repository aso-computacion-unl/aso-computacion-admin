import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";

/*
 * R5 (docs/JOURNEYS.md): every answer of the confirm page, as the person sees it after pressing «Confirmar mi cupo».
 * audit-registration.spec.ts and registration-rules.spec.ts cover the happy path, the already-confirmed link and the
 * links that "no sirven"; this one covers what is left of the R5 table: the seats gone or the registration closed
 * between opening the link and pressing the button, the link or the row older than 48 h, the rate limit (the real one),
 * and a service or a network that fails (played with a stubbed answer: the server cannot be made to fail on demand).
 * Each refusal leaves the registration pending, and the person can press again after a failure that is worth retrying.
 *
 * The token is signed here with the secret the harness gave the app, the way audit-registration.spec.ts does. Events and
 * registrations are seeded under the `rc-` prefix and removed at the end.
 */
const CONFIRM_SECRET = process.env.REGISTRATION_CONFIRM_SECRET ?? "";
const STAMP = Date.now().toString(36);
const PREFIX = `rc-${STAMP}-`;
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
const CONFIRM_ENDPOINT = "**/api/public/events/*/registrations/confirm";
const HOUR_MS = 3_600_000;

const octet = () => 20 + Math.floor(Math.random() * 200);
const subnet = `10.${octet()}.${octet()}`;
let addresses = 0;
const nextIp = () => `${subnet}.${++addresses}`;

interface Seeded {
  id: string;
  slug: string;
}

async function seedEvent(name: string, overrides: Partial<Prisma.EventUncheckedCreateInput> = {}): Promise<Seeded> {
  const slug = `${PREFIX}${name}`;

  await prisma.event.create({
    data: { id: slug, slug, title: `Confirmar ${name} ${STAMP}`, date: new Date("2099-11-28"), hora: "09:00 - 11:00", lugar: "Laboratorio 2", isPublished: true, registrationMode: "open", updatedAt: new Date(), ...overrides },
  });

  return { id: slug, slug };
}

/** A pending registration, as if the person had sent the form, and the token its email would carry. */
async function pendingPerson(event: Seeded, who: string, overrides: Partial<Prisma.EventRegistrationUncheckedCreateInput> = {}) {
  const row = await prisma.eventRegistration.create({ data: { id: `${event.id}-${who}`, eventId: event.id, mode: "open", name: "Ana Pérez", email: `${who}-${STAMP}@example.com`, institution: "UNL", ...overrides } });

  return { row, token: await signToken(row.id, event.id) };
}

function signToken(registrationId: string, eventId: string, { issuedHoursAgo = 0, lifetimeHours = 48 } = {}) {
  const issued = Math.floor((Date.now() - issuedHoursAgo * HOUR_MS) / 1000);

  return new SignJWT({ purpose: "registration-confirm", rid: registrationId, eid: eventId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issued)
    .setExpirationTime(issued + lifetimeHours * 3600)
    .sign(new TextEncoder().encode(CONFIRM_SECRET));
}

const row = (id: string) => prisma.eventRegistration.findUniqueOrThrow({ where: { id } });
const result = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const confirmButton = (page: Page) => page.getByRole("button", { name: "Confirmar mi cupo" });

/** Opens the link of the email and waits until the page is hydrated, so the button does something when pressed. */
async function openLink(page: Page, event: Seeded, token: string) {
  await page.goto(`/inscripciones/${event.slug}/confirmar?token=${token}`, { waitUntil: "networkidle" });
  await expect(confirmButton(page)).toBeVisible();
}

test.describe.configure({ timeout: 90_000 });

test.skip(!CONFIRM_SECRET, "needs REGISTRATION_CONFIRM_SECRET in the test environment to sign the links");

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-real-ip": nextIp() });
});

test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

test("the last seat taken while the person had the link open: «Cupos agotados», and the registration stays pending", async ({ page }) => {
  const event = await seedEvent("agotado", { registrationCapacity: 1 });
  const { row: pending, token } = await pendingPerson(event, "tarde");

  await openLink(page, event, token);
  await expect(page.getByText("Queda 1 cupo")).toBeVisible();

  // Somebody else confirms the only seat after the page was loaded.
  await prisma.eventRegistration.create({ data: { id: `${event.id}-primero`, eventId: event.id, mode: "open", name: "Luis Mora", email: `primero-${STAMP}@example.com`, institution: "UNL", confirmedAt: new Date() } });

  await confirmButton(page).click();
  // The ticket behind may say «Cupos agotados» too, so the answer is found by its own sentence.
  const answer = result(page, "Mientras usted confirmaba");

  await expect(answer).toContainText("Cupos agotados");
  await expect(answer).toContainText("los cupos de este evento se agotaron y no pudimos reservarle uno");
  await expect(answer).toBeFocused();
  await expect(confirmButton(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Añadir al calendario" })).toHaveCount(0);
  expect((await row(pending.id)).confirmedAt).toBeNull();
  // The ticket behind the message was refreshed with the real count.
  await expect(page.getByText("Queda 1 cupo")).toHaveCount(0);
});

test("registration closed while the person had the link open: «Las inscripciones cerraron», and the registration stays pending", async ({ page }) => {
  const event = await seedEvent("cerrado", { registrationCapacity: 5 });
  const { row: pending, token } = await pendingPerson(event, "cierre");

  await openLink(page, event, token);
  await prisma.event.update({ where: { id: event.id }, data: { registrationDeadline: new Date(Date.now() - HOUR_MS) } });

  await confirmButton(page).click();
  await expect(result(page, "cerraron antes de que usted confirmara")).toContainText("Las inscripciones cerraron");
  await expect(confirmButton(page)).toHaveCount(0);
  expect((await row(pending.id)).confirmedAt).toBeNull();
});

test("a link older than 48 hours says it expired and offers the way back to the form; the endpoint answers 410", async ({ page, request }) => {
  const event = await seedEvent("vencido", { registrationCapacity: 5 });
  const { row: pending } = await pendingPerson(event, "viejo");
  const old = await signToken(pending.id, event.id, { issuedHoursAgo: 50 });

  await page.goto(`/inscripciones/${event.slug}/confirmar?token=${old}`);
  await expect(result(page, "Este enlace venció")).toContainText("El enlace vale 48 horas");
  await expect(page.getByRole("link", { name: "Volver al formulario" })).toHaveAttribute("href", `/inscripciones/${event.slug}`);
  await expect(confirmButton(page)).toHaveCount(0);

  const answer = await request.post(`/api/public/events/${event.slug}/registrations/confirm`, { data: { token: old }, headers: { "x-real-ip": nextIp() } });

  expect(answer.status()).toBe(410);
  expect(await answer.json()).toEqual({ error: "expired" });
  expect((await row(pending.id)).confirmedAt).toBeNull();
});

test("a fresh link for a registration sent more than 48 hours ago is refused when the button is pressed, and nothing is confirmed", async ({ page }) => {
  const event = await seedEvent("filaantigua", { registrationCapacity: 5 });
  const { row: pending, token } = await pendingPerson(event, "antigua", { createdAt: new Date(Date.now() - 49 * HOUR_MS) });

  await openLink(page, event, token);
  await confirmButton(page).click();
  await expect(result(page, "Este enlace venció")).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver al formulario" })).toHaveAttribute("href", `/inscripciones/${event.slug}`);
  expect((await row(pending.id)).confirmedAt).toBeNull();
});

test("after five attempts from one address the sixth press is held back with the wait, the button stays, and nothing is confirmed", async ({ page, request }) => {
  const event = await seedEvent("limite", { registrationCapacity: 5 });
  const { row: pending, token } = await pendingPerson(event, "impaciente");
  const ip = nextIp();

  await page.context().setExtraHTTPHeaders({ "x-real-ip": ip });
  await openLink(page, event, token);

  // Five attempts with a made-up token use the address's whole budget of this endpoint.
  for (let attempt = 0; attempt < 5; attempt++) {
    expect((await request.post(`/api/public/events/${event.slug}/registrations/confirm`, { data: { token: "basura" }, headers: { "x-real-ip": ip } })).status()).toBe(400);
  }

  await confirmButton(page).click();
  const alert = page.getByRole("alert").filter({ hasText: "Demasiados intentos." });

  await expect(alert).toContainText(/Espere (9|10) minutos antes de intentarlo de nuevo\./);
  await expect(confirmButton(page)).toBeVisible();
  expect((await row(pending.id)).confirmedAt).toBeNull();
});

test("a service that is down and a network that fails are told apart from a refusal, keep the button, and a later press confirms", async ({ page }) => {
  const event = await seedEvent("falla", { registrationCapacity: 5 });
  const { row: pending, token } = await pendingPerson(event, "reintento");

  await openLink(page, event, token);

  await page.route(CONFIRM_ENDPOINT, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) }), { times: 1 });
  await confirmButton(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos confirmar su cupo." })).toContainText("El servicio no está disponible en este momento. Inténtelo de nuevo en unos minutos.");
  await expect(confirmButton(page)).toBeEnabled();

  await page.route(CONFIRM_ENDPOINT, (route) => route.abort("connectionrefused"), { times: 1 });
  await confirmButton(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Revise su conexión e inténtelo de nuevo." })).toBeVisible();
  await expect(confirmButton(page)).toBeEnabled();
  expect((await row(pending.id)).confirmedAt).toBeNull();

  // The same link, pressed once the service is back, takes the seat.
  await confirmButton(page).click();
  await expect(result(page, "Listo, su cupo está reservado")).toBeFocused();
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos confirmar su cupo." })).toHaveCount(0);
  expect((await row(pending.id)).confirmedAt).not.toBeNull();
});
