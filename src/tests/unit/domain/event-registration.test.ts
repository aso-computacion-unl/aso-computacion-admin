import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { Event, type CreateEventInput } from "@/domain/event";
import {
  assertRegistrationSettings,
  parseOpenRegistration,
  registrationRefusal,
  type RegistrationContext,
} from "@/domain/event-registration";

const NOW = new Date("2026-11-20T15:00:00.000Z"); // 10:00 in Ecuador, 2026-11-20

function eventWith(overrides: Partial<CreateEventInput> = {}) {
  return Event.create({ title: "Taller de Git", date: "2026-11-28", isPublished: true, registrationMode: "open", ...overrides }).props;
}

function context(overrides: Partial<RegistrationContext> = {}): RegistrationContext {
  return { event: eventWith(), mode: "open", registered: 0, alreadyRegistered: false, now: NOW, ...overrides };
}

describe("registration settings", () => {
  it("defaults an event to no registration, without capacity or deadline", () => {
    expect(eventWith({ registrationMode: undefined }).registrationMode).toBe("none");
    expect(eventWith({ registrationMode: undefined })).toMatchObject({ registrationCapacity: null, registrationDeadline: null });
  });

  it("keeps a mode, a capacity and a deadline", () => {
    const deadline = new Date("2026-11-27T23:00:00.000Z");

    expect(eventWith({ registrationMode: "unl", registrationCapacity: 40, registrationDeadline: deadline })).toMatchObject({
      registrationMode: "unl",
      registrationCapacity: 40,
      registrationDeadline: deadline,
    });
  });

  it("refuses an unknown mode, a capacity that is not a positive whole number, and an invalid deadline", () => {
    expect(() => assertRegistrationSettings("both", null, null)).toThrow(ValidationError);
    expect(() => assertRegistrationSettings("open", 0, null)).toThrow(ValidationError);
    expect(() => assertRegistrationSettings("open", -3, null)).toThrow(ValidationError);
    expect(() => assertRegistrationSettings("open", 2.5, null)).toThrow(ValidationError);
    expect(() => assertRegistrationSettings("open", 5001, null)).toThrow(ValidationError);
    expect(() => assertRegistrationSettings("open", null, new Date("nope"))).toThrow(ValidationError);
  });

  it("drops capacity and deadline when the event takes no registration", () => {
    expect(assertRegistrationSettings("none", 40, new Date(NOW))).toEqual({ mode: "none", capacity: null, deadline: null });
  });

  it("survives an update that leaves the registration fields alone, and one that clears them", () => {
    const event = Event.create({ title: "Taller", registrationMode: "open", registrationCapacity: 10 });

    expect(event.update({ title: "Taller 2" }).props).toMatchObject({ registrationMode: "open", registrationCapacity: 10 });
    expect(event.update({ registrationCapacity: null }).props.registrationCapacity).toBeNull();
    expect(event.update({ registrationMode: "none" }).props).toMatchObject({ registrationMode: "none", registrationCapacity: null });
  });
});

describe("registrationRefusal", () => {
  it("lets a person register when everything is in order", () => {
    expect(registrationRefusal(context())).toBeNull();
  });

  it("treats a draft, a scheduled and an expired event as not found", () => {
    expect(registrationRefusal(context({ event: eventWith({ isPublished: false }) }))).toBe("not_found");
    expect(registrationRefusal(context({ event: eventWith({ publishAt: new Date("2026-11-21T00:00:00.000Z") }) }))).toBe("not_found");
    expect(registrationRefusal(context({ event: eventWith({ unpublishAt: new Date("2026-11-20T15:00:00.000Z") }) }))).toBe("not_found");
  });

  it("refuses a way of registering the event did not choose, and events without registration", () => {
    expect(registrationRefusal(context({ event: eventWith({ registrationMode: "unl" }) }))).toBe("mode_mismatch");
    expect(registrationRefusal(context({ event: eventWith({ registrationMode: "none" }) }))).toBe("mode_mismatch");
    expect(registrationRefusal(context({ event: eventWith({ registrationMode: "unl" }), mode: "unl" }))).toBeNull();
  });

  it("closes at the deadline, not after it", () => {
    const deadline = new Date("2026-11-20T15:00:00.000Z");
    const event = eventWith({ registrationDeadline: deadline });

    expect(registrationRefusal(context({ event, now: new Date(deadline.getTime() - 1) }))).toBeNull();
    expect(registrationRefusal(context({ event, now: deadline }))).toBe("closed");
  });

  it("closes once the event day has passed in Ecuador, even without a deadline", () => {
    const event = eventWith({ date: "2026-11-28" });

    expect(registrationRefusal(context({ event, now: new Date("2026-11-29T04:59:00.000Z") }))).toBeNull();
    expect(registrationRefusal(context({ event, now: new Date("2026-11-29T05:00:00.000Z") }))).toBe("closed");
  });

  it("does not close an event known only to the month, or without a date", () => {
    const later = new Date("2027-03-01T00:00:00.000Z");

    expect(registrationRefusal(context({ event: eventWith({ date: "2026-11-20", datePrecision: "month" }), now: later }))).toBeNull();
    expect(registrationRefusal(context({ event: eventWith({ date: null }), now: later }))).toBeNull();
  });

  it("refuses when the capacity is used up, and an unlimited event never fills", () => {
    const event = eventWith({ registrationCapacity: 2 });

    expect(registrationRefusal(context({ event, registered: 1 }))).toBeNull();
    expect(registrationRefusal(context({ event, registered: 2 }))).toBe("full");
    expect(registrationRefusal(context({ event, registered: 3 }))).toBe("full");
    expect(registrationRefusal(context({ registered: 100_000 }))).toBeNull();
  });

  it("tells a person who is already in that they are, even when the event is full", () => {
    const event = eventWith({ registrationCapacity: 1 });

    expect(registrationRefusal(context({ event, registered: 1, alreadyRegistered: true }))).toBe("duplicate");
  });
});

describe("parseOpenRegistration", () => {
  const valid = { name: "  Ana   María Pérez ", email: " Ana.Perez@Example.COM ", career: " Computación ", semester: "5" };

  it("trims, collapses spaces and lower-cases the email", () => {
    expect(parseOpenRegistration(valid)).toEqual({ name: "Ana María Pérez", email: "ana.perez@example.com", career: "Computación", semester: 5 });
  });

  it("accepts a numeric semester", () => {
    expect(parseOpenRegistration({ ...valid, semester: 12 }).semester).toBe(12);
  });

  it.each([
    ["name", { name: "" }],
    ["name", { name: "x".repeat(121) }],
    ["name", { name: "Ana\u0000" }],
    ["name", { name: 42 }],
    ["email", { email: "not-an-email" }],
    ["email", { email: `${"a".repeat(250)}@x.co` }],
    ["career", { career: "" }],
    ["career", { career: "c".repeat(121) }],
    ["semester", { semester: "0" }],
    ["semester", { semester: "13" }],
    ["semester", { semester: "2.5" }],
    ["semester", { semester: "dos" }],
    ["semester", { semester: undefined }],
  ])("refuses an invalid %s", (field, override) => {
    expect(() => parseOpenRegistration({ ...valid, ...override })).toThrow(expect.objectContaining({ name: "ValidationError", field }));
  });
});
