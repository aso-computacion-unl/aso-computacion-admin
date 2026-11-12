import { beforeEach, describe, expect, it, vi } from "vitest";

const { useCases, pageSessionMock } = vi.hoisted(() => ({
  pageSessionMock: vi.fn(),
  useCases: { get: { execute: vi.fn() }, registeredCount: vi.fn() },
}));

vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: () => useCases }));
vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: pageSessionMock }));

import { NotFoundError } from "@/application";
import { getAdminEvent } from "@/interface/admin/events/events-admin-read";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminEvent", () => {
  it("adds the count of confirmed registrations to the event, for the edit form's warning (D14)", async () => {
    useCases.get.execute.mockResolvedValue({ id: "e1", title: "Taller", registrationMode: "open", photos: [] });
    useCases.registeredCount.mockResolvedValue(12);

    expect(await getAdminEvent("e1")).toEqual({ id: "e1", title: "Taller", registrationMode: "open", photos: [], registeredCount: 12 });
    expect(useCases.registeredCount).toHaveBeenCalledWith("e1");
    expect(pageSessionMock).toHaveBeenCalled();
  });

  it("is null for an event that does not exist, without counting anything, and lets other failures through", async () => {
    useCases.get.execute.mockRejectedValue(new NotFoundError("Event not found"));

    expect(await getAdminEvent("gone")).toBeNull();
    expect(useCases.registeredCount).not.toHaveBeenCalled();

    useCases.get.execute.mockRejectedValue(new Error("db down"));

    await expect(getAdminEvent("e1")).rejects.toThrow("db down");
  });
});
