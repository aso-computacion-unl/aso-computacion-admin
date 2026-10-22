import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { SOCIAL_PLATFORMS, SocialLink } from "@/domain/social-link";

function build(overrides: Partial<Parameters<typeof SocialLink.create>[0]> = {}): SocialLink {
  return SocialLink.create({
    platform: "instagram",
    label: "Instagram",
    handle: "@aso_computacion",
    url: "https://www.instagram.com/aso_computacion/",
    sortOrder: 0,
    ...overrides,
  });
}

describe("SocialLink.create", () => {
  it("trims text, keeps optional chips null when blank and starts unpublished", () => {
    const link = build({ label: "  Instagram ", handle: " @aso ", note: "  ", blurb: undefined });

    expect(link.props).toMatchObject({
      platform: "instagram",
      label: "Instagram",
      handle: "@aso",
      note: null,
      blurb: null,
      sortOrder: 0,
      isPublished: false,
    });
    expect(link.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a note and a blurb", () => {
    expect(build({ note: " Anunciamos primero aquí ", blurb: "Eventos y fotos." }).props).toMatchObject({
      note: "Anunciamos primero aquí",
      blurb: "Eventos y fotos.",
    });
  });

  it("accepts every supported platform", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(build({ platform }).props.platform).toBe(platform);
    }
  });

  it.each([
    ["platform", { platform: "myspace" }],
    ["label", { label: " " }],
    ["label", { label: "l".repeat(41) }],
    ["handle", { handle: "" }],
    ["handle", { handle: "h".repeat(61) }],
    ["url", { url: "http://instagram.com/aso" }],
    ["url", { url: "javascript:alert(1)" }],
    ["url", { url: "no es un enlace" }],
    ["note", { note: "n".repeat(41) }],
    ["blurb", { blurb: "b".repeat(81) }],
    ["sortOrder", { sortOrder: -1 }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => build(overrides as Partial<Parameters<typeof SocialLink.create>[0]>);

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });

  it("update keeps the id and creation date, validates, and can clear a chip", () => {
    const link = build({ note: "Primero aquí" });
    const updated = link.update({ handle: "@otro", note: "" });

    expect(updated.props).toMatchObject({ id: link.props.id, createdAt: link.props.createdAt, handle: "@otro", note: null });
    expect(() => link.update({ url: "ftp://x" })).toThrow(ValidationError);
  });
});
