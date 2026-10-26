import { readdirSync } from "node:fs";
import { join } from "node:path";

/** Repository-relative paths of the files under `dir` whose path matches `pattern`. */
export function find(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? find(join(dir, entry.name), pattern) : [join(dir, entry.name)]))
    .filter((path) => pattern.test(path))
    .sort();
}
