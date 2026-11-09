import { inspect } from "node:util";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reportErrorMock, cookiesMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn(), cookiesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));

import { REGISTRATION_RATE_LIMIT_MAX_REQUESTS } from "@/infrastructure/http/registration-rate-limiter";
import { openRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";
import { testMail } from "@/tests/support/test-mail";

import { OPTIONS, POST } from "../../../../../app/api/public/events/[slug]/registrations/route";

const LANDING = "https://aso-computacion.pages.dev";
const FORM = { name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5, turnstileToken: "good-token" };

let sequence = 0;
let fetchMock: ReturnType<typeof vi.fn>;

/** A fresh client key per request unless given, so one test's attempts never spend another's rate budget. */
function post(body: unknown, { slug = "taller-de-git", ip, headers = {} }: { slug?: string; ip?: string; headers?: Record<string, string> } = {}) {
  sequence += 1;

  const request = new NextRequest(`https://admin.test/api/public/events/${slug}/registrations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip ?? `203.0.113.${sequence % 250}-${sequence}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  return POST(request, { params: Promise.resolve({ slug }) });
}

const stored = () => testEventRegistration.registrations.all();
/** The person opens the link sent to their email: the pending row takes its seat. */
const confirmStored = async (index = 0) => {
  const row = stored()[index]!;

  await testEventRegistration.registrations.confirm(row.eventId, row.id, new Date(), testEventRegistration.registrations.confirmNonceOf(row.id));
};
const turnstile = (success: boolean, extra: object = {}) => fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success, ...extra }), { status: 200 }));

beforeEach(async () => {
  vi.stubEnv("PUBLIC_CORS_ORIGINS", LANDING);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.stubEnv("NODE_ENV", "production");
  // Mail fully configured (the sender itself is the recording double of test-mail.ts).
  vi.stubEnv("AUTH_URL", "https://admin.example.org");
  vi.stubEnv("MAIL_GMAIL_USER", "asociacion@gmail.com");
  vi.stubEnv("MAIL_GMAIL_APP_PASSWORD", "abcdefghijklmnop");
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "r".repeat(40));
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  turnstile(true);
  await addTestEvent();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/public/events/[slug]/registrations", () => {
  it("registers a person, answers 201 without echoing their data, needs no cookie and is never cached", async () => {
    const response = await post(FORM);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, confirm: "email" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(stored()).toEqual([expect.objectContaining({ mode: "open", name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5, confirmedAt: null })]);
    expect(JSON.stringify(stored())).not.toContain("good-token");
  });

  describe("confirmation email", () => {
    const TODAY = () => new Date().toISOString().slice(0, 10);

    it("stores the registration pending, takes no seat and sends one email with a signed 48 h link to the confirm page", async () => {
      const response = await post(FORM);
      const [row] = stored();
      const [mail] = testMail.transport.delivered;

      expect(response.status).toBe(201);
      expect(row).toMatchObject({ email: "ana@example.com", confirmedAt: null });
      expect(await testEventRegistration.registrations.count(row!.eventId)).toBe(0);
      expect(testMail.transport.delivered).toHaveLength(1);
      expect(mail).toMatchObject({ to: "ana@example.com", subject: "Confirme su cupo en «Taller de Git»" });

      const link = /https:\/\/admin\.example\.org\/inscripciones\/taller-de-git\/confirmar\?token=([\w.-]+)/.exec(mail!.text);

      expect(link).not.toBeNull();
      // The link names the attempt stored on the pending row (D9): that is what retires the links of earlier attempts.
      expect(testEventRegistration.registrations.confirmNonceOf(row!.id)).toEqual(expect.any(String));
      expect(await openRegistrationConfirmToken(link![1])).toEqual({
        status: "valid",
        claims: { registrationId: row!.id, eventId: row!.eventId, nonce: testEventRegistration.registrations.confirmNonceOf(row!.id) },
      });
      expect(await testMail.budget.used(TODAY())).toBe(1);
    });

    it("never echoes the address or the link in the answer", async () => {
      const text = await (await post(FORM)).text();

      expect(text).not.toMatch(/ana@|token|confirmar/);
    });

    it("sends again, with the same registration id, when the same pending email asks once more", async () => {
      await post(FORM);
      const [first] = stored();

      expect((await post({ ...FORM, name: "Ana María" })).status).toBe(201);

      expect(stored()).toEqual([expect.objectContaining({ id: first!.id, name: "Ana María", confirmedAt: null })]);
      expect(testMail.transport.delivered).toHaveLength(2);
    });

    it("sends nothing to an address that is already confirmed: 409 duplicate", async () => {
      await post(FORM);
      await confirmStored();
      testMail.transport.delivered.length = 0;

      expect((await post(FORM)).status).toBe(409);
      expect(testMail.transport.delivered).toEqual([]);
    });

    it("sends nothing and stores nothing for a full, closed or unknown event", async () => {
      await addTestEvent({ title: "Cerrado", registrationDeadline: new Date("2020-01-01T00:00:00.000Z") });

      expect((await post(FORM, { slug: "cerrado" })).status).toBe(409);
      expect((await post(FORM, { slug: "nada" })).status).toBe(404);
      expect(stored()).toEqual([]);
      expect(testMail.transport.delivered).toEqual([]);
    });

    it.each([
      ["the Gmail account is not configured", () => vi.stubEnv("MAIL_GMAIL_USER", "")],
      ["the app password is a placeholder", () => vi.stubEnv("MAIL_GMAIL_APP_PASSWORD", "__REPLACE_MAIL_GMAIL_APP_PASSWORD__")],
      ["the confirmation secret is missing", () => vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "")],
      ["the confirmation secret is too short", () => vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "short")],
      ["the public origin is not set", () => vi.stubEnv("AUTH_URL", "")],
      ["the sender has no provider", () => void (testMail.configured = false)],
    ])("refuses with 503 email_unavailable, leaving nothing behind, when %s", async (_label, misconfigure) => {
      misconfigure();

      const response = await post(FORM);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "email_unavailable" });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(stored()).toEqual([]);
      expect(testMail.transport.delivered).toEqual([]);
      expect(await testMail.budget.used(TODAY())).toBe(0);
    });

    it("refuses with 503 email_budget, leaving nothing behind, once today's budget is spent", async () => {
      testMail.dailyLimit = 1;
      expect((await post(FORM)).status).toBe(201);

      const response = await post({ ...FORM, email: "luis@example.com" });

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "email_budget" });
      expect(stored().map((row) => row.email)).toEqual(["ana@example.com"]);
      expect(testMail.transport.delivered).toHaveLength(1);
      expect(await testMail.budget.used(TODAY())).toBe(1);
    });

    it("checks the fields before the mail: a bad field is 400 even while mail is down, and the same form works once mail is back", async () => {
      testMail.configured = false;

      expect(await (await post({ ...FORM, email: "no-es-un-correo" })).json()).toEqual({ error: "validation", field: "email" });
      expect((await post(FORM)).status).toBe(503);

      testMail.configured = true;

      expect((await post(FORM)).status).toBe(201);
      expect(stored()).toHaveLength(1);
      expect(testMail.transport.delivered).toHaveLength(1);
    });

    it("answers 503 email_unavailable when the provider fails, gives the budget back and lets a retry through on the same row", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      testMail.transport.failing.add("ana@example.com");

      const response = await post(FORM);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "email_unavailable" });
      expect(await testMail.budget.used(TODAY())).toBe(0);
      expect(await testEventRegistration.registrations.count(stored()[0]!.eventId)).toBe(0);

      const [pending] = stored();

      testMail.transport.failing.clear();

      expect((await post(FORM)).status).toBe(201);
      expect(stored()).toEqual([expect.objectContaining({ id: pending!.id, confirmedAt: null })]);
      expect(testMail.transport.delivered).toHaveLength(1);
    });
  });

  describe("Turnstile", () => {
    it("refuses a request without a token and stores nothing", async () => {
      const response = await post({ ...FORM, turnstileToken: undefined });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "captcha" });
      expect(stored()).toHaveLength(0);
    });

    it("refuses a token Cloudflare rejects and stores nothing", async () => {
      turnstile(false, { "error-codes": ["invalid-input-response"] });

      const response = await post(FORM);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "captcha" });
      expect(stored()).toHaveLength(0);
    });

    it("accepts a valid token, checking it server-side with the secret", async () => {
      expect((await post(FORM)).status).toBe(201);

      const [, init] = fetchMock.mock.calls[0]!;
      expect(Object.fromEntries(new URLSearchParams(init.body))).toMatchObject({ secret: "test-secret", response: "good-token" });
    });

    it("fails closed with 503 when Cloudflare is unreachable, and in production without a secret", async () => {
      fetchMock.mockRejectedValue(new Error("network"));
      expect((await post(FORM)).status).toBe(503);

      fetchMock.mockClear();
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await post(FORM);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "unavailable" });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(0);
    });
  });

  // Which keys are set decides whether a token is demanded. The endpoint also serves the landing's own form, whose
  // widget uses the landing's site key, so verification follows the secret alone (see docs/DEPLOY.md, section 4c).
  describe("Turnstile configuration", () => {
    const SITE_KEY = "0x4AAAA-site_key";
    const withoutToken = { ...FORM, turnstileToken: undefined };

    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("both keys: a token is required and checked", async () => {
      vi.stubEnv("TURNSTILE_SITE_KEY", SITE_KEY);

      const refused = await post(withoutToken);

      expect(refused.status).toBe(400);
      expect(await refused.json()).toEqual({ error: "captcha" });
      expect((await post(FORM)).status).toBe(201);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("secret only: still verifies, so the endpoint never accepts a registration without a token", async () => {
      vi.stubEnv("TURNSTILE_SITE_KEY", "");

      expect((await post(withoutToken)).status).toBe(400);
      expect((await post(FORM)).status).toBe(201);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("site key only in production: closed (503), like no keys at all, and Cloudflare is never asked", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("TURNSTILE_SITE_KEY", SITE_KEY);

      for (const body of [FORM, withoutToken]) {
        const response = await post(body);

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: "unavailable" });
      }

      expect(fetchMock).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(0);
    });

    it("neither key: closed in production, and outside production the check is skipped so local development works", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("TURNSTILE_SITE_KEY", "");
      expect((await post(FORM)).status).toBe(503);

      vi.stubEnv("NODE_ENV", "development");
      expect((await post(withoutToken)).status).toBe(201);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("rate limit", () => {
    it("answers 429 with Retry-After once a client spends its budget, before touching Cloudflare or the database", async () => {
      const ip = "198.51.100.77";

      for (let attempt = 0; attempt < REGISTRATION_RATE_LIMIT_MAX_REQUESTS; attempt += 1) {
        await post({ ...FORM, email: `persona${attempt}@example.com` }, { ip });
      }

      fetchMock.mockClear();
      const response = await post({ ...FORM, email: "otra@example.com" }, { ip });

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(await response.json()).toEqual({ error: "rate_limited" });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(stored().map((row) => row.email)).not.toContain("otra@example.com");
    });
  });

  describe("rules", () => {
    it("answers 201 again for the same email while it is still pending, refreshing the same row", async () => {
      await post(FORM);
      const [first] = stored();

      const response = await post({ ...FORM, name: "Ana María", email: "ANA@example.com" });

      expect(response.status).toBe(201);
      expect(stored()).toEqual([expect.objectContaining({ id: first!.id, name: "Ana María", confirmedAt: null })]);
    });

    it("answers 409 duplicate for the same email once it is confirmed and leaves the first registration as it was", async () => {
      await post(FORM);
      await confirmStored();
      const [first] = stored();

      const response = await post({ ...FORM, name: "Otro Nombre", semester: 9, email: "ANA@example.com" });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "duplicate" });
      expect(stored()).toEqual([first]);
    });

    it("answers 409 full when there are no seats left, and 409 closed after the deadline", async () => {
      await addTestEvent({ title: "Pequeño", registrationCapacity: 1 });
      await addTestEvent({ title: "Cerrado", registrationDeadline: new Date("2020-01-01T00:00:00.000Z") });

      await post(FORM, { slug: "pequeno" });
      await confirmStored();
      expect(await (await post({ ...FORM, email: "luis@example.com" }, { slug: "pequeno" })).json()).toEqual({ error: "full" });

      const closed = await post(FORM, { slug: "cerrado" });

      expect(closed.status).toBe(409);
      expect(await closed.json()).toEqual({ error: "closed" });
      expect(stored()).toHaveLength(1);

      // A pending row takes no seat: others can still ask while one waits for its email.
      await addTestEvent({ title: "Con espera", registrationCapacity: 1 });
      await post(FORM, { slug: "con-espera" });
      expect((await post({ ...FORM, email: "luis@example.com" }, { slug: "con-espera" })).status).toBe(201);
    });

    it("answers 404 for an unknown event, a draft, an event without registration and one that wants a UNL account", async () => {
      await addTestEvent({ title: "Borrador", isPublished: false });
      await addTestEvent({ title: "Sin inscripcion", registrationMode: "none" });
      await addTestEvent({ title: "Con cuenta", registrationMode: "unl" });

      for (const slug of ["nada", "borrador", "sin-inscripcion", "con-cuenta", "NOT A SLUG!"]) {
        const response = await post(FORM, { slug });

        expect(response.status, slug).toBe(404);
        expect(await response.json()).toEqual({ error: "not_found" });
      }

      expect(stored()).toHaveLength(0);
    });
  });

  describe("input", () => {
    it.each([
      ["semester", { semester: 40 }],
      ["email", { email: "no-es-un-correo" }],
      ["name", { name: "" }],
      ["name", { name: "x".repeat(121) }],
      ["career", { career: "c".repeat(121) }],
      ["institution", { institution: "" }],
      ["institution", { institution: undefined }],
      ["institution", { institution: "u".repeat(121) }],
    ])("answers 400 naming the invalid %s, and stores nothing", async (field, override) => {
      const response = await post({ ...FORM, ...override });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "validation", field });
      expect(stored()).toHaveLength(0);
    });

    it("takes a registration without career and semester: both are optional", async () => {
      const { career, semester, ...required } = FORM;

      expect(career && semester).toBeTruthy();
      expect((await post(required)).status).toBe(201);
      expect(stored()).toEqual([expect.objectContaining({ institution: "Universidad Nacional de Loja", career: null, semester: null })]);
    });

    it("answers 413 to a body that is too big, 415 to anything but JSON, and 400 to malformed JSON or a non-object", async () => {
      expect((await post({ ...FORM, name: "x".repeat(10_000) })).status).toBe(413);
      expect((await post(JSON.stringify(FORM), { headers: { "content-type": "text/plain" } })).status).toBe(415);
      expect((await post("{not json")).status).toBe(400);
      expect((await post("[1,2]")).status).toBe(400);
      expect((await post("null")).status).toBe(400);
      expect(stored()).toHaveLength(0);
    });

    it("ignores fields it does not collect", async () => {
      await post({ ...FORM, role: "ADMIN", id: "evil", mode: "unl" });

      expect(Object.keys(stored()[0]!).sort()).toEqual(["career", "confirmedAt", "createdAt", "email", "eventId", "id", "institution", "mode", "name", "reminderSentAt", "semester"]);
      expect(stored()[0]).toMatchObject({ mode: "open" });
    });

    it("does not leak internals when something unexpected fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(testEventRegistration.registrations, "register").mockRejectedValue(new Error("connection string postgres://secret"));

      const response = await post(FORM);

      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain("secret");
      expect(reportErrorMock).toHaveBeenCalled();
    });

    describe("when storing fails with an error that echoes what was submitted", () => {
      // A database error can repeat the failed statement's values: the submitted name, email and career.
      class DatabaseLikeError extends Error {
        readonly code = "P2010";
        readonly meta = { target: [FORM.email], name: FORM.name };
      }

      const failure = () => new DatabaseLikeError(`Invalid create() invocation: data: { name: "${FORM.name}", email: "${FORM.email}", career: "${FORM.career}" }`);

      it("logs only the error class and code: not one submitted value reaches the log line", async () => {
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

        vi.spyOn(testEventRegistration.registrations, "register").mockRejectedValue(failure());

        expect((await post(FORM)).status).toBe(503);
        expect(logged).toHaveBeenCalledTimes(1);
        expect(logged.mock.calls[0]).toEqual(["Open event registration failed", "DatabaseLikeError P2010"]);

        const everything = inspect(logged.mock.calls, { depth: null });

        for (const value of [FORM.name, FORM.email, FORM.career, "Pérez", "ana@", "turnstile", FORM.turnstileToken]) {
          expect(everything).not.toContain(value);
        }
      });

      it("still reports to Sentry through the reporter, with the route tag, and the report carries no submitted value either", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(testEventRegistration.registrations, "register").mockRejectedValue(failure());

        await post(FORM);

        expect(reportErrorMock).toHaveBeenCalledTimes(1);

        const [reported, context] = reportErrorMock.mock.calls[0]!;

        expect(context).toEqual({ route: "public-event-registration" });
        expect(reported).toBeInstanceOf(Error);
        expect(reported.message).toBe("DatabaseLikeError P2010");

        const everything = inspect(reported, { depth: null }) + JSON.stringify(reported) + String(reported.stack);

        for (const value of [FORM.name, FORM.email, FORM.career, "Pérez", "ana@"]) {
          expect(everything).not.toContain(value);
        }
      });
    });
  });

  describe("CORS", () => {
    it("echoes only an allowlisted origin on the answer and on a refusal", async () => {
      const allowed = await post(FORM, { headers: { origin: LANDING } });
      const refused = await post({ ...FORM, turnstileToken: undefined }, { headers: { origin: LANDING } });
      const stranger = await post(FORM, { headers: { origin: "https://evil.example" } });

      expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
      expect(refused.headers.get("Access-Control-Allow-Origin")).toBe(LANDING);
      expect(stranger.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(allowed.headers.get("Vary")).toContain("Origin");
    });

    it("answers the preflight with POST and Content-Type for the landing only", () => {
      const preflight = (origin: string) =>
        OPTIONS(new NextRequest("https://admin.test/api/public/events/taller-de-git/registrations", { method: "OPTIONS", headers: { origin } }));

      expect(preflight(LANDING).headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
      expect(preflight(LANDING).headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
      expect(preflight("https://evil.example").headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });
});
