import { describe, expect, it } from "vitest";

import { memberListHref, parseMemberListParams } from "@/interface/admin/forum/member-list-params";

describe("parseMemberListParams", () => {
  it("defaults to every member, no search, first page", () => {
    expect(parseMemberListParams({})).toEqual({ filter: "all", search: "", page: 1 });
  });

  it("reads the suspended filter, the search and the page", () => {
    expect(parseMemberListParams({ estado: "suspendidos", q: "  ana  ", pagina: "3" })).toEqual({ filter: "suspended", search: "ana", page: 3 });
  });

  it("reduces anything else to the defaults: unknown states, repeated or hostile values never error", () => {
    expect(parseMemberListParams({ estado: "todos", pagina: "0" })).toEqual({ filter: "all", search: "", page: 1 });
    expect(parseMemberListParams({ estado: ["suspendidos", "x"], q: ["a", "b"], pagina: ["2", "3"] })).toEqual({ filter: "suspended", search: "", page: 1 });
    expect(parseMemberListParams({ pagina: "-1" }).page).toBe(1);
    expect(parseMemberListParams({ pagina: "1e3" }).page).toBe(1);
  });
});

describe("memberListHref", () => {
  it("is the bare path for the plain list, and keeps the filter, the search and the page otherwise", () => {
    expect(memberListHref({ filter: "all", search: "", page: 1 })).toBe("/admin/foro/miembros");
    expect(memberListHref({ filter: "suspended", search: "", page: 1 })).toBe("/admin/foro/miembros?estado=suspendidos");
    expect(memberListHref({ filter: "all", search: "ana pérez", page: 2 })).toBe("/admin/foro/miembros?q=ana+p%C3%A9rez&pagina=2");
    expect(memberListHref({ filter: "suspended", search: "a", page: 3 })).toBe("/admin/foro/miembros?estado=suspendidos&q=a&pagina=3");
  });
});
