import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { BoardMember } from "@/domain/board-member";

const PHOTO = {
  url: "https://res.cloudinary.test/board/ana.jpg",
  publicId: "board/ana",
  width: 1200,
  height: 1600,
  alt: "Ana, presidenta, sonriendo",
};

function build(overrides: Partial<Parameters<typeof BoardMember.create>[0]> = {}): BoardMember {
  return BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 0, ...overrides });
}

describe("BoardMember.create", () => {
  it("trims text, starts unpublished and without a photo", () => {
    const member = build({ name: " Ana Pérez ", role: " Presidenta " });

    expect(member.props).toMatchObject({ name: "Ana Pérez", role: "Presidenta", photo: null, sortOrder: 0, isPublished: false });
    expect(member.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["name", { name: " " }],
    ["name", { name: "n".repeat(61) }],
    ["role", { role: "" }],
    ["role", { role: "r".repeat(61) }],
    ["sortOrder", { sortOrder: -1 }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => build(overrides as Partial<Parameters<typeof BoardMember.create>[0]>);

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });

  it("keeps a valid photo and requires its alt text", () => {
    expect(build({ photo: { ...PHOTO, alt: "  Ana  " } }).props.photo).toEqual({ ...PHOTO, alt: "Ana" });
    expect(() => build({ photo: { ...PHOTO, alt: " " } })).toThrow(expect.objectContaining({ field: "photoAlt" }));
    expect(() => build({ photo: { ...PHOTO, alt: "a".repeat(201) } })).toThrow(expect.objectContaining({ field: "photoAlt" }));
  });
});

describe("a member without a photo cannot be published (S4 / L6)", () => {
  it("refuses to create a published member without a photo", () => {
    expect(() => build({ isPublished: true })).toThrow(expect.objectContaining({ field: "photo" }));
  });

  it("refuses to publish through update or withPublished", () => {
    expect(() => build().withPublished(true)).toThrow(expect.objectContaining({ field: "photo" }));
    expect(() => build().update({ isPublished: true })).toThrow(expect.objectContaining({ field: "photo" }));
  });

  it("publishes once there is a photo, and unpublishing never needs one", () => {
    const published = build({ photo: PHOTO }).withPublished(true);

    expect(published.props.isPublished).toBe(true);
    expect(build().withPublished(false).props.isPublished).toBe(false);
    expect(build({ photo: PHOTO, isPublished: true }).props.isPublished).toBe(true);
  });

  it("removing the photo of a published member unpublishes it in the same step", () => {
    const published = build({ photo: PHOTO, isPublished: true });
    const removed = published.withoutPhoto();

    expect(removed.props).toMatchObject({ photo: null, isPublished: false, id: published.props.id, name: "Ana Pérez" });
  });
});

describe("BoardMember photo rules", () => {
  it.each([
    ["photoUrl", { url: "http://x.test/a.jpg" }],
    ["photoPublicId", { publicId: " " }],
    ["photoWidth", { width: 0 }],
    ["photoHeight", { height: 1.5 }],
  ])("withPhoto rejects an invalid %s", (field, overrides) => {
    expect(() => build().withPhoto({ ...PHOTO, ...overrides })).toThrow(expect.objectContaining({ field }));
  });

  it("withPhoto replaces the photo, keeping id and text", () => {
    const member = build({ photo: PHOTO });
    const replaced = member.withPhoto({ ...PHOTO, publicId: "board/otra", alt: "Otra" });

    expect(replaced.props.photo).toMatchObject({ publicId: "board/otra", alt: "Otra" });
    expect(replaced.props.id).toBe(member.props.id);
  });
});

describe("BoardMember.update", () => {
  it("keeps id, creation date and photo, validates and trims", () => {
    const member = build({ photo: PHOTO });
    const updated = member.update({ role: " Tesorera ", isPublished: true });

    expect(updated.props).toMatchObject({ id: member.props.id, createdAt: member.props.createdAt, role: "Tesorera", isPublished: true, photo: PHOTO });
    expect(() => member.update({ name: "" })).toThrow(ValidationError);
  });

  it("changes the alt of an existing photo and refuses a blank one", () => {
    const member = build({ photo: PHOTO });

    expect(member.update({ photoAlt: " Nueva descripción " }).props.photo?.alt).toBe("Nueva descripción");
    expect(() => member.update({ photoAlt: "" })).toThrow(expect.objectContaining({ field: "photoAlt" }));
  });

  it("ignores a blank alt without a photo but refuses an alt for nothing", () => {
    const member = build();

    expect(member.update({ photoAlt: "  " }).props.photo).toBeNull();
    expect(() => member.update({ photoAlt: "Sin foto" })).toThrow(expect.objectContaining({ field: "photoAlt" }));
  });
});
