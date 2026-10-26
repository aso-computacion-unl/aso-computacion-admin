import { describe, expect, it } from "vitest";

import { listCriteria, listHref, MAX_PAGE, PAGE_SIZE, parseListParams, parsePage, parseSearch, SEARCH_MAX_LENGTH } from "@/interface/admin/list-params";

describe("parseSearch", () => {
  it("trims the text and collapses inner whitespace", () => {
    expect(parseSearch("  taller   de   git  ")).toBe("taller de git");
  });

  it.each([undefined, "", "   ", "\t\n"])("treats %j as no search", (raw) => {
    expect(parseSearch(raw)).toBe("");
  });

  it("ignores a repeated param instead of guessing which one counts", () => {
    expect(parseSearch(["git", "docker"])).toBe("");
  });

  it("cuts the text at the maximum length", () => {
    expect(parseSearch("a".repeat(SEARCH_MAX_LENGTH + 40))).toHaveLength(SEARCH_MAX_LENGTH);
  });

  it("drops control characters", () => {
    expect(parseSearch("ta\u0000ller\u0007")).toBe("taller");
  });

  it("keeps SQL wildcards as plain text: the repository decides how to match", () => {
    expect(parseSearch("100%_")).toBe("100%_");
  });
});

describe("parsePage", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["37", 37],
  ])("accepts %s", (raw, expected) => {
    expect(parsePage(raw)).toBe(expected);
  });

  it.each([undefined, "", "0", "-1", "abc", "1.5", "2e3", " 2", "2 ", "+3", "0x10", "NaN", "Infinity", "__proto__"])("falls back to page 1 for %j", (raw) => {
    expect(parsePage(raw)).toBe(1);
  });

  it("uses page 1 when the param is repeated", () => {
    expect(parsePage(["2", "3"])).toBe(1);
  });

  it("caps an absurd page number, so the offset can never overflow", () => {
    expect(parsePage("99999999999999999999")).toBe(MAX_PAGE);
    expect(parsePage(String(MAX_PAGE + 1))).toBe(MAX_PAGE);
  });
});

describe("parseListParams", () => {
  it("reads q and pagina from the search params", () => {
    expect(parseListParams({ q: " git ", pagina: "3" })).toEqual({ search: "git", page: 3 });
  });

  it("defaults to no search and the first page", () => {
    expect(parseListParams({})).toEqual({ search: "", page: 1 });
  });
});

describe("listCriteria", () => {
  it("composes the status filter with the search for the repository", () => {
    expect(listCriteria("publicados", "git")).toEqual({ status: "published", search: "git" });
    expect(listCriteria("borradores", "")).toEqual({ status: "draft" });
    expect(listCriteria("todos", "git")).toEqual({ search: "git" });
    expect(listCriteria("todos", "")).toEqual({});
  });
});

describe("listHref", () => {
  it("is the bare path for the defaults, so the unfiltered list has a single URL", () => {
    expect(listHref("/admin/events", {})).toBe("/admin/events");
    expect(listHref("/admin/events", { filter: "todos", search: "", page: 1 })).toBe("/admin/events");
  });

  it("composes the status filter, the search and the page in a fixed order", () => {
    expect(listHref("/admin/news", { filter: "borradores", search: "git", page: 2 })).toBe("/admin/news?estado=borradores&q=git&pagina=2");
  });

  it("encodes the search text", () => {
    expect(listHref("/admin/faqs", { search: "a&b=c d" })).toBe("/admin/faqs?q=a%26b%3Dc+d");
  });
});

describe("page size", () => {
  it("is a fixed, reasonable number", () => {
    expect(PAGE_SIZE).toBe(20);
  });
});
