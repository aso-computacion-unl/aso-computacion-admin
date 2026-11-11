import { describe, expect, it } from "vitest";

import { registrationChangeKey, registrationChangeOfForm, registrationChangeText, registrationChangeWarning } from "@/interface/admin/events/registration-change";

/* D14 (R8): the question asked before a save that changes the mode or sets seats below the registered people. */
describe("registrationChangeWarning", () => {
  it("opens with how many are registered and names the consequence of switching registration off", () => {
    const warning = registrationChangeWarning({ registered: 12, impacts: ["mode"], next: { mode: "none", capacity: null } });

    expect(warning.title).toBe("Este evento ya tiene 12 inscritos.");
    expect(warning.consequences).toHaveLength(1);
    expect(warning.consequences[0]).toMatch(/Si quita la inscripción/);
    expect(warning.consequences[0]).toMatch(/se conservan/);
    expect(warning.consequences[0]).toMatch(/recordatorio/);
  });

  it("names the consequence of moving to a UNL account and to the open form, saying the registered keep their seat", () => {
    const unl = registrationChangeWarning({ registered: 3, impacts: ["mode"], next: { mode: "unl", capacity: null } });
    const open = registrationChangeWarning({ registered: 3, impacts: ["mode"], next: { mode: "open", capacity: null } });

    expect(unl.consequences[0]).toMatch(/Cuenta UNL/);
    expect(unl.consequences[0]).toMatch(/conservan su cupo/);
    expect(open.consequences[0]).toMatch(/Formulario abierto/);
    expect(open.consequences[0]).toMatch(/conservan su cupo/);
  });

  it("says nobody loses their seat but the event is full, when seats go below the registered", () => {
    const warning = registrationChangeWarning({ registered: 12, impacts: ["seats"], next: { mode: "open", capacity: 5 } });

    expect(warning.title).toBe("Este evento ya tiene 12 inscritos.");
    expect(warning.consequences).toHaveLength(1);
    expect(warning.consequences[0]).toMatch(/5 cupos/);
    expect(warning.consequences[0]).toMatch(/agotado/);
    expect(warning.consequences[0]).toMatch(/nadie pierde su cupo/);
  });

  it("uses the singular for one person and one seat", () => {
    const warning = registrationChangeWarning({ registered: 1, impacts: ["mode", "seats"], next: { mode: "unl", capacity: 1 } });

    // One registered person with one seat is not below it, but the mode change is still worth asking about.
    expect(warning.title).toBe("Este evento ya tiene 1 inscrito.");
    expect(warning.consequences).toHaveLength(2);
    expect(warning.consequences[1]).toMatch(/1 cupo\b/);
  });

  it("gives the consequences of a mode change and of the seats together, in that order", () => {
    const warning = registrationChangeWarning({ registered: 12, impacts: ["mode", "seats"], next: { mode: "unl", capacity: 4 } });

    expect(warning.consequences).toHaveLength(2);
    expect(warning.consequences[0]).toMatch(/Cuenta UNL/);
    expect(warning.consequences[1]).toMatch(/4 cupos/);
  });
});

describe("registrationChangeText", () => {
  it("is the one message the server answers with when the change was not confirmed", () => {
    const text = registrationChangeText({ registered: 12, impacts: ["seats"], next: { mode: "open", capacity: 5 } });

    expect(text.startsWith("Este evento ya tiene 12 inscritos.")).toBe(true);
    expect(text).toMatch(/agotado/);
    expect(text.endsWith("Confirme el cambio para guardarlo.")).toBe(true);
  });
});

describe("registrationChangeOfForm", () => {
  const stored = { registrationMode: "open", registrationCapacity: "30" } as const;

  it("warns, with a key that names the change, when the form would change the mode or lower the seats below the registered", () => {
    const mode = registrationChangeOfForm(12, stored, { registrationMode: "unl", registrationCapacity: "30" });
    const seats = registrationChangeOfForm(12, stored, { registrationMode: "open", registrationCapacity: "5" });

    expect(mode.warning?.title).toBe("Este evento ya tiene 12 inscritos.");
    expect(seats.warning?.consequences[0]).toMatch(/5 cupos/);
    expect(new Set([mode.key, seats.key]).size).toBe(2);
  });

  it("does not warn for no change, for nobody registered, or for seats that are not a number yet", () => {
    expect(registrationChangeOfForm(12, stored, stored).warning).toBeNull();
    expect(registrationChangeOfForm(0, stored, { registrationMode: "none", registrationCapacity: "" }).warning).toBeNull();
    expect(registrationChangeOfForm(12, stored, { registrationMode: "open", registrationCapacity: "abc" }).warning).toBeNull();
  });

  it("gives the same key to the same settings however the blank seats are written, and ignores the hidden seats of a form with no registration", () => {
    expect(registrationChangeKey({ registrationMode: "open", registrationCapacity: " 5 " })).toBe(registrationChangeKey({ registrationMode: "open", registrationCapacity: "5" }));
    expect(registrationChangeKey({ registrationMode: "none", registrationCapacity: "9" })).toBe(registrationChangeKey({ registrationMode: "none", registrationCapacity: "" }));
  });
});
