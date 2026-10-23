import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parsePillarFormData } from "@/interface/admin/pillars/pillar-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { word: " VOZ ", title: " Representamos ", text: " Texto " };

describe("parsePillarFormData", () => {
  it("trims the text and reads the publish checkbox", () => {
    expect(parsePillarFormData(form({ ...VALID, isPublished: "on" }))).toEqual({
      word: "VOZ",
      title: "Representamos",
      text: "Texto",
      isPublished: true,
    });
  });

  it("passes the image alt through only when the form sends it", () => {
    expect(parsePillarFormData(form({ ...VALID, imageAlt: " Charla " })).imageAlt).toBe("Charla");
    expect(parsePillarFormData(form(VALID)).imageAlt).toBeUndefined();
  });

  it("rejects missing required fields and unknown ones", () => {
    expect(() => parsePillarFormData(form({ word: "VOZ" }))).toThrow(ZodError);
    expect(() => parsePillarFormData(form({ ...VALID, sortOrder: "0" }))).toThrow(ZodError);
  });
});
