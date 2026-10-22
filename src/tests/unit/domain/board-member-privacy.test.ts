import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { toBoardMemberResult } from "@/application/mappers/board-member-result.mapper";
import { BoardMember } from "@/domain/board-member";

// S4: the board shows only name, role and photo. These tests pin the allowed
// set so a contact field cannot be added to the model, the entity, the result
// or the database without a test failing.

const PHOTO = { url: "https://res.cloudinary.test/board/ana.jpg", publicId: "board/ana", width: 1200, height: 1600, alt: "Ana" };
const FORBIDDEN = /phone|tel|mobile|cell|whatsapp|email|mail|age|edad|birth|born|instagram|handle|social|ciclo|cycle|semester|address|dni|cedula/i;

const member = BoardMember.create({ name: "Ana Pérez", role: "Presidenta", sortOrder: 0, photo: PHOTO });

describe("board member privacy (S4)", () => {
  it("the domain props have exactly the allowed keys", () => {
    expect(Object.keys(member.props).sort()).toEqual(
      ["createdAt", "id", "isPublished", "name", "photo", "role", "sortOrder", "updatedAt"],
    );
    expect(Object.keys(member.props.photo ?? {}).sort()).toEqual(["alt", "height", "publicId", "url", "width"]);
  });

  it("the admin result exposes exactly the allowed keys and never the storage publicId", () => {
    const result = toBoardMemberResult(member);

    expect(Object.keys(result).sort()).toEqual(["createdAt", "id", "isPublished", "name", "photo", "role", "sortOrder", "updatedAt"]);
    expect(Object.keys(result.photo ?? {}).sort()).toEqual(["alt", "height", "url", "width"]);
  });

  it("the Prisma model has exactly the allowed columns (DMMF)", () => {
    const model = Prisma.dmmf.datamodel.models.find(({ name }) => name === "BoardMember");

    expect(model?.fields.map(({ name }) => name).sort()).toEqual([
      "createdAt",
      "id",
      "isPublished",
      "name",
      "photoAlt",
      "photoHeight",
      "photoPublicId",
      "photoUrl",
      "photoWidth",
      "role",
      "sortOrder",
      "updatedAt",
    ]);
  });

  it("no column in the model or in its migration looks like contact data", () => {
    const model = Prisma.dmmf.datamodel.models.find(({ name }) => name === "BoardMember");
    const migration = readFileSync(join(__dirname, "..", "..", "..", "..", "prisma", "migrations", "20261022170000_add_board_member", "migration.sql"), "utf8");
    const columns = [...migration.matchAll(/^\s+"(\w+)"\s+(?:TEXT|INTEGER|BOOLEAN|TIMESTAMP)/gm)].map((found) => found[1]!);

    expect(columns.length).toBeGreaterThan(0);
    expect(model?.fields.map(({ name }) => name).filter((name) => FORBIDDEN.test(name))).toEqual([]);
    expect(columns.filter((name) => FORBIDDEN.test(name))).toEqual([]);
  });
});
