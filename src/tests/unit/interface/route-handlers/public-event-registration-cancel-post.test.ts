import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reportErrorMock, cookiesMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn(), cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));

import { REGISTRATION_CANCEL_TTL_MS } from "@/domain/event-registration";
import { REGISTRATION_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/registration-rate-limiter";
import { sealRegistrationCancelToken } from "@/infrastructure/registration/registration-cancel-token";
import { sealRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";
import { testAuth } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

import * as routeModule from "../../../../../app/api/public/events/[slug]/registrations/cancel/route";
import { POST as confirmPost } from "../../../../../app/api/public/events/[slug]/registrations/confirm/route";

/*
 * D7 (R2, R4, R6): POST /api/public/events/[slug]/registrations/cancel is what the button of the cancellation page
 * sends. Every refusal is checked against the stored rows and the seats: nothing changes.
 */
const { POST } = routeModule;
const SECRET = "r".repeat(40);
const NOW = new Date("2099-11-20T15:00:00.000Z");
const HOUR = 3_600_000;

let sequence = 0;
let event: Awaited<ReturnType<typeof addTestEvent>>;

function post(body: unknown, { slug = "taller-de-git", ip, headers = {} }: { slug?: string; ip?: string; headers?: Record<string, string> } = {}, handler: typeof POST = POST) {
  sequence += 1;

  const request = new NextRequest(`https://admin.test/api/public/events/${slug}/registrations/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip ?? `203.0.113.${sequence % 250}-${sequence}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  return handler(request, { params: Promise.resolve({ slug }) });
}

/** A registration stored `ageMs` before NOW (confirmed unless pending), and the cancellation token its email would carry. */
async function registered(overrides: { eventId?: string; email?: string; pending?: boolean } = {}) {
  const eventId = overrides.eventId ?? event.id;
  const id = `reg-${(sequence += 1)}`;

  await testEventRegistration.registrations.register(
    { id, eventId, mode: "open", name: "Ana Pérez", email: overrides.email ?? "ana@example.com", institution: "UNL", career: null, semester: null, confirmedAt: overrides.pending ? null : NOW },
    NOW,
  );

  return { id, token: await sealRegistrationCancelToken({ registrationId: id, eventId }, NOW) };
}

/** A row stored straight, bypassing the rules (an event that closed or went private after the email went out). */
async function seeded(eventId: string) {
  const id = `seed-${(sequence += 1)}`;

  testEventRegistration.registrations.seed({ id, eventId, mode: "open", name: "Ana Pérez", email: "ana@example.com", institution: "UNL", career: null, semester: null, createdAt: NOW, confirmedAt: NOW });

  return { id, token: await sealRegistrationCancelToken({ registrationId: id, eventId }, NOW) };
}

const rows = () => testEventRegistration.registrations.all();
const seats = () => testEventRegistration.registrations.count(event.id);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", SECRET);
  event = await addTestEvent({ date: "2099-11-28", registrationCapacity: 3 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/public/events/[slug]/registrations/cancel", () => {
  it("deletes the registration and frees its seat, answers 200, needs no cookie and is never cached", async () => {
    const ana = await registered();
    const luis = await registered({ email: "luis@example.com" });

    expect(await seats()).toBe(2);

    const response = await post({ token: ana.token });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "cancelled" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(rows().map((row) => row.id)).toEqual([luis.id]);
    expect(await seats()).toBe(1);
  });

  it("deletes a pending registration too", async () => {
    const pending = await registered({ pending: true });

    expect((await post({ token: pending.token })).status).toBe(200);
    expect(rows()).toEqual([]);
  });

  it("answers 200 already_cancelled the second time and changes nothing", async () => {
    const ana = await registered();
    const luis = await registered({ email: "luis@example.com" });

    await post({ token: ana.token });
    const before = rows();
    const again = await post({ token: ana.token });

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, status: "already_cancelled" });
    expect(rows()).toEqual(before);
    expect(before.map((row) => row.id)).toEqual([luis.id]);
    expect(await seats()).toBe(1);
  });

  it("is not a GET: a mail scanner that prefetches the link cancels nothing", async () => {
    const ana = await registered();

    expect("GET" in routeModule).toBe(false);
    expect("HEAD" in routeModule).toBe(false);
    expect(rows()).toHaveLength(1);
    expect(ana.token).toBeTruthy();
  });

  it("answers 410 expired for a link older than a year, however good its signature, and deletes nothing", async () => {
    const ana = await registered();
    const before = rows();

    vi.setSystemTime(new Date(NOW.getTime() + REGISTRATION_CANCEL_TTL_MS + HOUR));

    const response = await post({ token: ana.token });

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "expired" });
    expect(rows()).toEqual(before);
    expect(await seats()).toBe(1);
  });

  it("answers 400 invalid for a tampered token, a token of another secret, a made-up registration and a link used on another event's page, deleting nothing", async () => {
    const ana = await registered();
    const other = await addTestEvent({ title: "Otro evento" });
    const ghost = await sealRegistrationCancelToken({ registrationId: "ghost", eventId: event.id }, NOW);
    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "x".repeat(40));
    const forged = await sealRegistrationCancelToken({ registrationId: ana.id, eventId: event.id }, NOW);
    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", SECRET);
    const before = rows();

    const attempts: [string, Response][] = [
      ["tampered", await post({ token: ana.token.slice(0, -2) + "xx" })],
      ["another secret", await post({ token: forged })],
      ["other event's page", await post({ token: ana.token }, { slug: "otro-evento" })],
    ];

    for (const [label, response] of attempts) {
      expect(response.status, label).toBe(400);
      expect(await response.json(), label).toEqual({ error: "invalid" });
    }

    // A token that is ours for a registration that does not exist is just "already cancelled": it says nothing about anyone else.
    const unknown = await post({ token: ghost });

    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual({ ok: true, status: "already_cancelled" });
    expect(other.id).not.toBe(event.id);
    expect(rows()).toEqual(before);
    expect(await seats()).toBe(1);
  });

  it("does not take a confirmation token (or a forum or admin one), and the confirm endpoint does not take a cancellation token", async () => {
    const pending = await registered({ pending: true });
    const confirmToken = await sealRegistrationConfirmToken({ registrationId: pending.id, eventId: event.id }, NOW);
    const before = rows();

    const wrong = await post({ token: confirmToken });

    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({ error: "invalid" });
    expect(rows()).toEqual(before);

    const confirm = await post({ token: pending.token }, {}, confirmPost);

    expect(confirm.status).toBe(400);
    expect(await confirm.json()).toEqual({ error: "invalid" });
    expect(rows()).toEqual(before);
    expect(rows()[0]!.confirmedAt).toBeNull();
  });

  it.each([
    ["no token", {}],
    ["an empty token", { token: "" }],
    ["a number", { token: 7 }],
    ["garbage", { token: "not-a-token" }],
  ])("answers 400 invalid for %s and changes nothing", async (_label, body) => {
    await registered();
    const before = rows();

    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
    expect(rows()).toEqual(before);
  });

  it("answers 409 closed after the deadline (and once the event day is over), and the registration and the seat stay", async () => {
    const closing = await addTestEvent({ title: "Cierra", registrationDeadline: new Date(NOW.getTime() - HOUR) });
    const past = await addTestEvent({ title: "Pasado", date: "2099-11-10" });
    const a = await seeded(closing.id);
    const b = await seeded(past.id);
    const before = rows();

    for (const [slug, link] of [["cierra", a], ["pasado", b]] as const) {
      const response = await post({ token: link.token }, { slug });

      expect(response.status, slug).toBe(409);
      expect(await response.json(), slug).toEqual({ error: "closed" });
    }

    expect(rows()).toEqual(before);
    expect(await testEventRegistration.registrations.count(closing.id)).toBe(1);
  });

  it("answers 404 for an event that is unknown, not a slug, a draft or in the trash, and the registration stays", async () => {
    const draft = await addTestEvent({ title: "Borrador", isPublished: false });
    const trashed = await addTestEvent({ title: "Papelera" });
    const ana = await registered();
    const hiddenDraft = await seeded(draft.id);
    const hiddenTrashed = await seeded(trashed.id);

    await testEventRegistration.events.trash(trashed.id);

    const before = rows();

    for (const [slug, token] of [["nada", ana.token], ["NOT A SLUG!", ana.token], ["borrador", hiddenDraft.token], ["papelera", hiddenTrashed.token]] as const) {
      const response = await post({ token }, { slug });

      expect(response.status, slug).toBe(404);
      expect(await response.json(), slug).toEqual({ error: "not_found" });
    }

    expect(rows()).toEqual(before);
  });

  it("still cancels after the event switched to another registration mode", async () => {
    const ana = await registered();
    const live = (await testEventRegistration.events.getById(event.id))!;

    await testEventRegistration.events.update(live.update({ registrationMode: "unl" }));

    expect((await post({ token: ana.token })).status).toBe(200);
    expect(rows()).toEqual([]);
  });

  it("answers 413 to a body that is too big, 415 to anything but JSON and 400 to malformed JSON", async () => {
    await registered();

    expect((await post({ token: "x".repeat(10_000) })).status).toBe(413);
    expect((await post(JSON.stringify({ token: "x" }), { headers: { "content-type": "text/plain" } })).status).toBe(415);
    expect((await post("{not json")).status).toBe(400);
    expect((await post("[1]")).status).toBe(400);
    expect(rows()).toHaveLength(1);
  });

  it("answers 429 with Retry-After once a client spends its attempts, before reading the token, and deletes nothing", async () => {
    const ana = await registered();
    const ip = "198.51.100.77";

    for (let attempt = 0; attempt < REGISTRATION_RATE_LIMIT_MAX_REQUESTS; attempt += 1) {
      await post({ token: "garbage" }, { ip });
    }

    const limited = await post({ token: ana.token }, { ip });

    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect(rows()).toHaveLength(1);
  });

  it("does not leak internals when something unexpected fails, and deletes nothing", async () => {
    const ana = await registered();

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(testEventRegistration.registrations, "cancel").mockRejectedValue(new Error("connection string postgres://secret"));

    const response = await post({ token: ana.token });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), { route: "public-event-registration-cancel" });
    expect(JSON.stringify(reportErrorMock.mock.calls)).not.toContain("secret");
    expect(rows()).toHaveLength(1);
  });

  it("S3: answers 503 unavailable, deleting nothing, while the link secret is not usable (the link is not the problem)", async () => {
    const ana = await registered();

    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "");

    const response = await post({ token: ana.token });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(rows()).toHaveLength(1);
  });
});

/*
 * D7 (T10b): a self-cancellation leaves one audit entry with no personal data, like the admin delete. The person is not
 * an admin, so the actor is the system; the summary says the person cancelled it and through which channel.
 */
describe("POST /api/public/events/[slug]/registrations/cancel: audit", () => {
  const entries = () => testAuth.audit.entries;

  it("writes one entry for the cancelled event, by the system, saying the person cancelled it by the email link", async () => {
    const ana = await registered();

    expect((await post({ token: ana.token })).status).toBe(200);
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toEqual({
      id: expect.any(String),
      at: NOW,
      actorUserId: null,
      actorKind: "system",
      action: "event.registration_cancel",
      entityType: "event",
      entityId: event.id,
      summary: "Inscripción cancelada por la persona (enlace del correo)",
    });
  });

  it("holds nothing that maps back to the person: no name, email, registration id or token, pending or confirmed", async () => {
    const confirmed = await registered();
    const pending = await registered({ email: "luis@example.com", pending: true });

    await post({ token: confirmed.token });
    await post({ token: pending.token });

    expect(entries()).toHaveLength(2);

    const written = JSON.stringify(entries());

    for (const secret of ["Ana", "Pérez", "ana@example.com", "luis@example.com", "example.com", confirmed.id, pending.id, confirmed.token, pending.token]) {
      expect(written, secret).not.toContain(secret);
    }
  });

  it("writes nothing the second time (already cancelled), and nothing for any refusal; rows and seats stay", async () => {
    const ana = await registered();
    const closing = await addTestEvent({ title: "Cierra", registrationDeadline: new Date(NOW.getTime() - HOUR) });
    const draft = await addTestEvent({ title: "Borrador", isPublished: false });
    const closed = await seeded(closing.id);
    const hidden = await seeded(draft.id);

    await post({ token: ana.token });
    testAuth.audit.entries.length = 0;

    const before = rows();
    const seatsBefore = await seats();
    const confirmToken = await sealRegistrationConfirmToken({ registrationId: ana.id, eventId: event.id }, NOW);

    const attempts: [string, Response][] = [
      ["already cancelled", await post({ token: ana.token })],
      ["closed", await post({ token: closed.token }, { slug: "cierra" })],
      ["draft", await post({ token: hidden.token }, { slug: "borrador" })],
      ["another purpose", await post({ token: confirmToken })],
      ["tampered", await post({ token: `${ana.token.slice(0, -2)}xx` })],
      ["no token", await post({})],
      ["other event's page", await post({ token: ana.token }, { slug: "cierra" })],
    ];

    for (const [label, response] of attempts) {
      expect(response.status, label).not.toBe(500);
    }

    expect(entries()).toEqual([]);
    expect(rows().filter((row) => row.eventId === event.id)).toEqual(before.filter((row) => row.eventId === event.id));
    expect(await seats()).toBe(seatsBefore);
    expect(rows().map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
  });

  it("writes nothing for an expired link or a rate-limited client", async () => {
    const ana = await registered();
    const ip = "198.51.100.88";

    for (let attempt = 0; attempt < REGISTRATION_RATE_LIMIT_MAX_REQUESTS; attempt += 1) {
      await post({ token: "garbage" }, { ip });
    }

    expect((await post({ token: ana.token }, { ip })).status).toBe(429);

    vi.setSystemTime(new Date(NOW.getTime() + REGISTRATION_CANCEL_TTL_MS + HOUR));
    expect((await post({ token: ana.token })).status).toBe(410);
    expect(entries()).toEqual([]);
    expect(rows()).toHaveLength(1);
  });

  it("writes nothing when the delete itself fails", async () => {
    const ana = await registered();

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(testEventRegistration.registrations, "cancel").mockRejectedValue(new Error("down"));

    expect((await post({ token: ana.token })).status).toBe(503);
    expect(entries()).toEqual([]);
  });

  it("does not undo or fail the cancellation when the audit write fails: it is reported, and the person is told it worked", async () => {
    const ana = await registered();

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    testAuth.audit.failWith = new Error("audit down");

    const response = await post({ token: ana.token });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "cancelled" });
    expect(rows()).toEqual([]);
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), { action: "audit-log", audit: "event.registration_cancel" });
  });
});
