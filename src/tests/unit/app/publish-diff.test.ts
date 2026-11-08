import { describe, expect, it } from "vitest";

import { changeText, describeValue, diffFields, type PublishField } from "../../../../app/admin/_components/publish-diff";

interface Sample {
  title: string;
  seats: string;
  note: string;
  isPublished: boolean;
}

const FIELDS: readonly PublishField<Sample>[] = [
  { name: "title", label: "Título" },
  { name: "seats", label: "Cupos", format: (values) => values.seats || "Sin límite" },
  { name: "note", label: "Nota" },
  { name: "isPublished", label: "Publicado" },
];

const stored: Sample = { title: "Hackathon", seats: "60", note: "", isPublished: true };

describe("diffFields", () => {
  it("lists only the fields that changed, in the order of the field list, with their own labels", () => {
    const changes = diffFields(stored, { ...stored, seats: "80", title: "Hackathon UNL" }, FIELDS);

    expect(changes.map(changeText)).toEqual(["Título: Hackathon → Hackathon UNL", "Cupos: 60 → 80"]);
    expect(changes.map((change) => change.name)).toEqual(["title", "seats"]);
  });

  it("answers nothing when nothing changed", () => {
    expect(diffFields(stored, { ...stored }, FIELDS)).toEqual([]);
  });

  it("uses the field's own words for an empty value and Sí / No for a switch", () => {
    const changes = diffFields(stored, { ...stored, seats: "", note: "Traer laptop", isPublished: false }, FIELDS);

    expect(changes.map(changeText)).toEqual(["Cupos: 60 → Sin límite", "Nota: Vacío → Traer laptop", "Publicado: Sí → No"]);
  });

  it("clips a long text so the list stays short, and skips a difference of spacing it cannot show", () => {
    const long = "palabra ".repeat(30);
    const [change] = diffFields(stored, { ...stored, note: long }, FIELDS);

    expect(change!.after.length).toBeLessThanOrEqual(60);
    expect(change!.after.endsWith("…")).toBe(true);
    expect(diffFields({ ...stored, note: "a b" }, { ...stored, note: "a  b" }, FIELDS)).toEqual([]);
  });

  it("describes a value the way the list prints it", () => {
    expect(describeValue("")).toBe("Vacío");
    expect(describeValue("  ")).toBe("Vacío");
    expect(describeValue(true)).toBe("Sí");
    expect(describeValue(false)).toBe("No");
  });
});
