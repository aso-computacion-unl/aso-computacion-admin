import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { CANCELLATION_SESSION_EXPIRED_RESULT } from "@/interface/event-registration/registration-action-errors";
import * as cancellation from "@/interface/event-registration/cancel-registration-action";
import { signInAs, testAuth } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";
import { signInToForumAs } from "@/tests/support/test-forum";

/*
 * D7 (R2): the student cancels their own reservation from the event page. The registration is the one of the signed-in
 * member's verified address, never a value from the caller. Every refusal leaves the stored rows exactly as they were.
 */
const ACTIONS_PATH = "src/interface/event-registration/cancel-registration-action.ts";
const stored = () => testEventRegistration.registrations.all();

function jar(cookies: Record<string, string | undefined>): void {
  cookiesMock.mockResolvedValue({ get: (name: string) => (cookies[name] === undefined ? undefined : { name, value: cookies[name] }) });
}

async function signIn(overrides: Parameters<typeof signInToForumAs>[0] = {}) {
  const session = await signInToForumAs(overrides);

  jar({ [FORUM_COOKIE_NAME]: session.cookie });

  return session;
}

/** A registration stored straight, the way the page's own reserve button leaves it. */
function reserved(eventId: string, email: string, name = "Ana Pérez") {
  testEventRegistration.registrations.seed({ id: `row-${email}`, eventId, mode: "unl", name, email, career: null, semester: null, createdAt: new Date() });
}

let event: Awaited<ReturnType<typeof addTestEvent>>;

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "admin-secret-admin-secret-admin-secret-1234");
  vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  event = await addTestEvent({ registrationMode: "unl", registrationCapacity: 2 });
});

describe("cancelEventRegistration requires a forum member", () => {
  it("opens with the member guard", () => {
    const source = readFileSync(ACTIONS_PATH, "utf8");
    const bodies = [...source.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{\s*try \{\s*([^\n]*)\n/g)];

    expect(bodies.map(([, name]) => name)).toEqual(["cancelEventRegistration"]);
    expect(bodies[0]![2]).toMatch(/^const member = await requireForumMember\(\);$/);
  });

  it.each([
    ["no cookie", {}],
    ["only an admin session", { [AUTH_COOKIE_NAME]: "ADMIN" }],
    ["an admin session planted in the forum cookie", { [FORUM_COOKIE_NAME]: "ADMIN" }],
  ])("is refused with %s: nothing deleted", async (_label, cookies) => {
    reserved(event.id, "ana@unl.edu.ec");
    jar(Object.fromEntries(await Promise.all(Object.entries(cookies).map(async ([key, who]) => [key, await signInAs(who as "ADMIN")]))));

    const before = stored();

    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual(CANCELLATION_SESSION_EXPIRED_RESULT);
    expect(stored()).toEqual(before);
  });
});

describe("cancelEventRegistration", () => {
  it("deletes the signed-in member's own registration, frees the seat and refreshes the page; the others stay", async () => {
    reserved(event.id, "ana@unl.edu.ec");
    reserved(event.id, "luis@unl.edu.ec", "Luis");
    await signIn({ id: "m1", email: "ana@unl.edu.ec" });

    expect(await testEventRegistration.registrations.count(event.id)).toBe(2);
    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual({ success: true });
    expect(stored().map((row) => row.email)).toEqual(["luis@unl.edu.ec"]);
    expect(await testEventRegistration.registrations.count(event.id)).toBe(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/inscripciones/taller-de-git");
  });

  it("takes nothing from the caller: another member's registration is never touched, and a member with none just hears so", async () => {
    reserved(event.id, "ana@unl.edu.ec");
    await signIn({ id: "m2", email: "luis@unl.edu.ec", googleSub: "sub-2" });

    const before = stored();

    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual({ error: "Usted no tiene una inscripción en este evento." });
    expect(stored()).toEqual(before);
    expect(revalidatePathMock).toHaveBeenCalledWith("/inscripciones/taller-de-git");
  });

  it("says so the second time and changes nothing", async () => {
    reserved(event.id, "ana@unl.edu.ec");
    reserved(event.id, "luis@unl.edu.ec", "Luis");
    await signIn({ id: "m1", email: "ana@unl.edu.ec" });
    await cancellation.cancelEventRegistration("taller-de-git");

    const before = stored();

    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual({ error: "Usted no tiene una inscripción en este evento." });
    expect(stored()).toEqual(before);
  });

  it("refuses a suspended member (the guard no longer accepts their session) and an email outside the institutional domain, deleting nothing", async () => {
    reserved(event.id, "ana@unl.edu.ec");
    reserved(event.id, "ana@gmail.com");

    const before = stored();

    await signIn({ id: "m1", email: "ana@unl.edu.ec", status: "SUSPENDED" });
    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual(CANCELLATION_SESSION_EXPIRED_RESULT);

    await signIn({ id: "m2", email: "ana@gmail.com", googleSub: "sub-2" });
    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual({ error: "Su cuenta no puede cancelar cupos. Use su cuenta institucional @unl.edu.ec." });
    expect(stored()).toEqual(before);
  });

  it("D5: an expired session is told in registration words, flagged so the screen offers the sign-in; never as the forum", async () => {
    jar({});

    const expired = await cancellation.cancelEventRegistration("taller-de-git");

    expect(expired).toEqual({ error: "Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para cancelar su inscripción.", sessionExpired: true });
    expect(expired.error).not.toMatch(/foro/i);
  });

  it("says why when registration closed or the event is unknown, trashed or a draft, and the registration stays", async () => {
    const closed = await addTestEvent({ title: "Cerrado", registrationMode: "unl", registrationDeadline: new Date("2020-01-01T00:00:00.000Z") });
    const draft = await addTestEvent({ title: "Borrador", registrationMode: "unl", isPublished: false });
    const trashed = await addTestEvent({ title: "Papelera", registrationMode: "unl" });

    for (const other of [closed, draft, trashed]) reserved(other.id, "ana@unl.edu.ec");

    await testEventRegistration.events.trash(trashed.id);
    await signIn({ id: "m1", email: "ana@unl.edu.ec" });

    const before = stored();

    expect(await cancellation.cancelEventRegistration("cerrado")).toEqual({
      error: "Las inscripciones de este evento ya cerraron, así que ya no se puede cancelar desde aquí. Si no podrá asistir, escriba a la directiva de ASO.",
    });
    expect(await cancellation.cancelEventRegistration("borrador")).toEqual({ error: "No se encontró el evento." });
    expect(await cancellation.cancelEventRegistration("papelera")).toEqual({ error: "No se encontró el evento." });
    expect(await cancellation.cancelEventRegistration("nada")).toEqual({ error: "No se encontró el evento." });
    expect(stored()).toEqual(before);
  });

  it("never says foro, and an unexpected failure is the generic message with nothing deleted", async () => {
    reserved(event.id, "ana@unl.edu.ec");
    await signIn({ id: "m1", email: "ana@unl.edu.ec" });
    vi.spyOn(testEventRegistration.registrations, "cancel").mockRejectedValue(new Error("boom"));

    const result = await cancellation.cancelEventRegistration("taller-de-git");

    expect(result).toEqual({ error: "Ocurrió un error inesperado. Intente nuevamente." });
    expect(stored()).toHaveLength(1);
  });
});

/*
 * D7 (T10b): a self-cancellation from the event page leaves one audit entry with no personal data. The member is not an
 * admin, so the actor is the system; the summary says the person cancelled it and through the event page.
 */
describe("cancelEventRegistration: audit", () => {
  const entries = () => testAuth.audit.entries;

  it("writes one entry for the event, by the system, saying the person cancelled it from the event page, and no personal data", async () => {
    reserved(event.id, "ana@unl.edu.ec", "Ana Pérez");
    reserved(event.id, "luis@unl.edu.ec", "Luis");
    await signIn({ id: "m1", email: "ana@unl.edu.ec", displayName: "Ana Foro" });
    const before = new Date();

    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual({ success: true });
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toEqual({
      id: expect.any(String),
      at: expect.any(Date),
      actorUserId: null,
      actorKind: "system",
      action: "event.registration_cancel",
      entityType: "event",
      entityId: event.id,
      summary: "Inscripción cancelada por la persona (página del evento)",
    });
    expect(entries()[0]!.at.getTime()).toBeGreaterThanOrEqual(before.getTime());

    const written = JSON.stringify(entries());

    for (const secret of ["Ana", "Pérez", "ana@unl.edu.ec", "unl.edu.ec", "row-ana", "m1"]) {
      expect(written, secret).not.toContain(secret);
    }
  });

  it("writes nothing when the member has no registration, the second time, or for any refusal; rows stay", async () => {
    const closed = await addTestEvent({ title: "Cerrado", registrationMode: "unl", registrationDeadline: new Date("2020-01-01T00:00:00.000Z") });
    const draft = await addTestEvent({ title: "Borrador", registrationMode: "unl", isPublished: false });

    reserved(event.id, "ana@unl.edu.ec");
    reserved(closed.id, "ana@unl.edu.ec");
    reserved(draft.id, "ana@unl.edu.ec");
    await signIn({ id: "m2", email: "luis@unl.edu.ec", googleSub: "sub-2" });

    const before = stored();

    await cancellation.cancelEventRegistration("taller-de-git");
    await signIn({ id: "m1", email: "ana@unl.edu.ec" });
    await cancellation.cancelEventRegistration("cerrado");
    await cancellation.cancelEventRegistration("borrador");
    await cancellation.cancelEventRegistration("nada");
    expect(entries()).toEqual([]);
    expect(stored()).toEqual(before);

    await cancellation.cancelEventRegistration("taller-de-git");
    expect(entries()).toHaveLength(1);
    await cancellation.cancelEventRegistration("taller-de-git");
    expect(entries()).toHaveLength(1);
  });

  it("writes nothing for a caller without a valid member session or when the delete fails", async () => {
    reserved(event.id, "ana@unl.edu.ec");
    jar({});
    await cancellation.cancelEventRegistration("taller-de-git");

    await signIn({ id: "m1", email: "ana@unl.edu.ec" });
    vi.spyOn(testEventRegistration.registrations, "cancel").mockRejectedValue(new Error("boom"));
    await cancellation.cancelEventRegistration("taller-de-git");

    expect(entries()).toEqual([]);
    expect(stored()).toHaveLength(1);
  });

  it("still tells the member it worked when the audit write fails", async () => {
    reserved(event.id, "ana@unl.edu.ec");
    await signIn({ id: "m1", email: "ana@unl.edu.ec" });
    testAuth.audit.failWith = new Error("audit down");

    expect(await cancellation.cancelEventRegistration("taller-de-git")).toEqual({ success: true });
    expect(stored()).toEqual([]);
  });
});
