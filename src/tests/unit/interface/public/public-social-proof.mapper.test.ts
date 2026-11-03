import { describe, expect, it } from "vitest";

import type { PublicSocialProofSnapshot } from "@/application/dto/public-social-proof.dto";
import { toPublicSocialProof } from "@/interface/public/public-social-proof.mapper";

const AT = new Date("2026-10-26T16:00:00.000Z");
const timestamps = { createdAt: AT, updatedAt: AT };
const image = { url: "https://res.cloudinary.test/a.png", width: 600, height: 300, alt: "Alt" };

// The snapshot carries internal fields on purpose (ids, timestamps, publish flags, storage ids and
// fields no entity has): the public shape must be a whitelist, not a pass-through.
const snapshot = {
  sponsors: [
    { id: "s1", name: "Acme", logo: image, url: "https://acme.test", publicId: "aso/s1", sortOrder: 0, isPublished: true, ...timestamps },
    { id: "s2", name: "Sin enlace", logo: image, url: null, sortOrder: 1, isPublished: true, ...timestamps },
    { id: "s3", name: "Sin logo", logo: null, url: null, sortOrder: 2, isPublished: true, ...timestamps },
  ],
} as unknown as PublicSocialProofSnapshot;

describe("toPublicSocialProof", () => {
  it("exposes exactly sponsors: impact figures and testimonials are no longer sent", () => {
    expect(Object.keys(toPublicSocialProof(snapshot))).toEqual(["sponsors"]);
  });

  it("maps each sponsor to its whitelisted keys, in order, with no id, storage id, flag, position or timestamp", () => {
    const result = toPublicSocialProof(snapshot);

    expect(result.sponsors).toEqual([
      { name: "Acme", logo: image, url: "https://acme.test" },
      { name: "Sin enlace", logo: image, url: null },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/"(id|publicId|sortOrder|isPublished|createdAt|updatedAt)"/);
  });

  it("drops a sponsor that has no logo, which the landing could not render", () => {
    expect(toPublicSocialProof(snapshot).sponsors.map((sponsor) => sponsor.name)).not.toContain("Sin logo");
  });

  it("maps an empty snapshot to an empty list", () => {
    expect(toPublicSocialProof({ sponsors: [] })).toEqual({ sponsors: [] });
  });
});
