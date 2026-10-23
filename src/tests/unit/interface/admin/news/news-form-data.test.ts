import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseNewsFormData } from "@/interface/admin/news/news-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { title: " Taller de Git ", summary: " Resumen ", body: " Cuerpo " };

describe("parseNewsFormData", () => {
  it("trims the text, reads the publish checkbox and leaves the optional fields undefined", () => {
    expect(parseNewsFormData(form({ ...VALID, isPublished: "on" }))).toEqual({
      title: "Taller de Git",
      summary: "Resumen",
      body: "Cuerpo",
      slug: undefined,
      publishedAt: undefined,
      coverAlt: undefined,
      isPublished: true,
    });
  });

  it("an unchecked box is a draft", () => {
    expect(parseNewsFormData(form(VALID)).isPublished).toBe(false);
  });

  it("blank slug and date mean derive/keep, a filled one is passed through trimmed", () => {
    const blank = parseNewsFormData(form({ ...VALID, slug: "  ", publishedAt: "" }));
    const filled = parseNewsFormData(form({ ...VALID, slug: " git-2026 ", publishedAt: " 2026-03-14 " }));

    expect([blank.slug, blank.publishedAt]).toEqual([undefined, undefined]);
    expect([filled.slug, filled.publishedAt]).toEqual(["git-2026", "2026-03-14"]);
  });

  it("passes the cover alt through only when the form sends it", () => {
    expect(parseNewsFormData(form({ ...VALID, coverAlt: " Taller " })).coverAlt).toBe("Taller");
    expect(parseNewsFormData(form(VALID)).coverAlt).toBeUndefined();
  });

  it("keeps the body's Markdown and line breaks, turning the browser's CRLF into LF", () => {
    const body = parseNewsFormData(form({ ...VALID, body: "Uno **dos**\r\n\r\n- a\r\n- b\n[x](https://aso.test)" })).body;

    expect(body).toBe("Uno **dos**\n\n- a\n- b\n[x](https://aso.test)");
  });

  it("rejects missing required fields and unknown ones", () => {
    expect(() => parseNewsFormData(form({ title: "x" }))).toThrow(ZodError);
    expect(() => parseNewsFormData(form({ ...VALID, sortOrder: "0" }))).toThrow(ZodError);
    expect(() => parseNewsFormData(form({ ...VALID, cover: "x" }))).toThrow(ZodError);
  });
});
