import { describe, expect, it, vi } from "vitest";

const { cookiesMock, getServicesMock, revalidatePathMock, remove } = vi.hoisted(() => {
  const remove = { execute: vi.fn(async () => undefined) };

  return { cookiesMock: vi.fn(), getServicesMock: vi.fn(() => ({ remove })), revalidatePathMock: vi.fn(), remove };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/interface/public/event-registration-container", () => ({ getEventRegistrationServices: getServicesMock }));

import { NotFoundError } from "@/application";
import * as actions from "@/interface/admin/event-registrations/actions";
import { cookieJar, registerAdminActionAuthCases } from "@/tests/support/admin-action-auth";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const SUITE = {
  actionsPath: "src/interface/admin/event-registrations/actions.ts",
  actions,
  actionCalls: { deleteEventRegistration: () => actions.deleteEventRegistration("event-1", "registration-1") },
  cookiesMock,
  untouchedMocks: [getServicesMock, revalidatePathMock],
};

describe("event registration server actions require a session and an ADMIN", () => {
  registerAdminActionAuthCases(SUITE);
  registerPolicyCases(SUITE);

  it("deletes the registration of that event, refreshes its page and audits without any personal data", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    await expect(actions.deleteEventRegistration("event-1", "registration-1")).resolves.toEqual({ success: true });

    expect(remove.execute).toHaveBeenCalledWith({ eventId: "event-1", registrationId: "registration-1" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events/event-1/registrations");
    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityType, entry.entityId, entry.summary])).toEqual([
      ["event.registration_delete", "event", "event-1", "Inscripción eliminada de un evento"],
    ]);
  });

  it("says so when the registration is already gone, and audits nothing", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));
    remove.execute.mockRejectedValueOnce(new NotFoundError("Registration not found"));

    expect(await actions.deleteEventRegistration("event-1", "gone")).toEqual({ error: "No se encontró la inscripción." });
    expect(testAuth.audit.entries).toEqual([]);
  });
});
