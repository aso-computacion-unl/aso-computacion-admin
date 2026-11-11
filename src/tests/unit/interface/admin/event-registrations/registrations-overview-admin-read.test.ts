import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { getAdminRegistrationOverview } from "@/interface/admin/event-registrations/registrations-overview-admin-read";
import { cookieJar } from "@/tests/support/admin-action-auth";
import { signInAs } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");

  const event = await addTestEvent({ registrationCapacity: 10 });

  await testEventRegistration.registrations.register(
    { id: "r1", eventId: event.id, mode: "open", name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5, confirmedAt: new Date() },
    new Date(),
  );
});

describe("getAdminRegistrationOverview", () => {
  it("sends a visitor without a session to the login and returns nothing", async () => {
    cookieJar(cookiesMock, undefined);

    await expect(getAdminRegistrationOverview()).rejects.toThrow("REDIRECT /login");
  });

  it.each(["EDITOR", "ADMIN"] as const)("lets an %s see the counts of every event, with no personal data", async (role) => {
    cookieJar(cookiesMock, await signInAs(role));

    const overview = await getAdminRegistrationOverview();

    expect(overview.past).toEqual([]);
    expect(overview.upcoming).toEqual([expect.objectContaining({ title: "Taller de Git", mode: "open", capacity: 10, registered: 1, state: "open" })]);
    expect(JSON.stringify(overview)).not.toMatch(/Ana|ana@example\.com/);
  });
});
