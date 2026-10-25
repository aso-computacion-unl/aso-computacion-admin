import { describe, expect, it } from "vitest";

import { filterHref, parseStatusFilter, statusCriteria } from "@/interface/admin/status-filter";

describe("parseStatusFilter", () => {
  it.each([
    ["publicados", "publicados"],
    ["borradores", "borradores"],
    ["todos", "todos"],
  ])("accepts %s", (raw, expected) => {
    expect(parseStatusFilter(raw)).toBe(expected);
  });

  it.each([undefined, "", "PUBLICADOS", "draft", "published", "publicados,borradores", "__proto__"])(
    "falls back to todos for %j",
    (raw) => {
      expect(parseStatusFilter(raw)).toBe("todos");
    },
  );

  it("uses todos when the param is repeated, instead of guessing which one counts", () => {
    expect(parseStatusFilter(["publicados", "borradores"])).toBe("todos");
  });
});

describe("statusCriteria", () => {
  it("maps each filter to the repository criteria", () => {
    expect(statusCriteria("publicados")).toEqual({ status: "published" });
    expect(statusCriteria("borradores")).toEqual({ status: "draft" });
  });

  it("applies no criteria to todos", () => {
    expect(statusCriteria("todos")).toEqual({});
  });
});

describe("filterHref", () => {
  it("keeps the bare path for todos, so the default has one URL", () => {
    expect(filterHref("/admin/events", "todos")).toBe("/admin/events");
  });

  it("puts the other filters in ?estado=", () => {
    expect(filterHref("/admin/news", "borradores")).toBe("/admin/news?estado=borradores");
    expect(filterHref("/admin/news", "publicados")).toBe("/admin/news?estado=publicados");
  });
});
