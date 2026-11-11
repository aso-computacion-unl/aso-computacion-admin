import { describe, expect, it } from "vitest";

import { cancellationRefusal, REGISTRATION_CANCEL_TTL_MS, type RegistrableEvent } from "@/domain/event-registration";

/*
 * D7 (R2, R4, R6): who may cancel a registration, as a function of the event alone. The person is proven elsewhere
 * (a signed link, or the UNL member), and the registration being there is the repository's to see.
 */
const NOW = new Date("2026-11-20T15:00:00.000Z");
const event = (overrides: Partial<RegistrableEvent> = {}): RegistrableEvent => ({
  isPublished: true,
  publishAt: null,
  unpublishAt: null,
  date: "2026-11-28",
  datePrecision: "day",
  registrationMode: "open",
  registrationCapacity: 10,
  registrationDeadline: null,
  ...overrides,
});

describe("cancellationRefusal", () => {
  it("lets a registration be cancelled while the event is public and registration has not closed", () => {
    expect(cancellationRefusal({ event: event(), now: NOW })).toBeNull();
  });

  it("does not depend on the mode or the seats: a full event, or one switched to another mode, still lets people go", () => {
    expect(cancellationRefusal({ event: event({ registrationMode: "unl", registrationCapacity: 1 }), now: NOW })).toBeNull();
    expect(cancellationRefusal({ event: event({ registrationMode: "none", registrationCapacity: null }), now: NOW })).toBeNull();
  });

  it("is not_found for an event that is not public (draft, withdrawn, not yet published)", () => {
    expect(cancellationRefusal({ event: event({ isPublished: false }), now: NOW })).toBe("not_found");
    expect(cancellationRefusal({ event: event({ unpublishAt: new Date(NOW.getTime() - 1000) }), now: NOW })).toBe("not_found");
    expect(cancellationRefusal({ event: event({ publishAt: new Date(NOW.getTime() + 1000) }), now: NOW })).toBe("not_found");
  });

  it("is closed once the deadline instant passes, and once the event day is over", () => {
    expect(cancellationRefusal({ event: event({ registrationDeadline: new Date(NOW.getTime() - 1) }), now: NOW })).toBe("closed");
    expect(cancellationRefusal({ event: event({ registrationDeadline: new Date(NOW.getTime() + 1) }), now: NOW })).toBeNull();
    expect(cancellationRefusal({ event: event({ date: "2026-11-19" }), now: NOW })).toBe("closed");
    expect(cancellationRefusal({ event: event({ date: "2026-11-20" }), now: NOW })).toBeNull();
  });

  it("says not_found before closed", () => {
    expect(cancellationRefusal({ event: event({ isPublished: false, date: "2020-01-01" }), now: NOW })).toBe("not_found");
  });

  it("gives a cancellation link a year to live", () => {
    expect(REGISTRATION_CANCEL_TTL_MS).toBe(365 * 24 * 60 * 60 * 1000);
  });
});
