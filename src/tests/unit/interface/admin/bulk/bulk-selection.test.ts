import { describe, expect, it } from "vitest";

import { doneMessage, OPERATIONS, selectAll, settle, toggle } from "@/interface/admin/bulk/bulk-selection";

describe("toggle", () => {
  it("adds an id that is not selected and removes one that is, without touching the original", () => {
    const original = new Set(["a"]);

    expect([...toggle(original, "b")]).toEqual(["a", "b"]);
    expect([...toggle(original, "a")]).toEqual([]);
    expect([...original]).toEqual(["a"]);
  });
});

describe("selectAll", () => {
  it("selects every id of the page, or none", () => {
    expect([...selectAll(["a", "b"], true)]).toEqual(["a", "b"]);
    expect(selectAll(["a", "b"], false).size).toBe(0);
  });
});

describe("settle", () => {
  it("clears what worked and keeps what failed selected, so it can be retried", () => {
    const outcome = settle(new Set(["a", "b", "c"]), [
      { id: "a", ok: true },
      { id: "b", ok: false, error: "No se encontró el evento o la foto." },
      { id: "c", ok: true },
    ]);

    expect([...outcome.remaining]).toEqual(["b"]);
    expect(outcome.okCount).toBe(2);
    expect(outcome.failures).toEqual([{ id: "b", error: "No se encontró el evento o la foto." }]);
  });

  it("gives a failure the server did not explain a generic reason", () => {
    expect(settle(new Set(["a"]), [{ id: "a", ok: false }]).failures).toEqual([{ id: "a", error: "No se pudo completar." }]);
  });

  it("keeps ids it got no result for", () => {
    expect([...settle(new Set(["a", "z"]), [{ id: "a", ok: true }]).remaining]).toEqual(["z"]);
  });
});

describe("doneMessage", () => {
  it("counts in Spanish, singular and plural", () => {
    expect(doneMessage("publish", 1)).toBe("1 elemento publicado.");
    expect(doneMessage("publish", 3)).toBe("3 elementos publicados.");
    expect(doneMessage("unpublish", 1)).toBe("1 elemento pasado a borrador.");
    expect(doneMessage("unpublish", 2)).toBe("2 elementos pasados a borrador.");
    expect(doneMessage("trash", 4)).toBe("4 elementos movidos a la papelera.");
    expect(doneMessage("trash", 1)).toBe("1 elemento movido a la papelera.");
  });
});

describe("OPERATIONS", () => {
  it("asks for a confirmation that says how many items and what happens to them", () => {
    expect(OPERATIONS.trash.confirm(2)).toContain("2 elementos");
    expect(OPERATIONS.trash.confirm(2)).toContain("papelera");
    expect(OPERATIONS.publish.confirm(1)).toContain("1 elemento");
    expect(OPERATIONS.unpublish.confirm(5)).toContain("borrador");
  });
});
