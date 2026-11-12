import { describe, expect, it } from "vitest";

import { registrationChangeImpacts, type RegistrationChangeInput } from "@/domain/event-registration";

/*
 * D14 (R8): changing the registration mode, or setting seats below the people already registered (confirmed ones
 * only), is a change that must be confirmed. Everything else is saved as it always was.
 */
const base = (over: Partial<RegistrationChangeInput> = {}): RegistrationChangeInput => ({
  registered: 12,
  current: { mode: "open", capacity: 30 },
  next: { mode: "open", capacity: 30 },
  ...over,
});

describe("registrationChangeImpacts", () => {
  it("is empty when nothing about registration changes, whatever the count", () => {
    expect(registrationChangeImpacts(base())).toEqual([]);
    expect(registrationChangeImpacts(base({ next: { capacity: undefined, mode: undefined } }))).toEqual([]);
  });

  it("is empty for any change at all while nobody is registered yet", () => {
    expect(registrationChangeImpacts(base({ registered: 0, next: { mode: "unl", capacity: 1 } }))).toEqual([]);
    expect(registrationChangeImpacts(base({ registered: 0, next: { mode: "none" } }))).toEqual([]);
  });

  it.each([
    ["open", "unl"],
    ["unl", "open"],
    ["open", "none"],
    ["unl", "none"],
  ] as const)("flags a mode change from %s to %s", (from, to) => {
    expect(registrationChangeImpacts(base({ current: { mode: from, capacity: null }, next: { mode: to } }))).toContain("mode");
  });

  it("flags turning registration on again when people are still stored from before", () => {
    expect(registrationChangeImpacts(base({ current: { mode: "none", capacity: null }, next: { mode: "open", capacity: null } }))).toEqual(["mode"]);
  });

  it("does not flag the same mode sent again", () => {
    expect(registrationChangeImpacts(base({ next: { mode: "open", capacity: 40 } }))).toEqual([]);
  });

  it("flags lowering the seats below the registered count, and only below it", () => {
    expect(registrationChangeImpacts(base({ next: { mode: "open", capacity: 11 } }))).toEqual(["seats"]);
    expect(registrationChangeImpacts(base({ next: { mode: "open", capacity: 1 } }))).toEqual(["seats"]);
    expect(registrationChangeImpacts(base({ next: { mode: "open", capacity: 12 } }))).toEqual([]);
    expect(registrationChangeImpacts(base({ next: { mode: "open", capacity: 13 } }))).toEqual([]);
  });

  it("flags going from unlimited to a number below the registered count", () => {
    expect(registrationChangeImpacts(base({ current: { mode: "open", capacity: null }, next: { mode: "open", capacity: 5 } }))).toEqual(["seats"]);
  });

  it("does not flag raising or keeping seats that are already below the count, nor clearing the limit", () => {
    const current = { mode: "open", capacity: 8 } as const;

    expect(registrationChangeImpacts(base({ current, next: { mode: "open", capacity: 8 } }))).toEqual([]);
    expect(registrationChangeImpacts(base({ current, next: { mode: "open", capacity: 10 } }))).toEqual([]);
    expect(registrationChangeImpacts(base({ current, next: { mode: "open", capacity: null } }))).toEqual([]);
    expect(registrationChangeImpacts(base({ current, next: { mode: "open", capacity: 6 } }))).toEqual(["seats"]);
  });

  it("keeps the current mode and seats when the form sent none of them (absent means leave as is)", () => {
    expect(registrationChangeImpacts(base({ next: { capacity: 3 } }))).toEqual(["seats"]);
    expect(registrationChangeImpacts(base({ next: { mode: "unl" } }))).toEqual(["mode"]);
  });

  it("flags both when the mode and the seats change together", () => {
    expect(registrationChangeImpacts(base({ next: { mode: "unl", capacity: 4 } }))).toEqual(["mode", "seats"]);
  });

  it("ignores seats when registration is switched off: there is no limit to lower, only the mode change", () => {
    expect(registrationChangeImpacts(base({ next: { mode: "none", capacity: 2 } }))).toEqual(["mode"]);
  });
});
