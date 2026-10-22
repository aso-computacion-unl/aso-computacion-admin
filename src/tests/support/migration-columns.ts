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

/** Splits on commas that are not inside parentheses, a string literal or a quoted identifier. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let inIdentifier = false;
  let current = "";

  for (const char of text) {
    if (char === "'" && !inIdentifier) inString = !inString;
    if (char === '"' && !inString) inIdentifier = !inIdentifier;

    const literal = inString || inIdentifier;

    if (!literal && char === "(") depth += 1;
    if (!literal && char === ")") depth -= 1;

    if (!literal && depth === 0 && char === ",") {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

interface Identifier {
  /** Quoted names keep their case (`""` unescaped); bare names fold to lower case like Postgres. */
  name: string;
  quoted: boolean;
  rest: string;
}

const IDENTIFIER = /^(?:"((?:[^"]|"")+)"|([A-Za-z_][\w$]*))/;

/** The identifier at the start of `text`, if any, and what follows it. */
function readIdentifier(text: string): Identifier | undefined {
  const match = IDENTIFIER.exec(text);

  if (!match) return undefined;

  const quoted = match[1] !== undefined;
  const name = quoted ? match[1]!.replaceAll('""', '"') : match[2]!.toLowerCase();

  return { name, quoted, rest: text.slice(match[0].length).trimStart() };
}

/** What can start a table element or an `ADD`/`DROP` action instead of a column name (an unquoted column cannot be named like these). */
const NOT_A_COLUMN = new Set(["constraint", "primary", "unique", "check", "foreign", "exclude", "like"]);

function columnName(text: string): Identifier | undefined {
  const identifier = readIdentifier(text);

  if (!identifier || (!identifier.quoted && NOT_A_COLUMN.has(identifier.name))) return undefined;

  return identifier;
}

/** The column an `ADD [COLUMN] [IF NOT EXISTS] name ...` action creates, if it creates one. */
function addedColumn(action: string): string | undefined {
  const match = /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?/i.exec(action);

  return match ? columnName(action.slice(match[0].length))?.name : undefined;
}

/** The `[from, to]` of a `RENAME [COLUMN] from TO to` action; table and constraint renames are not column renames. */
function renamedColumn(action: string): [string, string] | undefined {
  const match = /^RENAME\s+(?:COLUMN\s+)?/i.exec(action);
  const from = match ? columnName(action.slice(match[0].length)) : undefined;
  const to = from && /^TO\s+/i.exec(from.rest);
  const target = to ? readIdentifier(from.rest.slice(to[0].length)) : undefined;

  return from && target ? [from.name, target.name] : undefined;
}

/** The column a `DROP [COLUMN] [IF EXISTS] name` action removes (`DROP CONSTRAINT` removes none). */
function droppedColumn(action: string): string | undefined {
  const match = /^DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?/i.exec(action);

  return match ? columnName(action.slice(match[0].length))?.name : undefined;
}

/**
 * The final column names of `table` after replaying `migrationSql` in order:
 * `CREATE TABLE` columns (quoted or not), then `ADD`, `RENAME` and `DROP` of
 * columns from later `ALTER TABLE` statements. The `COLUMN` keyword is optional
 * in Postgres for all three, and `ADD CONSTRAINT/PRIMARY/UNIQUE/CHECK/FOREIGN`,
 * `RENAME CONSTRAINT/TO` and `DROP CONSTRAINT` touch no column. Identifiers may
 * be quoted with any characters. Sorted. Meant for tests that must see the
 * whole history of a table, not only the migration that created it.
 */
export function tableColumns(table: string, migrationSql: readonly string[]): string[] {
  const columns = new Set<string>();
  const tableName = `(?:"?\\w+"?\\.)?"?${table}"?`;
  const create = new RegExp(`^CREATE TABLE (?:IF NOT EXISTS )?${tableName}\\s*\\(([\\s\\S]*)\\)$`, "i");
  const alter = new RegExp(`^ALTER TABLE (?:ONLY )?(?:IF EXISTS )?${tableName}\\s+([\\s\\S]*)$`, "i");

  for (const sql of migrationSql) {
    const statements = sql.replace(/--[^\n]*/g, "").split(";");

    for (const statement of statements.map((text) => text.trim())) {
      const created = create.exec(statement);

      if (created) {
        for (const definition of splitTopLevel(created[1] ?? "")) {
          const column = columnName(definition);

          if (column) columns.add(column.name);
        }

        continue;
      }

      const altered = alter.exec(statement);

      for (const action of splitTopLevel(altered?.[1] ?? "")) {
        const added = addedColumn(action);
        const renamed = renamedColumn(action);
        const dropped = droppedColumn(action);

        if (added) columns.add(added);
        if (renamed) {
          columns.delete(renamed[0]);
          columns.add(renamed[1]);
        }
        if (dropped) columns.delete(dropped);
      }
    }
  }

  return [...columns].sort();
}
