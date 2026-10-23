import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseSocialLinkFormData } from "@/interface/admin/socials/social-form-data";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { platform: "instagram", label: " Instagram ", handle: " @aso ", url: " https://instagram.com/aso ", note: "", blurb: "" };

describe("parseSocialLinkFormData", () => {
  it("trims the text and reads the publish checkbox", () => {
    expect(parseSocialLinkFormData(form({ ...VALID, isPublished: "on" }))).toEqual({
      platform: "instagram",
      label: "Instagram",
      handle: "@aso",
      url: "https://instagram.com/aso",
      note: "",
      blurb: "",
      isPublished: true,
    });
  });

  it("rejects missing required fields and unknown ones", () => {
    expect(() => parseSocialLinkFormData(form({ platform: "instagram", label: "x" }))).toThrow(ZodError);
    expect(() => parseSocialLinkFormData(form({ ...VALID, sortOrder: "0" }))).toThrow(ZodError);
  });
});
