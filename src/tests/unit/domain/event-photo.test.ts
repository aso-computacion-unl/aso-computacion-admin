import { describe, expect, it } from "vitest";

import { EventPhoto, MAX_ACTIVE_EVENT_PHOTOS, type CreateEventPhotoInput } from "@/domain/event-photo";

function build(overrides: Partial<CreateEventPhotoInput> = {}): EventPhoto {
  return EventPhoto.create({
    eventId: "event-1",
    url: "https://img.test/a.jpg",
    publicId: "aso/events/a",
    width: 1600,
    height: 900,
    alt: "Estudiantes en el hackatón",
    sortOrder: 0,
    ...overrides,
  });
}

describe("EventPhoto", () => {
  it("starts active and keeps the stored asset data", () => {
    const photo = build();

    expect(photo.props).toMatchObject({
      eventId: "event-1",
      url: "https://img.test/a.jpg",
      publicId: "aso/events/a",
      width: 1600,
      height: 900,
      alt: "Estudiantes en el hackatón",
      sortOrder: 0,
      isActive: true,
    });
  });

  it("caps an event at twelve active photos", () => {
    expect(MAX_ACTIVE_EVENT_PHOTOS).toBe(12);
  });

  it("requires alt text between 1 and 200 characters, trimmed", () => {
    expect(build({ alt: "  Foto  " }).props.alt).toBe("Foto");
    expect(build({ alt: "a".repeat(200) }).props.alt).toHaveLength(200);
    expect(() => build({ alt: "   " })).toThrow(expect.objectContaining({ field: "alt" }));
    expect(() => build({ alt: "a".repeat(201) })).toThrow(expect.objectContaining({ field: "alt" }));
  });

  it.each([
    ["url", { url: "http://img.test/a.jpg" }],
    ["publicId", { publicId: " " }],
    ["width", { width: 0 }],
    ["height", { height: 1.5 }],
    ["sortOrder", { sortOrder: -1 }],
  ])("rejects an invalid %s", (field, input) => {
    expect(() => build(input)).toThrow(expect.objectContaining({ field }));
  });

  it("updates alt text with the same rules", () => {
    expect(build().withAlt("  Nueva  ").props.alt).toBe("Nueva");
    expect(() => build().withAlt("")).toThrow(expect.objectContaining({ field: "alt" }));
  });

  it("deactivates without touching the asset", () => {
    const photo = build().deactivate();

    expect(photo.props.isActive).toBe(false);
    expect(photo.props.publicId).toBe("aso/events/a");
  });

  it("moves to a new position", () => {
    expect(build().withSortOrder(3).props.sortOrder).toBe(3);
    expect(() => build().withSortOrder(-1)).toThrow(expect.objectContaining({ field: "sortOrder" }));
  });
});
