import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");

/** Production code: everything except the test tree. */
const PRODUCTION_DIRS = ["src/domain", "src/application", "src/infrastructure", "src/interface", "app"];

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return sourceFiles(path);

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("production modules", () => {
  // A reset hook exported for tests ships to production and can wipe a throttle or a latch from
  // anywhere. Tests get a fresh module with `vi.resetModules()` + a dynamic import instead.
  it("export no test-only reset helpers", () => {
    const offenders = PRODUCTION_DIRS.flatMap(sourceFiles).flatMap((file) => {
      const source = readFileSync(join(ROOT, file), "utf8");
      const exported = [...source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+(reset\w*)/gm)].map((match) => `${file}: ${match[1]}`);
      const labelled = /test-only/i.test(source) ? [`${file}: mentions "test-only"`] : [];

      return [...exported, ...labelled];
    });

    expect(offenders).toEqual([]);
  });
});
