import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { Sponsor } from "@/domain/sponsor";

const LOGO = { url: "https://res.cloudinary.test/sponsors/acme.png", publicId: "sponsors/acme", width: 400, height: 200, alt: "Logotipo de Acme" };

function build(overrides: Partial<Parameters<typeof Sponsor.create>[0]> = {}): Sponsor {
  return Sponsor.create({ name: "Acme", sortOrder: 0, ...overrides });
}

describe("Sponsor.create", () => {
  it("trims the name, starts unpublished with no logo and no link", () => {
    expect(build({ name: " Acme " }).props).toMatchObject({ name: "Acme", logo: null, url: null, sortOrder: 0, isPublished: false });
  });

  it.each([
    ["name", { name: " " }],
    ["name", { name: "n".repeat(61) }],
    ["url", { url: "http://acme.test" }],
    ["url", { url: "javascript:alert(1)" }],
    ["url", { url: "not a url" }],
    ["url", { url: `https://acme.test/${"a".repeat(300)}` }],
    ["sortOrder", { sortOrder: -1 }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => build(overrides as Partial<Parameters<typeof Sponsor.create>[0]>);

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });

  it("keeps an https link and treats a blank one as none", () => {
    expect(build({ url: " https://acme.test/aliados " }).props.url).toBe("https://acme.test/aliados");
    expect(build({ url: "  " }).props.url).toBeNull();
    expect(build({ url: "https://acme.test" }).update({ url: "" }).props.url).toBeNull();
  });

  it("keeps a valid logo and requires its alt text", () => {
    expect(build({ logo: { ...LOGO, alt: "  Acme  " } }).props.logo).toEqual({ ...LOGO, alt: "Acme" });
    expect(() => build({ logo: { ...LOGO, alt: " " } })).toThrow(expect.objectContaining({ field: "logoAlt" }));
    expect(() => build({ logo: { ...LOGO, alt: "a".repeat(201) } })).toThrow(expect.objectContaining({ field: "logoAlt" }));
  });
});

describe("a sponsor without a logo cannot be published", () => {
  it("refuses to create, publish or update into a published sponsor without a logo", () => {
    expect(() => build({ isPublished: true })).toThrow(expect.objectContaining({ field: "logo" }));
    expect(() => build().withPublished(true)).toThrow(expect.objectContaining({ field: "logo" }));
    expect(() => build().update({ isPublished: true })).toThrow(expect.objectContaining({ field: "logo" }));
  });

  it("publishes once there is a logo, and removing the logo of a published sponsor unpublishes it", () => {
    const published = build({ logo: LOGO }).withPublished(true);

    expect(published.props.isPublished).toBe(true);
    expect(published.withoutLogo().props).toMatchObject({ logo: null, isPublished: false });
  });

  it("update edits the alt of the current logo and refuses an alt when there is no logo", () => {
    expect(build({ logo: LOGO }).update({ logoAlt: "Otro" }).props.logo?.alt).toBe("Otro");
    expect(() => build().update({ logoAlt: "Otro" })).toThrow(expect.objectContaining({ field: "logoAlt" }));
  });
});
