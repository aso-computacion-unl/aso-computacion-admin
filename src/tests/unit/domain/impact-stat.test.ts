import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { ImpactStat } from "@/domain/impact-stat";

function build(overrides: Partial<Parameters<typeof ImpactStat.create>[0]> = {}): ImpactStat {
  return ImpactStat.create({ value: "120+", label: "Estudiantes en la comunidad", sortOrder: 0, ...overrides });
}

describe("ImpactStat.create", () => {
  it("trims text and starts unpublished", () => {
    const stat = build({ value: " 120+ ", label: " Estudiantes " });

    expect(stat.props).toMatchObject({ value: "120+", label: "Estudiantes", sortOrder: 0, isPublished: false });
    expect(stat.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("accepts the longest value and label", () => {
    expect(() => build({ value: "v".repeat(20), label: "l".repeat(60) })).not.toThrow();
  });

  it.each([
    ["value", { value: " " }],
    ["value", { value: "v".repeat(21) }],
    ["label", { label: "" }],
    ["label", { label: "l".repeat(61) }],
    ["sortOrder", { sortOrder: -1 }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => build(overrides as Partial<Parameters<typeof ImpactStat.create>[0]>);

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });
});

describe("ImpactStat changes", () => {
  it("update keeps the id and position and validates the new text", () => {
    const stat = build({ sortOrder: 3 });
    const updated = stat.update({ label: "Talleres al año" });

    expect(updated.props).toMatchObject({ id: stat.props.id, sortOrder: 3, label: "Talleres al año", value: "120+" });
    expect(() => stat.update({ value: "v".repeat(21) })).toThrow(expect.objectContaining({ field: "value" }));
  });

  it("publishes, unpublishes and moves without touching the text", () => {
    const published = build().withPublished(true).withSortOrder(5);

    expect(published.props).toMatchObject({ isPublished: true, sortOrder: 5, value: "120+" });
    expect(published.withPublished(false).props.isPublished).toBe(false);
  });
});
