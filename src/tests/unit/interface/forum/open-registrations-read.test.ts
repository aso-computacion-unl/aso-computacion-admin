import { beforeEach, describe, expect, it, vi } from "vitest";

const { servicesMock } = vi.hoisted(() => ({ servicesMock: vi.fn() }));

vi.mock("@/interface/public/event-registration-container", () => ({ getEventRegistrationServices: servicesMock }));
vi.mock("@/interface/forum/require-forum-member", () => ({ getForumMember: vi.fn() }));

import { getOpenRegistrationEvents } from "@/interface/forum/event-registration-read";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("getOpenRegistrationEvents", () => {
  it("returns what the use case lists", async () => {
    const events = [{ slug: "taller", title: "Taller", date: "2099-11-28", datePrecision: "day", capacity: null, seatsLeft: null }];
    servicesMock.mockReturnValue({ openUnl: { execute: vi.fn().mockResolvedValue(events) } });

    expect(await getOpenRegistrationEvents()).toEqual(events);
  });

  it("degrades to no events when the read fails, so the forum home still opens, and logs the failure", async () => {
    servicesMock.mockReturnValue({ openUnl: { execute: vi.fn().mockRejectedValue(new Error("db down")) } });

    expect(await getOpenRegistrationEvents()).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
