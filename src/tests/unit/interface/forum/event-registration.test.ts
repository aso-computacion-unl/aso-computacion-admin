import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { FORUM_SESSION_EXPIRED_MESSAGE } from "@/interface/forum/forum-action-result";
import * as registration from "@/interface/forum/event-registration";
import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";
import { signInAs } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";
import { signInToForumAs } from "@/tests/support/test-forum";

const ACTIONS_PATH = "src/interface/forum/event-registration.ts";
const stored = () => testEventRegistration.registrations.all();

function jar(cookies: Record<string, string | undefined>): void {
  cookiesMock.mockResolvedValue({ get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }) });
}

async function signIn(overrides: Parameters<typeof signInToForumAs>[0] = {}) {
  const session = await signInToForumAs(overrides);

  jar({ [FORUM_COOKIE_NAME]: session.cookie });

  return session;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "admin-secret-admin-secret-admin-secret-1234");
  vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await addTestEvent({ registrationMode: "unl" });
});

describe("registerForEvent requires a forum member", () => {
  it("opens with the member guard", () => {
    const source = readFileSync(ACTIONS_PATH, "utf8");
    const bodies = [...source.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{\s*try \{\s*([^\n]*)\n/g)];

    expect(bodies.map(([, name]) => name)).toEqual(["registerForEvent"]);
    expect(bodies[0]![2]).toMatch(/^const member = await requireForumMember\(\);$/);
  });

  it.each([
    ["no cookie", {}],
    ["only an admin session", { [AUTH_COOKIE_NAME]: "ADMIN" }],
    ["an admin session planted in the forum cookie", { [FORUM_COOKIE_NAME]: "ADMIN" }],
  ])("is refused with %s: nothing stored", async (_label, cookies) => {
    jar(Object.fromEntries(await Promise.all(Object.entries(cookies).map(async ([key, who]) => [key, await signInAs(who as "ADMIN")]))));

    expect(await registration.registerForEvent("taller-de-git")).toEqual({ error: FORUM_SESSION_EXPIRED_MESSAGE });
    expect(stored()).toHaveLength(0);
  });
});

describe("registerForEvent", () => {
  it("registers the signed-in member with the verified name and email the forum holds, nothing from the caller", async () => {
    await signIn({ id: "m1", email: "ana@unl.edu.ec", displayName: "Ana Pérez" });

    expect(await registration.registerForEvent("taller-de-git")).toEqual({ success: true });
    expect(stored()).toEqual([expect.objectContaining({ mode: "unl", name: "Ana Pérez", email: "ana@unl.edu.ec", career: null, semester: null })]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/foro/eventos/taller-de-git");
  });

  it("registers a person once: the second try says so and changes nothing", async () => {
    await signIn({ id: "m1" });
    await registration.registerForEvent("taller-de-git");
    const [first] = stored();

    expect(await registration.registerForEvent("taller-de-git")).toEqual({ error: "Ya está inscrito en este evento." });
    expect(stored()).toEqual([first]);
  });

  it("refuses a suspended member (the guard no longer accepts their session) and an email outside the institutional domain", async () => {
    await signIn({ id: "m1", status: "SUSPENDED" });
    expect(await registration.registerForEvent("taller-de-git")).toEqual({ error: FORUM_SESSION_EXPIRED_MESSAGE });

    testEventRegistration.registrations.clear();
    await signIn({ id: "m2", email: "ana@gmail.com", googleSub: "sub-2" });
    expect(await registration.registerForEvent("taller-de-git")).toEqual({ error: "Su cuenta no puede participar en el foro." });
    expect(stored()).toHaveLength(0);
  });

  it("says why when the event is full, closed, open-form only or unknown", async () => {
    await addTestEvent({ title: "Lleno", registrationMode: "unl", registrationCapacity: 1 });
    await addTestEvent({ title: "Cerrado", registrationMode: "unl", registrationDeadline: new Date("2020-01-01T00:00:00.000Z") });
    await addTestEvent({ title: "Formulario", registrationMode: "open" });
    await signIn({ id: "m1" });
    testEventRegistration.registrations.clear();
    await signIn({ id: "m2", email: "luis@unl.edu.ec", googleSub: "sub-m2" });

    await registration.registerForEvent("lleno");
    await signIn({ id: "m3", email: "eva@unl.edu.ec", googleSub: "sub-m3" });

    expect(await registration.registerForEvent("lleno")).toEqual({ error: "Ya no quedan cupos para este evento." });
    expect(await registration.registerForEvent("cerrado")).toEqual({ error: "Las inscripciones de este evento ya cerraron." });
    expect(await registration.registerForEvent("formulario")).toEqual({ error: "Este evento no admite inscripción con cuenta UNL." });
    expect(await registration.registerForEvent("nada")).toEqual({ error: "No se encontró el evento." });
    expect(stored()).toHaveLength(1);
  });
});

describe("getEventRegistrationPage", () => {
  it("shows a visitor the UNL state without personal data, and a member whether they are already in", async () => {
    jar({});

    expect(await getEventRegistrationPage("taller-de-git")).toMatchObject({ kind: "unl", member: null, status: { mode: "unl", state: "open", alreadyRegistered: false } });

    await signIn({ id: "m1" });
    await registration.registerForEvent("taller-de-git");

    expect(await getEventRegistrationPage("taller-de-git")).toMatchObject({ kind: "unl", member: { memberId: "m1" }, status: { alreadyRegistered: true } });
  });

  it("offers the open form to anyone, without a session, with the live seats and the widget key when there is one", async () => {
    await addTestEvent({ title: "Abierto", registrationMode: "open", registrationCapacity: 2 });
    vi.stubEnv("TURNSTILE_SITE_KEY", "0x4AAAA-site_key");
    jar({});

    const page = await getEventRegistrationPage("abierto");

    expect(page).toMatchObject({ kind: "open", siteKey: "0x4AAAA-site_key", status: { mode: "open", state: "open", capacity: 2, registered: 0 } });

    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    expect(await getEventRegistrationPage("abierto")).toMatchObject({ kind: "open", siteKey: undefined });
  });

  describe("Turnstile configuration of the open form", () => {
    const secret = "cf-secret-for-tests";
    const siteKey = "0x4AAAA-site_key";

    beforeEach(async () => {
      await addTestEvent({ title: "Abierto", registrationMode: "open" });
      jar({});
    });

    it("both keys: the widget is offered and nothing is misconfigured", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", secret);
      vi.stubEnv("TURNSTILE_SITE_KEY", siteKey);

      expect(await getEventRegistrationPage("abierto")).toMatchObject({ kind: "open", siteKey, captchaMisconfigured: false });
      expect(console.error).not.toHaveBeenCalled();
    });

    it("secret without a site key: the form is marked unusable and the misconfiguration is logged once, naming the missing key", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", secret);
      vi.stubEnv("TURNSTILE_SITE_KEY", "");

      for (const attempt of [1, 2, 3]) {
        expect(await getEventRegistrationPage("abierto"), `visit ${attempt}`).toMatchObject({ kind: "open", siteKey: undefined, captchaMisconfigured: true });
      }

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(vi.mocked(console.error).mock.calls[0]![0]).toContain("TURNSTILE_SITE_KEY");
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
    });

    it("a placeholder or malformed site key counts as missing", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", secret);

      for (const value of ["__REPLACE_TURNSTILE_SITE_KEY__", "not a key!"]) {
        vi.stubEnv("TURNSTILE_SITE_KEY", value);
        expect(await getEventRegistrationPage("abierto"), value).toMatchObject({ kind: "open", captchaMisconfigured: true });
      }
    });

    it("a site key without the secret, or neither key: not flagged here (the endpoint decides by environment)", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("TURNSTILE_SITE_KEY", siteKey);
      expect(await getEventRegistrationPage("abierto")).toMatchObject({ kind: "open", captchaMisconfigured: false });

      vi.stubEnv("TURNSTILE_SITE_KEY", "");
      expect(await getEventRegistrationPage("abierto")).toMatchObject({ kind: "open", siteKey: undefined, captchaMisconfigured: false });
    });
  });

  it("keeps showing an open event that is full or closed, so the page can say so instead of hiding it", async () => {
    await addTestEvent({ title: "Lleno", registrationMode: "open", registrationCapacity: 1 });
    await addTestEvent({ title: "Pasado", registrationMode: "open", date: "2000-01-01" });
    await testEventRegistration.services.registerOpen.execute({ slug: "lleno", form: { name: "Ana", email: "ana@example.com", career: "Computación", semester: 3 } });
    jar({});

    expect(await getEventRegistrationPage("lleno")).toMatchObject({ kind: "open", status: { state: "full", registered: 1 } });
    expect(await getEventRegistrationPage("pasado")).toMatchObject({ kind: "open", status: { state: "closed" } });
  });

  it("explains an event without registration and offers its calendar only while it has an upcoming exact day", async () => {
    await addTestEvent({ title: "Sin", registrationMode: "none", lugar: "Auditorio" });
    await addTestEvent({ title: "Sin día", registrationMode: "none", date: "2099-12-01", datePrecision: "month" });
    await addTestEvent({ title: "Ya pasó", registrationMode: "none", date: "2000-01-01" });
    jar({});

    expect(await getEventRegistrationPage("sin")).toMatchObject({ kind: "none", calendarHref: "/api/public/events/sin/calendar.ics", event: { title: "Sin", lugar: "Auditorio" } });
    expect(await getEventRegistrationPage("sin-dia")).toMatchObject({ kind: "none", calendarHref: null });
    expect(await getEventRegistrationPage("ya-paso")).toMatchObject({ kind: "none", calendarHref: null });
  });

  it("gives the calendar link to an open event too, for the confirmation", async () => {
    await addTestEvent({ title: "Abierto", registrationMode: "open" });
    jar({});

    expect(await getEventRegistrationPage("abierto")).toMatchObject({ kind: "open", calendarHref: "/api/public/events/abierto/calendar.ics" });
  });

  it("is null for an unknown event and one that is not public", async () => {
    await addTestEvent({ title: "Borrador", registrationMode: "open", isPublished: false });
    await addTestEvent({ title: "Borrador sin", registrationMode: "none", isPublished: false });
    jar({});

    for (const slug of ["nada", "borrador", "borrador-sin"]) expect(await getEventRegistrationPage(slug), slug).toBeNull();
  });
});
