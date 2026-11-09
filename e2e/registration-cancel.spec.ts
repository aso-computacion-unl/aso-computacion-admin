import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SignJWT } from "jose";

import { FORUM_SESSION_SECRET as FORUM_SECRET, plantForumMemberSession } from "./support/forum-session";
import { cancellationLink, confirmationLink, waitForMail } from "./support/mail-sink";

/*
 * D7 (docs/JOURNEYS.md R2, R4, R6): a registered person says they cannot attend and the seat is freed.
 *   - Open form (R4): the confirmation email carries a second link that cancels the registration; pending or
 *     confirmed, the row is deleted, the seat is free again, and the link never confirms (nor the confirm link cancel).
 *   - UNL student (R2): the event page offers "Cancelar mi inscripción" to a registered member, with a question first.
 *   - Refusals (expired, tampered, foreign purpose, already cancelled, closed, draft, trashed) each leave the stored
 *     rows and the seat count exactly as they were.
 * The reminder's per-person link (R6) is a unit test: the cron needs CRON_SECRET, which `npm run e2e` blanks.
 *
 * Every event is seeded under a unique prefix and removed at the end; every address carries the run's stamp, because
 * the mail sink keeps everything the app sent during the whole run. The UNL half is opt-in like the other signed-in
 * specs (`FORUM_SESSION_SECRET=<32+ characters> npm run e2e`).
 */
const STAMP = Date.now().toString(36);
const PREFIX = `rc-${STAMP}-`;
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
const CONFIRM_SECRET = process.env.REGISTRATION_CONFIRM_SECRET ?? "";

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
  const title = `Cancelar ${name} ${STAMP}`;

  await prisma.event.create({
    data: { id: slug, slug, date: new Date("2099-11-28"), hora: "09:00 - 11:00", lugar: "Laboratorio 2", isPublished: true, registrationMode: "open", updatedAt: new Date(), ...overrides, title },
  });

  return { id: slug, slug, title };
}

const registrations = (event: Seeded) => prisma.eventRegistration.findMany({ where: { eventId: event.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const seatsTaken = (event: Seeded) => prisma.eventRegistration.count({ where: { eventId: event.id, confirmedAt: { not: null } } });

function register(request: APIRequestContext, slug: string, who: string, name = ANA.name) {
  return request.post(`/api/public/events/${slug}/registrations`, { data: { ...ANA, name, email: who, turnstileToken: "audit-token" }, headers: { "x-real-ip": nextIp() } });
}

const tokenOf = (link: string) => new URL(link, "http://127.0.0.1").searchParams.get("token")!;
const result = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

function cancelEndpoint(request: APIRequestContext, slug: string, token: string) {
  return request.post(`/api/public/events/${slug}/registrations/cancel`, { data: { token }, headers: { "x-real-ip": nextIp() } });
}

function confirmEndpoint(request: APIRequestContext, slug: string, token: string) {
  return request.post(`/api/public/events/${slug}/registrations/confirm`, { data: { token }, headers: { "x-real-ip": nextIp() } });
}

/** A token signed the way the app does, with the purpose and age the test needs (needs the app's secret). */
function signed(claims: { purpose: string; rid: string; eid: string; nce?: string }, { ageSeconds = 0, lifetimeSeconds = 365 * 24 * 3600 }: { ageSeconds?: number; lifetimeSeconds?: number } = {}) {
  const issued = Math.floor(Date.now() / 1000) - ageSeconds;

  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt(issued).setExpirationTime(issued + lifetimeSeconds).sign(new TextEncoder().encode(CONFIRM_SECRET));
}

/** Registers through the endpoint and confirms by the email link, as a person would: a seat is taken. Returns the cancel link and the confirm link. */
async function confirmedPerson(request: APIRequestContext, event: Seeded, who: string) {
  expect((await register(request, event.slug, who)).status()).toBe(201);

  const [mail] = await waitForMail(who);
  const confirm = confirmationLink(mail!);

  expect((await confirmEndpoint(request, event.slug, tokenOf(confirm))).status()).toBe(200);

  return { cancel: cancellationLink(mail!), confirm };
}

test.describe.configure({ timeout: 120_000 });

test.beforeAll(() => {
  expect(CONFIRM_SECRET, "run the suite with `npm run e2e`").not.toBe("");
});

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-real-ip": nextIp() });
});

test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.forumSession.deleteMany({ where: { memberId: { startsWith: PREFIX } } });
  await prisma.forumMember.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

test.describe("D7 (R4): cancelling with the link of the email", () => {
  test("a confirmed registration is cancelled by the button of the link: the row is deleted, the seat is free again, the others stay; opening the link alone cancels nothing", async ({ page, request }) => {
    const event = await seedEvent("abierto", { registrationCapacity: 5 });
    const ana = email("ana");
    const luis = email("luis");
    const anaLinks = await confirmedPerson(request, event, ana);

    await confirmedPerson(request, event, luis);

    const before = await registrations(event);

    expect(before).toHaveLength(2);
    expect(await seatsTaken(event)).toBe(2);

    // Opening the link (what a mail scanner does) shows the event and a button, and touches nothing.
    await page.goto(anaLinks.cancel, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: event.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toBeVisible();
    await expect(page.getByText("Quedan 3 cupos")).toBeVisible();
    expect(await registrations(event)).toEqual(before);

    await page.getByRole("button", { name: "Cancelar mi inscripción" }).click();
    await expect(result(page, "Su inscripción quedó cancelada")).toBeVisible();
    await expect(result(page, "Su inscripción quedó cancelada")).toContainText("Liberamos su cupo");
    await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toHaveCount(0);

    // The row is gone, the other registration is exactly as it was, and the seat shows free on the event's page.
    const after = await registrations(event);

    expect(after).toEqual(before.filter((row) => row.email === luis));
    expect(await seatsTaken(event)).toBe(1);
    await page.goto(`/inscripciones/${event.slug}`);
    await expect(page.getByText("Quedan 4 cupos")).toBeVisible();

    // The same link again: already cancelled, nothing else changes.
    await page.goto(anaLinks.cancel, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Cancelar mi inscripción" }).click();
    await expect(result(page, "Su inscripción ya estaba cancelada")).toBeVisible();
    expect(await registrations(event)).toEqual(after);
    expect(await seatsTaken(event)).toBe(1);

    // Its confirm link finds nothing to confirm: the registration is gone, not re-created.
    await page.goto(anaLinks.confirm, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Confirmar mi cupo" }).click();
    await expect(result(page, "Este enlace no sirve")).toBeVisible();
    expect(await registrations(event)).toEqual(after);
  });

  test("the freed seat goes to the next person on a full event", async ({ request }) => {
    const event = await seedEvent("lleno", { registrationCapacity: 1 });
    const ana = email("lleno-ana");
    const luis = email("lleno-luis");
    const links = await confirmedPerson(request, event, ana);

    const full = await register(request, event.slug, luis);

    expect(full.status()).toBe(409);
    expect(await full.json()).toEqual({ error: "full" });
    expect((await cancelEndpoint(request, event.slug, tokenOf(links.cancel))).status()).toBe(200);
    expect((await register(request, event.slug, luis)).status()).toBe(201);
    expect((await registrations(event)).map((row) => row.email)).toEqual([luis]);
  });

  test("a pending registration is cancelled from its confirmation email too: its data goes and its confirm link stops working", async ({ page, request }) => {
    const event = await seedEvent("pendiente", { registrationCapacity: 5 });
    const who = email("pendiente");

    expect((await register(request, event.slug, who)).status()).toBe(201);

    const [mail] = await waitForMail(who);
    const links = { cancel: cancellationLink(mail!), confirm: confirmationLink(mail!) };

    expect(links.cancel).not.toBe(links.confirm);
    expect(await registrations(event)).toMatchObject([{ email: who, confirmedAt: null }]);

    await page.goto(links.cancel, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Cancelar mi inscripción" }).click();
    await expect(result(page, "Su inscripción quedó cancelada")).toBeVisible();
    expect(await registrations(event)).toEqual([]);

    const confirmed = await confirmEndpoint(request, event.slug, tokenOf(links.confirm));

    expect(confirmed.status()).toBe(400);
    expect(await confirmed.json()).toEqual({ error: "invalid" });
    expect(await registrations(event)).toEqual([]);
  });

  test("the confirmation email carries both links, distinct, each on its own page", async ({ request }) => {
    const event = await seedEvent("doslinks", { registrationCapacity: 5 });
    const who = email("doslinks");

    expect((await register(request, event.slug, who)).status()).toBe(201);

    const [mail] = await waitForMail(who);

    expect(mail!.text).toContain("cancele su inscripción");
    expect(mail!.html).toContain("/cancelar?token=");
    expect(cancellationLink(mail!)).toMatch(new RegExp(`^/inscripciones/${event.slug}/cancelar\\?token=`));
    expect(confirmationLink(mail!)).toMatch(new RegExp(`^/inscripciones/${event.slug}/confirmar\\?token=`));
  });
});

test.describe("D7 (R4): every refusal leaves the rows and the seats as they were", () => {
  test("a tampered link, a link of another purpose and an expired one are refused on the page and on the endpoint", async ({ page, request }) => {
    const event = await seedEvent("rechazos", { registrationCapacity: 5 });
    const who = email("rechazos");
    const links = await confirmedPerson(request, event, who);
    const [row] = await registrations(event);
    const before = await registrations(event);
    const cancelToken = tokenOf(links.cancel);
    const confirmToken = tokenOf(links.confirm);
    const expired = await signed({ purpose: "registration-cancel", rid: row!.id, eid: event.id }, { ageSeconds: 366 * 24 * 3600, lifetimeSeconds: 365 * 24 * 3600 });
    const foreignSecret = await new SignJWT({ purpose: "registration-cancel", rid: row!.id, eid: event.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1y")
      .sign(new TextEncoder().encode("another-secret-another-secret-another-secret"));

    const refused: [string, string, number, string][] = [
      ["tampered", `${cancelToken.slice(0, -3)}abc`, 400, "invalid"],
      ["the confirmation token of the same registration", confirmToken, 400, "invalid"],
      ["a token signed with another secret", foreignSecret, 400, "invalid"],
      ["garbage", "not-a-token", 400, "invalid"],
      ["expired", expired, 410, "expired"],
    ];

    for (const [label, token, status, error] of refused) {
      const response = await cancelEndpoint(request, event.slug, token);

      expect(response.status(), label).toBe(status);
      expect(await response.json(), label).toEqual({ error });
      expect(await registrations(event), label).toEqual(before);
      expect(await seatsTaken(event), label).toBe(1);
    }

    // The same on the page: no button for a link that cannot work.
    await page.goto(`/inscripciones/${event.slug}/cancelar?token=${confirmToken}`);
    await expect(page.getByText("Este enlace no sirve")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toHaveCount(0);
    await page.goto(`/inscripciones/${event.slug}/cancelar?token=${expired}`);
    await expect(page.getByText("Este enlace venció")).toBeVisible();
    await expect(page.getByText("directiva de ASO")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toHaveCount(0);
    await page.goto(`/inscripciones/${event.slug}/cancelar`);
    await expect(page.getByText("Este enlace no sirve")).toBeVisible();
    expect(await registrations(event)).toEqual(before);
  });

  test("a cancellation token never confirms a pending registration", async ({ request }) => {
    const event = await seedEvent("noconfirma", { registrationCapacity: 5 });
    const who = email("noconfirma");

    expect((await register(request, event.slug, who)).status()).toBe(201);

    const [mail] = await waitForMail(who);
    const before = await registrations(event);
    const response = await confirmEndpoint(request, event.slug, tokenOf(cancellationLink(mail!)));

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
    expect(await registrations(event)).toEqual(before);
    expect(before[0]!.confirmedAt).toBeNull();
  });

  test("a link used on another event's page cancels nothing, and a link for a registration that is not there says it was already cancelled", async ({ request }) => {
    const event = await seedEvent("propio", { registrationCapacity: 5 });
    const other = await seedEvent("ajeno", { registrationCapacity: 5 });
    const mine = await confirmedPerson(request, event, email("propio"));
    const theirs = await confirmedPerson(request, other, email("ajeno"));
    const beforeMine = await registrations(event);
    const beforeTheirs = await registrations(other);

    const crossed = await cancelEndpoint(request, other.slug, tokenOf(mine.cancel));

    expect(crossed.status()).toBe(400);
    expect(await crossed.json()).toEqual({ error: "invalid" });

    const [row] = await registrations(event);
    const ghost = await signed({ purpose: "registration-cancel", rid: "no-such-registration", eid: event.id });
    const missing = await cancelEndpoint(request, event.slug, ghost);

    expect(missing.status()).toBe(200);
    expect(await missing.json()).toEqual({ ok: true, status: "already_cancelled" });
    expect(row).toBeDefined();
    expect(await registrations(event)).toEqual(beforeMine);
    expect(await registrations(other)).toEqual(beforeTheirs);
    expect(theirs.cancel).not.toBe(mine.cancel);
  });

  const GONE: [string, Partial<Prisma.EventUncheckedCreateInput>, number, string][] = [
    ["its registration deadline passed", { registrationDeadline: new Date(Date.now() - 60_000) }, 409, "closed"],
    ["its day is over", { date: new Date("2020-01-15") }, 409, "closed"],
    ["it was unpublished", { isPublished: false }, 404, "not_found"],
    ["it was moved to the trash", { deletedAt: new Date() }, 404, "not_found"],
  ];

  for (const [index, [label, change, status, error]] of GONE.entries()) {
    test(`refuses (${status} ${error}) when ${label}, leaving the registration and its seat`, async ({ page, request }) => {
      const event = await seedEvent(`fin${index}`, { registrationCapacity: 5 });
      const links = await confirmedPerson(request, event, email(`fin${index}`));
      const before = await registrations(event);

      await prisma.event.update({ where: { id: event.id }, data: change });

      const refused = await cancelEndpoint(request, event.slug, tokenOf(links.cancel));

      expect(refused.status()).toBe(status);
      expect(await refused.json()).toEqual({ error });
      expect(await registrations(event)).toEqual(before);
      expect(await seatsTaken(event)).toBe(1);

      // The page does not offer a button that can only be refused.
      const response = await page.goto(links.cancel, { waitUntil: "networkidle" });

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toHaveCount(0);
      await expect(page.getByText(status === 409 ? "Las inscripciones de este evento ya cerraron" : "Este evento ya no está disponible").first()).toBeVisible();
      expect(await registrations(event)).toEqual(before);
    });
  }

  test("a bad link for an event that does not exist is a 404: nothing says the event was ever there", async ({ request }) => {
    expect((await request.get("/inscripciones/no-existe-nunca/cancelar?token=basura")).status()).toBe(404);
  });
});

test.describe("D7 (R2): a UNL student cancels from the event page", () => {
  test.skip(!FORUM_SECRET, "set FORUM_SESSION_SECRET to plant a forum member session");

  test("asks first, keeps the registration when told to, and deletes only their own when confirmed; the seat shows free and the others stay", async ({ page, context }) => {
    const event = await seedEvent("unl", { registrationMode: "unl", registrationCapacity: 3 });
    const ana = await plantForumMemberSession(prisma, { memberId: `${PREFIX}ana`, sessionId: `${PREFIX}ana-s`, displayName: "Ana Cancela" });
    const luis = await plantForumMemberSession(prisma, { memberId: `${PREFIX}luis`, sessionId: `${PREFIX}luis-s`, displayName: "Luis Se Queda" });

    await prisma.eventRegistration.createMany({
      data: [
        { id: `${PREFIX}ra`, eventId: event.id, mode: "unl", name: "Ana Cancela", email: ana.email, confirmedAt: new Date(), createdAt: new Date(Date.now() - 2000) },
        { id: `${PREFIX}rl`, eventId: event.id, mode: "unl", name: "Luis Se Queda", email: luis.email, confirmedAt: new Date(), createdAt: new Date(Date.now() - 1000) },
      ],
    });

    const before = await registrations(event);

    await context.addCookies([ana.cookie]);
    await page.goto(`/inscripciones/${event.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Usted ya está inscrito en este evento.")).toBeVisible();
    await expect(page.getByText("Queda 1 cupo")).toBeVisible();

    // The first press only asks.
    await page.getByRole("button", { name: "Cancelar mi inscripción" }).click();
    await expect(page.getByText("Se liberará su cupo")).toBeVisible();
    expect(await registrations(event)).toEqual(before);

    // Keeping it leaves everything as it was.
    await page.getByRole("button", { name: "No, conservarla" }).click();
    await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toBeVisible();
    expect(await registrations(event)).toEqual(before);

    await page.getByRole("button", { name: "Cancelar mi inscripción" }).click();
    await page.getByRole("button", { name: "Sí, cancelar mi inscripción" }).click();

    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toBeVisible();
    await expect(page.getByText("Quedan 2 cupos")).toBeVisible();
    expect(await registrations(event)).toEqual(before.filter((row) => row.email === luis.email));
    expect(await seatsTaken(event)).toBe(1);

    // They can reserve again: the seat was theirs to let go.
    await page.getByRole("button", { name: "Reservar mi cupo" }).click();
    await expect(page.getByText("Usted ya está inscrito en este evento.")).toBeVisible();
    expect((await registrations(event)).map((row) => row.email).sort()).toEqual([ana.email, luis.email].sort());
  });

  test("a member who is not registered is not offered the cancel button, and cannot reach another member's registration", async ({ page, context }) => {
    const event = await seedEvent("unlajeno", { registrationMode: "unl", registrationCapacity: 3 });
    const ana = await plantForumMemberSession(prisma, { memberId: `${PREFIX}ana2`, sessionId: `${PREFIX}ana2-s`, displayName: "Ana Inscrita" });
    const eva = await plantForumMemberSession(prisma, { memberId: `${PREFIX}eva`, sessionId: `${PREFIX}eva-s`, displayName: "Eva Sin Cupo" });

    await prisma.eventRegistration.create({ data: { id: `${PREFIX}ra2`, eventId: event.id, mode: "unl", name: "Ana Inscrita", email: ana.email, confirmedAt: new Date() } });

    const before = await registrations(event);

    await context.addCookies([eva.cookie]);
    await page.goto(`/inscripciones/${event.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Reservar mi cupo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toHaveCount(0);
    expect(await registrations(event)).toEqual(before);
  });

  test("once registration closed the page says to write to the board instead of offering a cancel that would be refused", async ({ page, context }) => {
    const event = await seedEvent("unlcerrado", { registrationMode: "unl", registrationCapacity: 3, registrationDeadline: new Date(Date.now() - 60_000) });
    const ana = await plantForumMemberSession(prisma, { memberId: `${PREFIX}ana3`, sessionId: `${PREFIX}ana3-s`, displayName: "Ana Tarde" });

    await prisma.eventRegistration.create({ data: { id: `${PREFIX}ra3`, eventId: event.id, mode: "unl", name: "Ana Tarde", email: ana.email, confirmedAt: new Date() } });

    const before = await registrations(event);

    await context.addCookies([ana.cookie]);
    await page.goto(`/inscripciones/${event.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Usted ya está inscrito en este evento.")).toBeVisible();
    await expect(page.getByText("directiva de ASO")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar mi inscripción" })).toHaveCount(0);
    expect(await registrations(event)).toEqual(before);
  });

  test("an expired session asks to sign in again, in registration words, and deletes nothing", async ({ page, context }) => {
    const event = await seedEvent("unlsesion", { registrationMode: "unl", registrationCapacity: 3 });
    const ana = await plantForumMemberSession(prisma, { memberId: `${PREFIX}ana4`, sessionId: `${PREFIX}ana4-s`, displayName: "Ana Sesión" });

    await prisma.eventRegistration.create({ data: { id: `${PREFIX}ra4`, eventId: event.id, mode: "unl", name: "Ana Sesión", email: ana.email, confirmedAt: new Date() } });

    const before = await registrations(event);

    await context.addCookies([ana.cookie]);
    await page.goto(`/inscripciones/${event.slug}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Cancelar mi inscripción" }).click();

    // The session ends while the question is open.
    await prisma.forumSession.update({ where: { id: ana.sessionId }, data: { revokedAt: new Date() } });
    await page.getByRole("button", { name: "Sí, cancelar mi inscripción" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Su sesión terminó" })).toHaveText("Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para cancelar su inscripción.");
    expect(await page.locator("body").innerText()).not.toMatch(/foro/i);
    expect(await registrations(event)).toEqual(before);
  });
});
