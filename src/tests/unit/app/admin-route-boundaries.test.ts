import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_DIRECTORY = join(__dirname, "../../../../app/admin");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(path);

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// A Suspense boundary around an admin page (a `loading.tsx`, or a `<Suspense>` in the page) is revealed while a
// server action refreshes that page. With Next 15.5.28 and React 19.2.7 the refresh then stays suspended
// until an unrelated state update re-renders the root: a row moved to the trash stayed on screen for 5 s
// (until its toast closed) in about 60 % of the e2e runs, and the create redirect sometimes stayed on /new.
// Lift this guard only after upgrading Next/React and re-running `npm run e2e` many times in a row.
describe("admin route boundaries", () => {
  const files = sourceFiles(ADMIN_DIRECTORY);

  it("has no loading.tsx, which Next wraps around the page in a Suspense boundary", () => {
    const loadingFiles = files.filter((file) => /(^|\/)loading\.tsx?$/.test(relative(ADMIN_DIRECTORY, file)));

    expect(loadingFiles.map((file) => relative(ADMIN_DIRECTORY, file))).toEqual([]);
  });

  it("does not render a Suspense boundary", () => {
    const withSuspense = files.filter((file) => /<Suspense[\s>]/.test(readFileSync(file, "utf8")));

    expect(withSuspense.map((file) => relative(ADMIN_DIRECTORY, file))).toEqual([]);
  });
});
