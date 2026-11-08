import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { exportEventRegistrationsCsv } from "@/interface/admin/event-registrations/registrations-export";
import { cookieJar } from "@/tests/support/admin-action-auth";
import { signInAs, testAuth } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

let eventId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  eventId = (await addTestEvent()).id;
  await testEventRegistration.registrations.register(
    { id: "r1", eventId, mode: "open", name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5, confirmedAt: new Date("2026-11-20T15:30:00.000Z") },
    new Date("2026-11-20T15:30:00.000Z"),
  );
});

describe("exportEventRegistrationsCsv (ADMIN only)", () => {
  it("answers 401 without a session, 403 to an EDITOR, and neither leaks a row nor writes an audit entry", async () => {
    cookieJar(cookiesMock, undefined);
    const anonymous = await exportEventRegistrationsCsv(eventId);

    cookieJar(cookiesMock, await signInAs("EDITOR"));
    const editor = await exportEventRegistrationsCsv(eventId);

    expect([anonymous.status, editor.status]).toEqual([401, 403]);
    expect(await anonymous.text()).not.toContain("ana@example.com");
    expect(await editor.text()).not.toContain("ana@example.com");
    expect(testAuth.audit.entries).toEqual([]);
  });

  it("gives an ADMIN a CSV download, never cached, and audits the export without any email or name", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    const response = await exportEventRegistrationsCsv(eventId);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="inscripciones-taller-de-git.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toContain('"Ana Pérez","ana@example.com","Formulario abierto","Computación","5"');
    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityType, entry.entityId, entry.actorUserId])).toEqual([["event.registrations_export", "event", eventId, "test-admin"]]);
    expect(testAuth.audit.entries[0]!.summary).toBe("Inscripciones exportadas (1)");
    expect(JSON.stringify(testAuth.audit.entries)).not.toMatch(/ana|example\.com|Pérez/i);
  });

  it("answers 404 for an unknown event, and still writes no audit entry", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    expect((await exportEventRegistrationsCsv("ghost")).status).toBe(404);
    expect(testAuth.audit.entries).toEqual([]);
  });

  it("still delivers the file when the audit write fails", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));
    testAuth.audit.failWith = new Error("db down");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await exportEventRegistrationsCsv(eventId)).status).toBe(200);
  });
});
