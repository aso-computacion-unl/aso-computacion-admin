import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: vi.fn() }));

import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";
import { testMail } from "@/tests/support/test-mail";

import { POST as confirmPost } from "../../../../app/api/public/events/[slug]/registrations/confirm/route";
import { POST as registerPost } from "../../../../app/api/public/events/[slug]/registrations/route";

/*
 * D9 (R4/R5), end to end over the two public endpoints: when a pending email registers again, the link of the first
 * email answers "invalid" (400) and changes nothing; only the newest link takes the seat.
 */
const SLUG = "taller-de-git";
const FORM = { name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5, turnstileToken: "good-token" };

let sequence = 0;
let eventId: string;

function call(handler: typeof registerPost | typeof confirmPost, path: string, body: unknown) {
  sequence += 1;

  const request = new NextRequest(`https://admin.test/api/public/events/${SLUG}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `198.51.100.${sequence}-${sequence}` },
    body: JSON.stringify(body),
  });

  return handler(request, { params: Promise.resolve({ slug: SLUG }) });
}

const register = () => call(registerPost, "registrations", FORM);
const confirm = (token: string) => call(confirmPost, "registrations/confirm", { token });
const rows = () => testEventRegistration.registrations.all();
/** The token of the n-th confirmation email sent so far (0 = the first). */
const emailedToken = (index: number) => /confirmar\?token=([\w.-]+)/.exec(testMail.transport.delivered[index]!.text)![1]!;

beforeEach(async () => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_URL", "https://admin.example.org");
  vi.stubEnv("MAIL_GMAIL_USER", "asociacion@gmail.com");
  vi.stubEnv("MAIL_GMAIL_APP_PASSWORD", "abcdefghijklmnop");
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "r".repeat(40));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
  eventId = (await addTestEvent({ registrationCapacity: 5 })).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("only the latest confirmation link works (D9)", () => {
  it("answers the first link 400 invalid after a second registration, takes no seat and changes no row", async () => {
    expect((await register()).status).toBe(201);
    expect((await register()).status).toBe(201);

    expect(testMail.transport.delivered).toHaveLength(2);
    expect(emailedToken(0)).not.toBe(emailedToken(1));

    const before = rows();
    const stale = await confirm(emailedToken(0));

    expect(stale.status).toBe(400);
    expect(await stale.json()).toEqual({ error: "invalid" });
    expect(rows()).toEqual(before);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.confirmedAt).toBeNull();
    expect(await testEventRegistration.registrations.count(eventId)).toBe(0);
  });

  it("confirms with the second link", async () => {
    await register();
    await register();

    const fresh = await confirm(emailedToken(1));

    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toEqual({ ok: true, status: "confirmed" });
    expect(await testEventRegistration.registrations.count(eventId)).toBe(1);
  });

  it("keeps a single link working when the person registered only once", async () => {
    await register();

    expect((await confirm(emailedToken(0))).status).toBe(200);
    expect(await testEventRegistration.registrations.count(eventId)).toBe(1);
  });

  it("answers the old link invalid even after the newest one confirmed, and the newest one already_confirmed", async () => {
    await register();
    await register();
    await confirm(emailedToken(1));

    const stale = await confirm(emailedToken(0));

    expect(stale.status).toBe(400);
    expect(await stale.json()).toEqual({ error: "invalid" });
    expect(await (await confirm(emailedToken(1))).json()).toEqual({ ok: true, status: "already_confirmed" });
    expect(await testEventRegistration.registrations.count(eventId)).toBe(1);
  });
});
