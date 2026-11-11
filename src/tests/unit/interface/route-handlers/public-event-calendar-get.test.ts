import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));

import { PUBLIC_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/rate-limiter";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

import { GET, OPTIONS } from "../../../../../app/api/public/events/[slug]/calendar.ics/route";

const LANDING = "https://aso-computacion.pages.dev";
let sequence = 0;

function get(slug = "taller-de-git", { ip, origin }: { ip?: string; origin?: string } = {}) {
  sequence += 1;

  return GET(
    new NextRequest(`https://admin.test/api/public/events/${slug}/calendar.ics`, {
      headers: { "x-real-ip": ip ?? `192.0.2.${sequence % 250}-${sequence}`, ...(origin ? { origin } : {}) },
    }),
    { params: Promise.resolve({ slug }) },
  );
}

beforeEach(() => {
  vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);
  vi.stubEnv("AUTH_URL", "https://admin.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/public/events/[slug]/calendar.ics", () => {
  it("serves the event as a calendar file to anyone, with no cookie, as a download", async () => {
    await addTestEvent({ slug: "taller-de-git", title: "Taller de Git", hora: "09:00 - 11:00", lugar: "Lab 2", registrationMode: "unl" });

    const response = await get();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="taller-de-git.ics"');
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60, must-revalidate");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(body).toContain("SUMMARY:Taller de Git");
    expect(body).toContain("DTSTART:20991128T140000Z");
    expect(body).toContain("URL:https://admin.example/inscripciones/taller-de-git");
  });

  it("contains no personal data even when people have registered", async () => {
    const event = await addTestEvent({ registrationMode: "open" });
    await testEventRegistration.registrations.register(
      { id: "r1", eventId: event.id, mode: "open", name: "Ana Secreta", email: "ana.secreta@example.com", institution: "Universidad Nacional de Loja", career: "Carrera Privada", semester: 5, confirmedAt: new Date("2026-11-20T15:00:00.000Z") },
      new Date("2026-11-20T15:00:00.000Z"),
    );

    const body = await (await get()).text();

    expect(body).not.toMatch(/Secreta|ana\.|example\.com|Carrera Privada|ATTENDEE/);
  });

  it("answers 404 for an unknown event, a draft, a scheduled event, and an event without an exact day", async () => {
    await addTestEvent({ title: "Borrador", isPublished: false });
    await addTestEvent({ title: "Futuro", publishAt: new Date("2999-01-01T00:00:00.000Z") });
    await addTestEvent({ title: "Sin dia", datePrecision: "month" });
    await addTestEvent({ title: "Sin fecha", date: null });

    for (const slug of ["nada", "borrador", "futuro", "sin-dia", "sin-fecha", "NOT A SLUG!"]) {
      expect((await get(slug)).status, slug).toBe(404);
    }
  });

  it("is rate limited like the rest of the public API, with Retry-After", async () => {
    await addTestEvent();
    const ip = "198.51.100.200";

    for (let attempt = 0; attempt < PUBLIC_RATE_LIMIT_MAX_REQUESTS; attempt += 1) await get("taller-de-git", { ip });

    const limited = await get("taller-de-git", { ip });

    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("echoes only an allowlisted origin, and answers a preflight for GET", async () => {
    await addTestEvent();

    expect((await get("taller-de-git", { origin: LANDING })).headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
    expect((await get("taller-de-git", { origin: "https://evil.example" })).headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(OPTIONS(new NextRequest("https://admin.test/x", { method: "OPTIONS", headers: { origin: LANDING } })).headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });
});
