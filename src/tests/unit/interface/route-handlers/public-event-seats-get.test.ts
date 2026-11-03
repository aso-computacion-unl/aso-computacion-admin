import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reportErrorMock, cookiesMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn(), cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));

import { PUBLIC_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/rate-limiter";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

import { GET, OPTIONS } from "../../../../../app/api/public/events/seats/route";

let sequence = 0;

/** A fresh client key per request unless given, so one test's reads never spend another's rate budget. */
function get({ ip, headers = {} }: { ip?: string; headers?: Record<string, string> } = {}) {
  sequence += 1;

  return GET(new NextRequest("https://admin.test/api/public/events/seats", { headers: { "x-real-ip": ip ?? `203.0.113.${sequence % 250}-${sequence}`, ...headers } }));
}

function register(eventId: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    testEventRegistration.registrations.seed({ id: `${eventId}-${index}`, eventId, mode: "open", name: `Persona Privada ${index}`, email: `privada${index}@example.com`, career: "Computación", semester: 3, createdAt: new Date() });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  reportErrorMock.mockReset();
});

describe("GET /api/public/events/seats", () => {
  it("answers { events: [] } when no event takes registrations", async () => {
    await addTestEvent({ registrationMode: "none" });

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(await response.json()).toEqual({ events: [] });
  });

  it("lists the seats of every event that takes registrations, in the documented shape", async () => {
    const taller = await addTestEvent({ title: "Taller de Git", date: "2099-11-28", registrationCapacity: 60 });
    const charla = await addTestEvent({ title: "Charla abierta", date: "2099-12-05", registrationMode: "unl" });
    const lleno = await addTestEvent({ title: "Lleno", date: "2099-12-10", registrationCapacity: 2 });
    const pasado = await addTestEvent({ title: "Ya pasó", date: "2000-01-01", registrationCapacity: 10 });
    register(taller.id, 48);
    register(charla.id, 3);
    register(lleno.id, 2);
    register(pasado.id, 4);

    expect(await (await get()).json()).toEqual({
      events: [
        { slug: "ya-paso", capacity: 10, registered: 4, seatsLeft: 6, status: "closed" },
        { slug: "taller-de-git", capacity: 60, registered: 48, seatsLeft: 12, status: "open" },
        { slug: "charla-abierta", capacity: null, registered: 3, seatsLeft: null, status: "open" },
        { slug: "lleno", capacity: 2, registered: 2, seatsLeft: 0, status: "full" },
      ],
    });
  });

  it("leaves out drafts and events that take no registration", async () => {
    await addTestEvent({ title: "Visible" });
    await addTestEvent({ title: "Borrador", isPublished: false });
    await addTestEvent({ title: "Sin inscripción", registrationMode: "none" });

    expect((await (await get()).json()).events.map((event: { slug: string }) => event.slug)).toEqual(["visible"]);
  });

  it("carries no personal data: nothing of the people registered reaches the body", async () => {
    const taller = await addTestEvent();
    register(taller.id, 2);

    const text = await (await get()).text();

    expect(text).not.toMatch(/Persona Privada|privada\d@example\.com|Computación/);
  });

  it("needs no session and sets no cookie", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("is cacheable at the edge for 5 s at most and never served stale", async () => {
    const cacheControl = (await get()).headers.get("Cache-Control");

    expect(cacheControl).toBe("public, max-age=0, s-maxage=5, must-revalidate");
    expect(cacheControl).not.toMatch(/stale-while-revalidate/);
  });

  it("can be read from any origin, with or without an Origin header", async () => {
    expect((await get()).headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await get({ headers: { origin: "https://preview-123.pages.dev" } })).headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers the preflight for GET", () => {
    const response = OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("fails with a generic, uncached 503 that leaks nothing of the cause, and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(testEventRegistration.registrations, "countByEvents").mockRejectedValue(new Error("connect ECONNREFUSED postgres://user:secret@db/aso"));
    await addTestEvent();

    const response = await get();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ error: "Service unavailable" });
    expect(text).not.toMatch(/secret|postgres|ECONNREFUSED/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), { route: "public-event-seats" });
  });

  it("answers 429 with Retry-After, uncached, once a client spends its budget", async () => {
    const ip = "198.51.100.88";

    for (let attempt = 0; attempt < PUBLIC_RATE_LIMIT_MAX_REQUESTS; attempt += 1) await get({ ip });

    const response = await get({ ip });

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
