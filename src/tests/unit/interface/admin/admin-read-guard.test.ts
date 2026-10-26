import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { find } from "@/tests/support/source-files";

/**
 * Every read that feeds an admin page must check the session itself: a layout is not re-rendered on
 * client navigation, so a page that read without checking would keep showing data after a revoke.
 */
const READS = find("src/interface/admin", /-admin-read\.ts$/);
const ADMIN_ONLY = ["settings-admin-read.ts", "users-admin-read.ts", "audit-admin-read.ts"];
const GUARD = /^\s*(?:const actor = )?await requirePageSession\((?:"ADMIN")?\);/;

describe("admin page reads", () => {
  it("finds the read modules", () => {
    expect(READS.length).toBeGreaterThanOrEqual(11);
  });

  it.each(READS)("%s: every exported function starts with the page guard", (path) => {
    const source = readFileSync(path, "utf8");
    const exported = [...source.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{\n([^\n]*)\n/g)];

    expect(source.match(/export (?!async function)(?:function|const)/g), `${path} must export async functions only`).toBeNull();
    expect(exported.length).toBeGreaterThan(0);

    for (const [, name, firstLine] of exported) {
      expect(GUARD.test(firstLine ?? ""), `${name} must start with await requirePageSession()`).toBe(true);
    }
  });

  it("the settings, users and audit reads are admin-only, every other read is editor-level", () => {
    for (const path of READS) {
      const adminOnly = readFileSync(path, "utf8").includes('requirePageSession("ADMIN")');

      expect(adminOnly, path).toBe(ADMIN_ONLY.some((name) => path.endsWith(name)));
    }
  });
});
