import { beforeEach, describe, expect, it, vi } from "vitest";

const { servicesMock } = vi.hoisted(() => ({ servicesMock: vi.fn() }));

vi.mock("@/interface/public/event-registration-container", () => ({ getEventRegistrationServices: servicesMock }));
vi.mock("@/interface/forum/require-forum-member", () => ({ getForumMember: vi.fn() }));

import { getOpenRegistrationEvents } from "@/interface/forum/event-registration-read";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOpenRegistrationEvents", () => {
  it("returns what the use case lists, UNL and open events alike, for the given moment", async () => {
    const events = [
      { slug: "taller", title: "Taller", mode: "unl", date: "2099-11-28", datePrecision: "day", capacity: null, seatsLeft: null },
      { slug: "charla", title: "Charla", mode: "open", date: "2099-12-05", datePrecision: "day", capacity: 30, seatsLeft: 12 },
    ];
    const execute = vi.fn().mockResolvedValue(events);
    const now = new Date("2099-11-01T00:00:00Z");
    servicesMock.mockReturnValue({ openRegistrations: { execute } });

    expect(await getOpenRegistrationEvents(now)).toEqual(events);
    expect(execute).toHaveBeenCalledWith({ now });
  });

  it("lets a failed read fail: the page is the list, so an empty one would say nothing is open when it could not be read", async () => {
    servicesMock.mockReturnValue({ openRegistrations: { execute: vi.fn().mockRejectedValue(new Error("db down")) } });

    await expect(getOpenRegistrationEvents()).rejects.toThrow("db down");
  });
});
