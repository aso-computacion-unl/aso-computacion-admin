import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, revalidatePathMock, redirectMock, requestSiteRebuildMock, useCases } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  requestSiteRebuildMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
  useCases: {
    changeRegistration: { execute: vi.fn() },
    get: { execute: vi.fn() },
    registeredCount: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: () => useCases }));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));

import { updateEventRegistration } from "@/interface/admin/event-registrations/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const SETTINGS = { registrationMode: "open", registrationCapacity: "40", registrationDeadline: "2099-11-27T18:00" };
// 18:00 in Ecuador (UTC-5) is 23:00 UTC.
const PARSED = { registrationMode: "open", registrationCapacity: 40, registrationDeadline: new Date("2099-11-27T23:00:00.000Z") };

beforeEach(() => {
  vi.clearAllMocks();
  requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "EDITOR" });
  useCases.changeRegistration.execute.mockResolvedValue({ id: "e1", isPublished: false });
  useCases.get.execute.mockResolvedValue({ id: "e1", registrationMode: "unl", registrationCapacity: 10 });
  useCases.registeredCount.mockResolvedValue(0);
});

describe("updateEventRegistration", () => {
  it("changes the settings only and stays on the page with the saved result", async () => {
    expect(await updateEventRegistration("e1", null, form(SETTINGS))).toEqual({ success: true });

    expect(useCases.changeRegistration.execute).toHaveBeenCalledWith({ eventId: "e1", ...PARSED });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/registrations");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events/e1/edit");
  });

  it("rebuilds the landing for a published event, not for a draft", async () => {
    await updateEventRegistration("e1", null, form(SETTINGS));
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();

    useCases.changeRegistration.execute.mockResolvedValueOnce({ id: "e1", isPublished: true });
    await updateEventRegistration("e1", null, form(SETTINGS));
    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
  });

  it("D14: refuses a mode change of an event with registered people without the confirmation, and stores nothing", async () => {
    useCases.registeredCount.mockResolvedValue(3);

    const result = await updateEventRegistration("e1", null, form(SETTINGS));

    expect(result.error).toMatch(/^Este evento ya tiene 3 inscritos\. .*Confirme el cambio para guardarlo\.$/);
    expect(useCases.changeRegistration.execute).not.toHaveBeenCalled();
  });

  it("D14: saves the same change once the form carries the confirmation", async () => {
    useCases.registeredCount.mockResolvedValue(3);

    expect(await updateEventRegistration("e1", null, form({ ...SETTINGS, confirmRegistrationChange: "on" }))).toEqual({ success: true });
    expect(useCases.changeRegistration.execute).toHaveBeenCalledWith({ eventId: "e1", ...PARSED });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
