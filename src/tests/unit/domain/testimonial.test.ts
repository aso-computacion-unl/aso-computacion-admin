import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { Testimonial } from "@/domain/testimonial";

const PHOTO = { url: "https://res.cloudinary.test/testimonials/ana.jpg", publicId: "testimonials/ana", width: 600, height: 600, alt: "Ana Pérez sonriendo" };

function build(overrides: Partial<Parameters<typeof Testimonial.create>[0]> = {}): Testimonial {
  return Testimonial.create({ quote: "Aquí aprendí a trabajar en equipo.", name: "Ana Pérez", role: "Egresada de Computación", sortOrder: 0, ...overrides });
}

describe("Testimonial.create", () => {
  it("trims text, starts unpublished and without a photo", () => {
    const testimonial = build({ quote: " Muy útil ", name: " Ana ", role: " Egresada " });

    expect(testimonial.props).toMatchObject({ quote: "Muy útil", name: "Ana", role: "Egresada", photo: null, sortOrder: 0, isPublished: false });
  });

  it("accepts the longest quote, name and role", () => {
    expect(() => build({ quote: "q".repeat(300), name: "n".repeat(60), role: "r".repeat(80) })).not.toThrow();
  });

  it.each([
    ["quote", { quote: " " }],
    ["quote", { quote: "q".repeat(301) }],
    ["name", { name: "" }],
    ["name", { name: "n".repeat(61) }],
    ["role", { role: "" }],
    ["role", { role: "r".repeat(81) }],
    ["sortOrder", { sortOrder: 1.5 }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => build(overrides as Partial<Parameters<typeof Testimonial.create>[0]>);

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });

  it("keeps a valid photo, requires its alt text and an https url", () => {
    expect(build({ photo: { ...PHOTO, alt: "  Ana  " } }).props.photo).toEqual({ ...PHOTO, alt: "Ana" });
    expect(() => build({ photo: { ...PHOTO, alt: " " } })).toThrow(expect.objectContaining({ field: "photoAlt" }));
    expect(() => build({ photo: { ...PHOTO, alt: "a".repeat(201) } })).toThrow(expect.objectContaining({ field: "photoAlt" }));
    expect(() => build({ photo: { ...PHOTO, url: "http://x.test/a.jpg" } })).toThrow(expect.objectContaining({ field: "photoUrl" }));
  });
});

describe("Testimonial photo and publishing", () => {
  it("can be published without a photo, and removing the photo leaves it published", () => {
    const published = build({ photo: PHOTO, isPublished: true });

    expect(build().withPublished(true).props.isPublished).toBe(true);
    expect(published.withoutPhoto().props).toMatchObject({ photo: null, isPublished: true });
  });

  it("update edits the alt of the current photo and refuses an alt when there is no photo", () => {
    expect(build({ photo: PHOTO }).update({ photoAlt: "Otra" }).props.photo?.alt).toBe("Otra");
    expect(() => build().update({ photoAlt: "Otra" })).toThrow(expect.objectContaining({ field: "photoAlt" }));
    expect(build().update({ photoAlt: " ", quote: "Nuevo" }).props.quote).toBe("Nuevo");
  });

  it("exposes only the quote, who said it and the photo (no contact data)", () => {
    expect(Object.keys(build({ photo: PHOTO }).props).sort()).toEqual(
      ["createdAt", "id", "isPublished", "name", "photo", "quote", "role", "sortOrder", "updatedAt"],
    );
  });
});
