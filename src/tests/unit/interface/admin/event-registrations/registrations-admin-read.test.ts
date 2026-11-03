import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { getAdminEventRegistrations } from "@/interface/admin/event-registrations/registrations-admin-read";
import { cookieJar } from "@/tests/support/admin-action-auth";
import { signInAs } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

let eventId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  eventId = (await addTestEvent({ registrationCapacity: 10 })).id;
  await testEventRegistration.registrations.register(
    { id: "r1", eventId, mode: "open", name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5 },
    new Date("2026-11-20T15:30:00.000Z"),
  );
});

describe("getAdminEventRegistrations", () => {
  it("sends a visitor without a session to the login and returns nothing", async () => {
    cookieJar(cookiesMock, undefined);

    await expect(getAdminEventRegistrations(eventId)).rejects.toThrow("REDIRECT /login");
  });

  it.each([
    ["EDITOR", false],
    ["ADMIN", true],
  ] as const)("lets an %s see the registrations; only an ADMIN may manage them (%s)", async (role, canManage) => {
    cookieJar(cookiesMock, await signInAs(role));

    const page = await getAdminEventRegistrations(eventId);

    expect(page).toMatchObject({ canManage, event: { title: "Taller de Git", registrationCapacity: 10 } });
    expect(page?.registrations.map((registration) => registration.email)).toEqual(["ana@example.com"]);
  });

  it("is null for an unknown event", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    expect(await getAdminEventRegistrations("ghost")).toBeNull();
  });
});
