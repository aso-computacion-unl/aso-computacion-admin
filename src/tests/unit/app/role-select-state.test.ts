import { describe, expect, it } from "vitest";

import { choiceFromSelect, shownRole } from "../../../../app/admin/usuarios/_components/role-select-state";

describe("shownRole", () => {
  it("shows the pick while the change is in flight, so the select does not jump back", () => {
    expect(shownRole({ stored: "EDITOR", choice: "ADMIN", pending: true })).toBe("ADMIN");
  });

  it("shows the stored role once the action is over, whether it succeeded or was refused", () => {
    // Refused (the last admin): the stored role is unchanged, so the select goes back to it.
    expect(shownRole({ stored: "ADMIN", choice: "EDITOR", pending: false })).toBe("ADMIN");
    // Succeeded: the refreshed server value is the new role.
    expect(shownRole({ stored: "EDITOR", choice: "EDITOR", pending: false })).toBe("EDITOR");
  });

  it("shows the stored role when nothing was picked yet", () => {
    expect(shownRole({ stored: "EDITOR", choice: null, pending: true })).toBe("EDITOR");
  });
});

describe("choiceFromSelect", () => {
  it("accepts only a known role", () => {
    expect(choiceFromSelect("ADMIN")).toBe("ADMIN");
    expect(choiceFromSelect("EDITOR")).toBe("EDITOR");
    expect(choiceFromSelect("OWNER")).toBeNull();
    expect(choiceFromSelect("")).toBeNull();
    expect(choiceFromSelect("admin")).toBeNull();
  });
});
