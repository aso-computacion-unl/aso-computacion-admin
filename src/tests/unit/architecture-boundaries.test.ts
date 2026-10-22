import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BOUNDARY_ROOT = join(__dirname, "..", "..", "..");

const BOUNDARY_DIRS = ["src/domain", "src/application"];

/**
 * Matches a module specifier used via any of the four import forms:
 * `from "spec"`, side-effect `import "spec"`, `require("spec")`, or
 * dynamic `import("spec")` (including `await import("spec")`).
 */
function forbiddenModulePattern(moduleSpecifierPattern: string): RegExp {
  return new RegExp(`(?:\\bfrom\\s+|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)["']${moduleSpecifierPattern}["']`);
}

// "jose" is only allowed inside src/infrastructure/auth/, which is outside BOUNDARY_DIRS below.
const FORBIDDEN_IMPORTS: Array<{ name: string; pattern: RegExp }> = [
  { name: "next/*", pattern: forbiddenModulePattern("next(?:/[^\"']*)?") },
  { name: "Prisma client", pattern: forbiddenModulePattern("@prisma/client") },
  { name: "Cloudinary SDK", pattern: forbiddenModulePattern("cloudinary") },
  { name: "Auth.js", pattern: forbiddenModulePattern("(?:next-auth|@auth/[^\"']*)") },
  { name: "jose", pattern: forbiddenModulePattern("jose") },
];

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStat = statSync(fullPath);

    if (entryStat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("architecture boundaries", () => {
  it.each(BOUNDARY_DIRS)("%s does not import framework or infrastructure SDKs", (relativeDir) => {
    const absoluteDir = join(BOUNDARY_ROOT, relativeDir);
    const files = collectSourceFiles(absoluteDir);

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");

      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(
          forbidden.pattern.test(content),
          `${file} must not import ${forbidden.name}`,
        ).toBe(false);
      }
    }
  });
});

describe("auth architecture boundaries", () => {
  it("Arch-003: src/interface does not import jose directly", () => {
    const files = collectSourceFiles(join(BOUNDARY_ROOT, "src/interface"));
    const josePattern = forbiddenModulePattern("jose");

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");

      expect(josePattern.test(content), `${file} must not import jose directly`).toBe(false);
    }
  });

});

describe("forbidden import pattern detection", () => {
  const cases: Array<{ label: string; source: string }> = [
    { label: "named import", source: 'import { NextResponse } from "next/server";' },
    { label: "default import", source: 'import next from "next";' },
    { label: "side-effect import", source: 'import "next/server";' },
    { label: "require", source: 'const { PrismaClient } = require("@prisma/client");' },
    { label: "dynamic import", source: 'const cloudinary = await import("cloudinary");' },
  ];

  it.each(cases)("detects a forbidden dependency via $label", ({ source }) => {
    const matchesAtLeastOneForbiddenImport = FORBIDDEN_IMPORTS.some((forbidden) => forbidden.pattern.test(source));
    expect(matchesAtLeastOneForbiddenImport).toBe(true);
  });

  it("does not flag unrelated internal imports", () => {
    const source = 'import { Event } from "../domain/event";\nexport {};';
    const matchesAnyForbiddenImport = FORBIDDEN_IMPORTS.some((forbidden) => forbidden.pattern.test(source));
    expect(matchesAnyForbiddenImport).toBe(false);
  });
});
