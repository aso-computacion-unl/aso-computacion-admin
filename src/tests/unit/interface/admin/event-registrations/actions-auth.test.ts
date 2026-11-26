import { describe, expect, it, vi } from "vitest";

const { cookiesMock, getServicesMock, getEventUseCasesMock, revalidatePathMock, redirectMock, remove } = vi.hoisted(() => {
  const remove = { execute: vi.fn(async () => undefined) };
  const saved = () => ({ execute: vi.fn(async () => ({ id: "event-1", isPublished: false })) });
  const eventUseCases = {
    openRegistration: saved(),
    changeRegistration: saved(),
    get: { execute: vi.fn(async () => ({ id: "event-1", registrationMode: "unl", registrationCapacity: null })) },
    registeredCount: vi.fn(async () => 0),
  };

  return {
    cookiesMock: vi.fn(),
    getServicesMock: vi.fn(() => ({ remove })),
    getEventUseCasesMock: vi.fn(() => eventUseCases),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(() => {
      throw new Error("REDIRECT");
    }),
    remove,
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/public/event-registration-container", () => ({ getEventRegistrationServices: getServicesMock }));
vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: getEventUseCasesMock }));

import { NotFoundError } from "@/application";
import * as actions from "@/interface/admin/event-registrations/actions";
import { cookieJar, registerAdminActionAuthCases } from "@/tests/support/admin-action-auth";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const SUITE = {
  actionsPath: "src/interface/admin/event-registrations/actions.ts",
  actions,
  actionCalls: {
    deleteEventRegistration: () => actions.deleteEventRegistration("event-1", "registration-1"),
    openEventRegistration: () => actions.openEventRegistration("event-1", null, registrationForm()),
    updateEventRegistration: () => actions.updateEventRegistration("event-1", null, registrationForm()),
  },
  cookiesMock,
  untouchedMocks: [getServicesMock, getEventUseCasesMock, revalidatePathMock, redirectMock],
};

function registrationForm(): FormData {
  const form = new FormData();
  form.set("registrationMode", "open");
  form.set("registrationCapacity", "");
  form.set("registrationDeadline", "");
  return form;
}

describe("event registration server actions require a session; deleting takes an ADMIN", () => {
  registerAdminActionAuthCases(SUITE);
  registerPolicyCases(SUITE);

  it("deletes the registration of that event, refreshes the registrations screen and audits without any personal data", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    await expect(actions.deleteEventRegistration("event-1", "registration-1")).resolves.toEqual({ success: true });

    expect(remove.execute).toHaveBeenCalledWith({ eventId: "event-1", registrationId: "registration-1" });
    expect(revalidatePathMock.mock.calls).toEqual([["/admin/registrations"]]);
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

  it("audits opening and changing a registration on the event, like an event edit", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    await expect(actions.openEventRegistration("event-1", null, registrationForm())).rejects.toThrow("REDIRECT");
    await actions.updateEventRegistration("event-1", null, registrationForm());

    // Newest first, as the log lists them.
    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityType, entry.entityId, entry.summary])).toEqual([
      ["event.registration_update", "event", "event-1", "Inscripción de un evento editada"],
      ["event.registration_open", "event", "event-1", "Inscripción creada en un evento"],
    ]);
  });
});
