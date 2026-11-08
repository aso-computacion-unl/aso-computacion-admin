import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reportErrorMock, cookiesMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn(), cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));

import { REGISTRATION_CONFIRMATION_TTL_MS } from "@/domain/event-registration";
import { REGISTRATION_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/registration-rate-limiter";
import { sealRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

import * as routeModule from "../../../../../app/api/public/events/[slug]/registrations/confirm/route";

const { POST } = routeModule;
const SECRET = "r".repeat(40);
const NOW = new Date("2099-11-20T15:00:00.000Z");
const HOUR = 3_600_000;

let sequence = 0;
let event: Awaited<ReturnType<typeof addTestEvent>>;

function post(body: unknown, { slug = "taller-de-git", ip, headers = {} }: { slug?: string; ip?: string; headers?: Record<string, string> } = {}) {
  sequence += 1;

  const request = new NextRequest(`https://admin.test/api/public/events/${slug}/registrations/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip ?? `203.0.113.${sequence % 250}-${sequence}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  return POST(request, { params: Promise.resolve({ slug }) });
}

/** A pending open registration stored `ageMs` before NOW, and the token its email would carry (issued when it was stored). */
async function pending(overrides: { ageMs?: number; eventId?: string; email?: string } = {}) {
  const storedAt = new Date(NOW.getTime() - (overrides.ageMs ?? 0));
  const eventId = overrides.eventId ?? event.id;
  const email = overrides.email ?? "ana@example.com";
  const id = `reg-${(sequence += 1)}`;

  await testEventRegistration.registrations.register(
    { id, eventId, mode: "open", name: "Ana Pérez", email, institution: "Universidad Nacional de Loja", career: null, semester: null, confirmedAt: null },
    storedAt,
  );

  return { id, token: await sealRegistrationConfirmToken({ registrationId: id, eventId }, storedAt) };
}

/** A pending row stored straight, bypassing the rules (an event that closed or went private after the email went out). */
async function seedPending(eventId: string) {
  const id = `seed-${(sequence += 1)}`;

  testEventRegistration.registrations.seed({ id, eventId, mode: "open", name: "Ana Pérez", email: "ana@example.com", institution: "UNL", career: null, semester: null, createdAt: NOW, confirmedAt: null });

  return { id, token: await sealRegistrationConfirmToken({ registrationId: id, eventId }, NOW) };
}

const rows = () => testEventRegistration.registrations.all();
const seats = () => testEventRegistration.registrations.count(event.id);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", SECRET);
  event = await addTestEvent({ date: "2099-11-28" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/public/events/[slug]/registrations/confirm", () => {
  it("takes the seat of a pending registration, answers 200, needs no cookie and is never cached", async () => {
    const { id, token } = await pending();

    const response = await post({ token });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "confirmed" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(rows()).toEqual([expect.objectContaining({ id, confirmedAt: NOW })]);
    expect(await seats()).toBe(1);
  });

  it("answers already_confirmed the second time and changes nothing", async () => {
    const { token } = await pending();

    await post({ token });
    const [confirmed] = rows();
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    const again = await post({ token });

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, status: "already_confirmed" });
    expect(rows()).toEqual([confirmed]);
    expect(await seats()).toBe(1);
  });

  it("is not a GET: a mail scanner that prefetches the link confirms nothing", async () => {
    const { token } = await pending();

    expect("GET" in routeModule).toBe(false);
    expect("HEAD" in routeModule).toBe(false);
    expect(rows()[0]!.confirmedAt).toBeNull();
    expect(token).toBeTruthy();
  });

  it("answers 409 full when the seats went to others meanwhile, and the row stays pending", async () => {
    const small = await addTestEvent({ title: "Pequeño", registrationCapacity: 1 });
    const late = await pending({ eventId: small.id });
    await testEventRegistration.registrations.register(
      { id: "taken", eventId: small.id, mode: "open", name: "Luis", email: "luis@example.com", institution: "UNL", career: null, semester: null, confirmedAt: NOW },
      NOW,
    );
    const before = rows();

    const response = await post({ token: late.token }, { slug: "pequeno" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "full" });
    expect(rows()).toEqual(before);
  });

  it("answers 409 closed after the deadline, and the row stays pending", async () => {
    const closing = await addTestEvent({ title: "Cierra", registrationDeadline: new Date(NOW.getTime() - HOUR) });
    const { token } = await seedPending(closing.id);
    const before = rows();

    const response = await post({ token }, { slug: "cierra" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "closed" });
    expect(rows()).toEqual(before);
  });

  it("answers 410 expired for a link older than 48 hours, even one whose signature is fine, and takes no seat", async () => {
    const { token } = await pending();
    const before = rows();

    vi.setSystemTime(new Date(NOW.getTime() + 48 * HOUR + 1000));

    const response = await post({ token });

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "expired" });
    expect(rows()).toEqual(before);
    expect(await seats()).toBe(0);
  });

  it("answers 410 expired when the stored row is past its window although the token is not (row older than its link)", async () => {
    const stale = await pending({ ageMs: REGISTRATION_CONFIRMATION_TTL_MS });
    const fresh = await sealRegistrationConfirmToken({ registrationId: stale.id, eventId: event.id }, NOW);

    const response = await post({ token: fresh });

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "expired" });
    expect(await seats()).toBe(0);
  });

  it("keeps the old link working after the person asked again, inside the restarted window, on the same registration", async () => {
    const first = await pending({ ageMs: 40 * HOUR });
    await testEventRegistration.registrations.register(
      { id: "other-id", eventId: event.id, mode: "open", name: "Ana", email: "ana@example.com", institution: "UNL", career: null, semester: null, confirmedAt: null },
      new Date(NOW.getTime() - HOUR),
    );

    expect((await post({ token: first.token })).status).toBe(200);
    expect(rows()).toEqual([expect.objectContaining({ id: first.id, confirmedAt: NOW })]);
  });

  it.each([
    ["no token", {}],
    ["an empty token", { token: "" }],
    ["a number", { token: 7 }],
    ["garbage", { token: "not-a-token" }],
  ])("answers 400 invalid for %s and changes nothing", async (_label, body) => {
    await pending();
    const before = rows();

    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
    expect(rows()).toEqual(before);
  });

  it("answers 400 invalid for a token signed with another secret", async () => {
    const { id } = await pending();
    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "x".repeat(40));
    const forged = await sealRegistrationConfirmToken({ registrationId: id, eventId: event.id }, NOW);
    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", SECRET);

    expect((await post({ token: forged })).status).toBe(400);
    expect(rows()[0]!.confirmedAt).toBeNull();
  });

  it("answers 400 invalid for a registration that does not exist, and for a link used on another event's page", async () => {
    const other = await addTestEvent({ title: "Otro evento" });
    const { token } = await pending();
    const ghost = await sealRegistrationConfirmToken({ registrationId: "ghost", eventId: event.id }, NOW);

    expect((await post({ token: ghost })).status).toBe(400);
    expect((await post({ token }, { slug: "otro-evento" })).status).toBe(400);
    expect(other.id).not.toBe(event.id);
    expect(rows()[0]!.confirmedAt).toBeNull();
  });

  it("answers 404 for an event that is unknown or not a slug, and for one that is not public any more, leaving the row pending", async () => {
    const draft = await addTestEvent({ title: "Borrador", isPublished: false });
    const { token } = await pending();
    const hidden = await seedPending(draft.id);

    for (const slug of ["nada", "NOT A SLUG!"]) {
      const response = await post({ token }, { slug });

      expect(response.status, slug).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }

    const response = await post({ token: hidden.token }, { slug: "borrador" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(rows().every((row) => row.confirmedAt === null)).toBe(true);
  });

  it("answers 413 to a body that is too big, 415 to anything but JSON and 400 to malformed JSON", async () => {
    expect((await post({ token: "x".repeat(10_000) })).status).toBe(413);
    expect((await post(JSON.stringify({ token: "x" }), { headers: { "content-type": "text/plain" } })).status).toBe(415);
    expect((await post("{not json")).status).toBe(400);
    expect((await post("[1]")).status).toBe(400);
  });

  it("answers 429 with Retry-After once a client spends its attempts, before reading the token", async () => {
    const { token } = await pending();
    const ip = "198.51.100.88";

    for (let attempt = 0; attempt < REGISTRATION_RATE_LIMIT_MAX_REQUESTS; attempt += 1) {
      await post({ token: "garbage" }, { ip });
    }

    const limited = await post({ token }, { ip });

    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect(rows()[0]!.confirmedAt).toBeNull();
  });

  it("does not leak internals when something unexpected fails", async () => {
    const { token } = await pending();

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(testEventRegistration.registrations, "confirm").mockRejectedValue(new Error("connection string postgres://secret"));

    const response = await post({ token });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), { route: "public-event-registration-confirm" });
    expect(JSON.stringify(reportErrorMock.mock.calls)).not.toContain("secret");
  });

  it("answers invalid, taking no seat, while the confirmation secret is not usable (nothing can be verified)", async () => {
    const { token } = await pending();

    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "");

    const response = await post({ token });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
    expect(rows()[0]!.confirmedAt).toBeNull();
  });
});
