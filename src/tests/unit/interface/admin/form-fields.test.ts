import { describe, expect, it } from "vitest";
import { z } from "zod";

import { checkbox, parseStrictForm, toFormData } from "@/interface/admin/form-fields";

const schema = z.strictObject({ name: z.string().trim(), flag: checkbox });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseStrictForm", () => {
  it("parses known fields and treats a missing checkbox as false", () => {
    expect(parseStrictForm(schema, form({ name: "  Ana " }))).toEqual({ name: "Ana", flag: false });
    expect(parseStrictForm(schema, form({ name: "Ana", flag: "on" }))).toEqual({ name: "Ana", flag: true });
  });

  it("rejects unknown fields instead of ignoring them", () => {
    expect(() => parseStrictForm(schema, form({ name: "Ana", phone: "0999" }))).toThrow(z.ZodError);
  });

  it("rejects a file where text is expected", () => {
    const data = form({});
    data.set("name", new File(["x"], "x.txt"));

    expect(() => parseStrictForm(schema, data)).toThrow(z.ZodError);
  });
});

describe("toFormData", () => {
  it("writes strings as they are and only the checked checkboxes as `on`", () => {
    const data = toFormData({ name: "Ana", on: true, off: false });

    expect([...data.entries()]).toEqual([
      ["name", "Ana"],
      ["on", "on"],
    ]);
  });
});
