import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { Pillar } from "@/domain/pillar";

const IMAGE = {
  url: "https://res.cloudinary.test/pillars/voz.jpg",
  publicId: "pillars/voz",
  width: 1600,
  height: 900,
  alt: "Público en una charla",
};

function build(overrides: Partial<Parameters<typeof Pillar.create>[0]> = {}): Pillar {
  return Pillar.create({ word: "VOZ", title: "Representamos", text: "Llevamos lo que piensan los estudiantes.", sortOrder: 0, ...overrides });
}

describe("Pillar.create", () => {
  it("trims text, starts unpublished and without an image", () => {
    const pillar = build({ word: " VOZ ", title: " Representamos ", text: "  Texto  " });

    expect(pillar.props).toMatchObject({ word: "VOZ", title: "Representamos", text: "Texto", image: null, sortOrder: 0, isPublished: false });
    expect(pillar.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["word", { word: " " }],
    ["word", { word: "w".repeat(21) }],
    ["title", { title: "" }],
    ["title", { title: "t".repeat(61) }],
    ["text", { text: " " }],
    ["text", { text: "x".repeat(301) }],
    ["sortOrder", { sortOrder: -1 }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => build(overrides as Partial<Parameters<typeof Pillar.create>[0]>);

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });

  it("keeps a valid image and requires its alt text", () => {
    expect(build({ image: { ...IMAGE, alt: "  Público  " } }).props.image).toEqual({ ...IMAGE, alt: "Público" });
    expect(() => build({ image: { ...IMAGE, alt: " " } })).toThrow(expect.objectContaining({ field: "imageAlt" }));
    expect(() => build({ image: { ...IMAGE, alt: "a".repeat(201) } })).toThrow(expect.objectContaining({ field: "imageAlt" }));
  });
});

describe("Pillar image rules", () => {
  it.each([
    ["imageUrl", { url: "http://x.test/a.jpg" }],
    ["imagePublicId", { publicId: " " }],
    ["imageWidth", { width: 0 }],
    ["imageHeight", { height: 1.5 }],
  ])("withImage rejects an invalid %s", (field, overrides) => {
    expect(() => build().withImage({ ...IMAGE, ...overrides })).toThrow(expect.objectContaining({ field }));
  });

  it("withImage replaces and withoutImage clears, keeping id and text", () => {
    const pillar = build({ image: IMAGE });
    const replaced = pillar.withImage({ ...IMAGE, publicId: "pillars/otra", alt: "Otra" });

    expect(replaced.props.image).toMatchObject({ publicId: "pillars/otra", alt: "Otra" });
    expect(replaced.props.id).toBe(pillar.props.id);
    expect(replaced.withoutImage().props).toMatchObject({ image: null, title: "Representamos" });
  });
});

describe("Pillar.update", () => {
  it("keeps id, creation date and image, validates and trims", () => {
    const pillar = build({ image: IMAGE });
    const updated = pillar.update({ title: " Nuevo ", isPublished: true });

    expect(updated.props).toMatchObject({ id: pillar.props.id, createdAt: pillar.props.createdAt, title: "Nuevo", isPublished: true, image: IMAGE });
    expect(() => pillar.update({ text: "" })).toThrow(ValidationError);
  });

  it("changes the alt of an existing image and refuses a blank one", () => {
    const pillar = build({ image: IMAGE });

    expect(pillar.update({ imageAlt: " Nueva descripción " }).props.image?.alt).toBe("Nueva descripción");
    expect(() => pillar.update({ imageAlt: "" })).toThrow(expect.objectContaining({ field: "imageAlt" }));
  });

  it("ignores a blank alt without an image but refuses an alt for nothing", () => {
    const pillar = build();

    expect(pillar.update({ imageAlt: "  " }).props.image).toBeNull();
    expect(() => pillar.update({ imageAlt: "Sin imagen" })).toThrow(expect.objectContaining({ field: "imageAlt" }));
  });
});
