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

  it("counts ADD without the optional COLUMN keyword (Postgres accepts both)", () => {
    const later = `ALTER TABLE "BoardMember" ADD "telefono" TEXT;\nALTER TABLE "BoardMember"\n  ADD IF NOT EXISTS "email" TEXT,\n  ADD age INTEGER NOT NULL DEFAULT 0;`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["age", "createdAt", "email", "id", "name", "telefono"]);
  });

  it("still counts a column whose quoted name is a constraint keyword", () => {
    const later = `ALTER TABLE "BoardMember" ADD "check" TEXT, ADD COLUMN unique_code TEXT;`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["check", "createdAt", "id", "name", "unique_code"]);
  });

  it("follows RENAME without the optional COLUMN keyword", () => {
    const later = `ALTER TABLE "BoardMember" RENAME "name" TO "telefono";\nALTER TABLE "BoardMember" RENAME COLUMN "id" TO "pk";`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["createdAt", "pk", "telefono"]);
  });

  it("ignores table and constraint renames", () => {
    const later = `ALTER TABLE "BoardMember" RENAME CONSTRAINT "BoardMember_pkey" TO "pk";\nALTER TABLE "BoardMember" RENAME TO "Directiva";`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["createdAt", "id", "name"]);
  });

  it("reads quoted names that are not plain words (spaces, dashes, commas, escaped quotes)", () => {
    const later = [
      `ALTER TABLE "BoardMember" ADD COLUMN "phone number" TEXT, ADD COLUMN "tel-efono" TEXT;`,
      `ALTER TABLE "BoardMember" ADD COLUMN "a,b" TEXT, ADD COLUMN "it's" TEXT, ADD COLUMN "say ""hi""" TEXT;`,
      `ALTER TABLE "BoardMember" RENAME COLUMN "tel-efono" TO "móvil";`,
      `ALTER TABLE "BoardMember" DROP COLUMN "a,b";`,
    ].join("\n");

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(
      ['createdAt', 'id', "it's", "móvil", "name", "phone number", 'say "hi"'].sort(),
    );
  });

  it("reads unquoted CREATE TABLE columns, folded to lower case like Postgres does", () => {
    const created = `CREATE TABLE "BoardMember" (id TEXT NOT NULL, Phone TEXT, "Name" TEXT, PRIMARY KEY (id), UNIQUE (phone), CHECK (id <> ''), CONSTRAINT x CHECK (id <> ''));`;
    const later = `ALTER TABLE "BoardMember" ADD COLUMN Email TEXT;`;

    expect(tableColumns("BoardMember", [created, later])).toEqual(["Name", "email", "id", "phone"].sort());
  });

  it("follows DROP without the optional COLUMN keyword, but not DROP CONSTRAINT", () => {
    const later = `ALTER TABLE "BoardMember" DROP "createdAt", DROP IF EXISTS "name", DROP CONSTRAINT "BoardMember_pkey";`;

    expect(tableColumns("BoardMember", [CREATE, later])).toEqual(["id"]);
  });

  it("finds the table when it is schema-qualified or written unquoted", () => {
    const later = `ALTER TABLE ONLY public."BoardMember" ADD COLUMN "telefono" TEXT;\nALTER TABLE IF EXISTS public.boardmember ADD COLUMN age INTEGER;`;
    const created = `CREATE TABLE public."BoardMember" ("id" TEXT NOT NULL);`;

    expect(tableColumns("BoardMember", [created, later])).toEqual(["age", "id", "telefono"]);
  });

  it.each([
    ["ADD CONSTRAINT", `ADD CONSTRAINT "BoardMember_check" CHECK ("id" <> '')`],
    ["ADD CONSTRAINT UNIQUE", `ADD CONSTRAINT "BoardMember_name_key" UNIQUE ("name")`],
    ["ADD CONSTRAINT FOREIGN KEY", `ADD CONSTRAINT "BoardMember_fk" FOREIGN KEY ("id") REFERENCES "Other"("id")`],
    ["ADD PRIMARY KEY", `ADD PRIMARY KEY ("id")`],
    ["ADD UNIQUE", `ADD UNIQUE ("name")`],
    ["ADD CHECK", `ADD CHECK ("id" <> '')`],
    ["ADD FOREIGN KEY", `ADD FOREIGN KEY ("id") REFERENCES "Other"("id")`],
    ["ADD EXCLUDE", `ADD EXCLUDE USING gist ("id" WITH =)`],
  ])("does not mistake %s for a column", (_label, action) => {
    const later = `ALTER TABLE "BoardMember" ${action};\nALTER TABLE ONLY "BoardMember"\n  ${action};`;

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
