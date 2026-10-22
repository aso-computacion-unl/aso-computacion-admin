import { describe, expect, it } from "vitest";

import { readMigrationSql, tableColumns } from "@/tests/support/migration-columns";

const CREATE = `
-- CreateTable
CREATE TABLE "BoardMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    -- "commented" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BoardMember_check" CHECK ("name" <> '' OR "id" <> '')
);

CREATE TABLE "Other" ("id" TEXT NOT NULL, "phone" TEXT);
CREATE INDEX "BoardMember_name_idx" ON "BoardMember"("name");
`;

describe("tableColumns", () => {
  it("reads the columns of a CREATE TABLE, skipping constraints, comments and other tables", () => {
    expect(tableColumns("BoardMember", [CREATE])).toEqual(["createdAt", "id", "name"]);
  });

  it("sees a column added by a later migration (the case the first-migration-only scan missed)", () => {
    const later = `-- AlterTable\nALTER TABLE "BoardMember" ADD COLUMN "telefono" TEXT;`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["createdAt", "id", "name", "telefono"]);
  });

  it("reads several additions in one ALTER, IF NOT EXISTS, and an unquoted name", () => {
    const later = `ALTER TABLE "BoardMember"\n  ADD COLUMN IF NOT EXISTS "email" TEXT,\n  ADD COLUMN age INTEGER NOT NULL DEFAULT 0;`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["age", "createdAt", "email", "id", "name"]);
  });

  it("follows renames and drops, so the result is the final column set", () => {
    const later = `ALTER TABLE "BoardMember" RENAME COLUMN "name" TO "fullName";\nALTER TABLE "BoardMember" DROP COLUMN "createdAt";`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["fullName", "id"]);
  });

  it("ignores ALTERs of other tables and constraint-only changes", () => {
    const later = `ALTER TABLE "Other" ADD COLUMN "mobile" TEXT;\nALTER TABLE "BoardMember" ADD CONSTRAINT "x" CHECK ("id" <> '');`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["createdAt", "id", "name"]);
  });

  it("is empty for a table no migration creates", () => {
    expect(tableColumns("Missing", [CREATE])).toEqual([]);
  });
});

describe("readMigrationSql", () => {
  it("reads every migration of the repository, oldest first", () => {
    const files = readMigrationSql();

    expect(files.length).toBeGreaterThanOrEqual(7);
    expect(files[0]).toContain('CREATE TABLE "Event"');
    expect(files.some((sql) => sql.includes('CREATE TABLE "BoardMember"'))).toBe(true);
  });
});
