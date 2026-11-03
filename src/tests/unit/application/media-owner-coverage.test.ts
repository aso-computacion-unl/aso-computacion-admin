import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MANAGED_MEDIA_FOLDERS, MEDIA_OWNERS, type MediaOwner } from "@/application/media-owners";

const ROOT = join(__dirname, "..", "..", "..", "..");
const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
const readerSource = readFileSync(join(ROOT, "src/infrastructure/repositories/media-usage-prisma.reader.ts"), "utf8");

/** Every `model.column` whose column name ends in PublicId (any case of the P): a stored image id. */
function publicIdColumns(source: string): Array<{ model: string; column: string }> {
  const found: Array<{ model: string; column: string }> = [];

  for (const [, model, body] of source.matchAll(/^model\s+(\w+)\s*\{([^}]*)\}/gm)) {
    for (const [, column] of body!.matchAll(/^\s*(\w*[Pp]ublicId)\s/gm)) found.push({ model: model!, column: column! });
  }

  return found;
}

const lowerFirst = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/** The problems that would let orphan cleanup delete an image its owner still needs. Empty when every image owner is covered. */
function coverageProblems(source: string, owners: readonly MediaOwner[], reader: string, allowlist: readonly string[]): string[] {
  return publicIdColumns(source).flatMap(({ model, column }) => {
    const owner = owners.find((candidate) => candidate.model === model && candidate.column === column);
    const hint = "Add it to MEDIA_OWNERS (src/application/media-owners.ts), count it in MediaUsagePrismaReader and keep its upload subfolder in the allowlist; until then orphan cleanup could delete images it still needs.";

    if (!owner) return [`${model}.${column} stores a Cloudinary public id but is not listed as a media owner. ${hint}`];
    if (!allowlist.includes(owner.folder)) return [`${model}.${column} uploads to "${owner.folder}", which is not in the cleanup allowlist. ${hint}`];

    const queried = new RegExp(`prisma\\.${lowerFirst(model)}\\.findMany\\(\\{\\s*where:\\s*\\{\\s*${column}:\\s*\\{\\s*in:`).test(reader);

    return queried ? [] : [`${model}.${column} is listed as a media owner but MediaUsagePrismaReader does not query it. ${hint}`];
  });
}

describe("media owner coverage (orphan cleanup must fail closed)", () => {
  it("covers every *PublicId column of prisma/schema.prisma in the usage reader and the cleanup allowlist", () => {
    expect(publicIdColumns(schema).length).toBeGreaterThan(0);
    expect(coverageProblems(schema, MEDIA_OWNERS, readerSource, MANAGED_MEDIA_FOLDERS)).toEqual([]);
  });

  it("fails with a clear message when a model gains a *PublicId column nobody counts (what merging the testimonials and sponsors branch does)", () => {
    const merged = `${schema}\nmodel Testimonial {\n  id            String @id\n  photoPublicId String?\n}\n\nmodel Sponsor {\n  id           String @id\n  logoPublicId String?\n}\n`;

    expect(coverageProblems(merged, MEDIA_OWNERS, readerSource, MANAGED_MEDIA_FOLDERS)).toEqual([
      expect.stringContaining("Testimonial.photoPublicId stores a Cloudinary public id but is not listed as a media owner"),
      expect.stringContaining("Sponsor.logoPublicId stores a Cloudinary public id but is not listed as a media owner"),
    ]);
  });

  it("fails when an owner is listed but its upload subfolder is not in the allowlist", () => {
    expect(coverageProblems(schema, MEDIA_OWNERS, readerSource, [])).toHaveLength(MEDIA_OWNERS.length);
    expect(coverageProblems(schema, MEDIA_OWNERS, readerSource, [])[0]).toContain("not in the cleanup allowlist");
  });

  it("fails when an owner is listed but the reader does not query its column", () => {
    expect(coverageProblems(schema, MEDIA_OWNERS, "", MANAGED_MEDIA_FOLDERS)[0]).toContain("MediaUsagePrismaReader does not query it");
  });
});
