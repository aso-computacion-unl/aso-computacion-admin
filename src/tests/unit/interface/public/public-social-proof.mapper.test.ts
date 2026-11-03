import { describe, expect, it } from "vitest";

import type { PublicSocialProofSnapshot } from "@/application/dto/public-social-proof.dto";
import { toPublicSocialProof } from "@/interface/public/public-social-proof.mapper";

const AT = new Date("2026-10-26T16:00:00.000Z");
const timestamps = { createdAt: AT, updatedAt: AT };
const image = { url: "https://res.cloudinary.test/a.png", width: 600, height: 300, alt: "Alt" };

// The snapshot carries internal fields on purpose (ids, timestamps, publish flags, storage ids and
// fields no entity has): the public shape must be a whitelist, not a pass-through.
const snapshot = {
  impact: [{ id: "i1", value: "120+", label: "Estudiantes", sortOrder: 0, isPublished: true, ...timestamps }],
  testimonials: [
    { id: "t1", quote: "Muy útil.", name: "Ana Pérez", role: "Egresada", photo: image, publicId: "aso/t1", email: "ana@example.com", sortOrder: 0, isPublished: true, ...timestamps },
    { id: "t2", quote: "Sin foto.", name: "Luis", role: "Docente", photo: null, sortOrder: 1, isPublished: true, ...timestamps },
  ],
  sponsors: [
    { id: "s1", name: "Acme", logo: image, url: "https://acme.test", publicId: "aso/s1", sortOrder: 0, isPublished: true, ...timestamps },
    { id: "s2", name: "Sin enlace", logo: image, url: null, sortOrder: 1, isPublished: true, ...timestamps },
    { id: "s3", name: "Sin logo", logo: null, url: null, sortOrder: 2, isPublished: true, ...timestamps },
  ],
} as unknown as PublicSocialProofSnapshot;

describe("toPublicSocialProof", () => {
  it("exposes exactly impact, testimonials and sponsors", () => {
    expect(Object.keys(toPublicSocialProof(snapshot)).sort()).toEqual(["impact", "sponsors", "testimonials"]);
  });

  it("maps each kind to its whitelisted keys, in order, with no id, storage id, flag, position or timestamp", () => {
    const result = toPublicSocialProof(snapshot);

    expect(result.impact).toEqual([{ value: "120+", label: "Estudiantes" }]);
    expect(result.testimonials).toEqual([
      { quote: "Muy útil.", name: "Ana Pérez", role: "Egresada", photo: image },
      { quote: "Sin foto.", name: "Luis", role: "Docente", photo: null },
    ]);
    expect(result.sponsors).toEqual([
      { name: "Acme", logo: image, url: "https://acme.test" },
      { name: "Sin enlace", logo: image, url: null },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/"(id|publicId|email|sortOrder|isPublished|createdAt|updatedAt)"/);
  });

  it("drops a sponsor that has no logo, which the landing could not render", () => {
    expect(toPublicSocialProof(snapshot).sponsors.map((sponsor) => sponsor.name)).not.toContain("Sin logo");
  });

  it("maps an empty snapshot to three empty lists", () => {
    expect(toPublicSocialProof({ impact: [], testimonials: [], sponsors: [] })).toEqual({ impact: [], testimonials: [], sponsors: [] });
  });
});
