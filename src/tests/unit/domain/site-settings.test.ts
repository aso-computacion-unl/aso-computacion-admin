import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { SITE_SETTINGS_ID, SiteSettings } from "@/domain/site-settings";

const VALID = { tagline: "Asociación Estudiantil de Computación", description: "Nuestro historial.", about: "Somos una organización estudiantil." };

describe("SiteSettings.create", () => {
  it("trims the text and always uses the singleton id", () => {
    const settings = SiteSettings.create({ tagline: "  Tagline ", description: " Desc ", about: " Acerca " });

    expect(settings.props).toMatchObject({ id: SITE_SETTINGS_ID, tagline: "Tagline", description: "Desc", about: "Acerca" });
    expect(settings.props.updatedAt).toBeInstanceOf(Date);
  });

  it.each([
    ["tagline", { tagline: " " }],
    ["tagline", { tagline: "t".repeat(121) }],
    ["description", { description: "" }],
    ["description", { description: "d".repeat(301) }],
    ["about", { about: " " }],
    ["about", { about: "a".repeat(601) }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => SiteSettings.create({ ...VALID, ...overrides });

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });

  it("accepts the maximum lengths", () => {
    expect(() => SiteSettings.create({ tagline: "t".repeat(120), description: "d".repeat(300), about: "a".repeat(600) })).not.toThrow();
  });
});
