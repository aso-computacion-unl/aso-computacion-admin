import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "prisma", "migrations");

/** The SQL of every migration, oldest first (directory names start with a timestamp). */
export function readMigrationSql(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
}

/** Splits on commas that are not inside parentheses or a string literal. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";

  for (const char of text) {
    if (char === "'") quoted = !quoted;
    if (!quoted && char === "(") depth += 1;
    if (!quoted && char === ")") depth -= 1;

    if (!quoted && depth === 0 && char === ",") {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

const IDENTIFIER = '"?(\\w+)"?';

/** What can follow `ADD` instead of a column name (an unquoted column cannot be named like these). */
const ADD_CONSTRAINT_KEYWORDS = new Set(["CONSTRAINT", "PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "EXCLUDE"]);

/** The column an `ADD [COLUMN] [IF NOT EXISTS] name ...` action creates, if it creates one. */
function addedColumn(action: string): string | undefined {
  const match = /^ADD\s+(COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("?)(\w+)\2/i.exec(action);

  if (!match) return undefined;

  const [, column, quote, name] = match;

  if (!column && !quote && ADD_CONSTRAINT_KEYWORDS.has(name!.toUpperCase())) return undefined;

  return name;
}

/**
 * The final column names of `table` after replaying `migrationSql` in order:
 * `CREATE TABLE` columns, then `ADD [COLUMN]` (the keyword is optional in
 * Postgres; `ADD CONSTRAINT/PRIMARY/UNIQUE/CHECK/FOREIGN` add none),
 * `RENAME COLUMN ... TO` and
 * `DROP COLUMN` from later `ALTER TABLE` statements. Sorted. Meant for tests
 * that must see the whole history of a table, not only the migration that
 * created it.
 */
export function tableColumns(table: string, migrationSql: readonly string[]): string[] {
  const columns = new Set<string>();
  const tableName = `"?${table}"?`;
  const create = new RegExp(`^CREATE TABLE (?:IF NOT EXISTS )?${tableName}\\s*\\(([\\s\\S]*)\\)$`, "i");
  const alter = new RegExp(`^ALTER TABLE (?:ONLY )?(?:IF EXISTS )?${tableName}\\s+([\\s\\S]*)$`, "i");

  for (const sql of migrationSql) {
    const statements = sql.replace(/--[^\n]*/g, "").split(";");

    for (const statement of statements.map((text) => text.trim())) {
      const created = create.exec(statement);

      if (created) {
        for (const definition of splitTopLevel(created[1] ?? "")) {
          if (/^"/.test(definition)) {
            columns.add(new RegExp(`^${IDENTIFIER}`).exec(definition)![1]!);
          }
        }

        continue;
      }

      const altered = alter.exec(statement);

      for (const action of splitTopLevel(altered?.[1] ?? "")) {
        const added = addedColumn(action);
        const renamed = new RegExp(`^RENAME COLUMN ${IDENTIFIER} TO ${IDENTIFIER}`, "i").exec(action);
        const dropped = new RegExp(`^DROP COLUMN (?:IF EXISTS )?${IDENTIFIER}`, "i").exec(action);

        if (added) columns.add(added);
        if (renamed) {
          columns.delete(renamed[1]!);
          columns.add(renamed[2]!);
        }
        if (dropped) columns.delete(dropped[1]!);
      }
    }
  }

  return [...columns].sort();
}
