import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { SeedPlan, SeedResult } from "@/application/seed/seed-landing-content.use-case";

import {
  SeedUsageError,
  checkSeedEnvironment,
  createLocalImageReader,
  formatSeedPlan,
  formatSeedResult,
  parseSeedArgs,
} from "../../../../scripts/seed-cli";

describe("parseSeedArgs", () => {
  it("is a dry run unless --apply is given", () => {
    expect(parseSeedArgs(["--fallback", "a.json", "--assets", "/root"])).toEqual({ fallbackPath: "a.json", assetsRoot: "/root", apply: false });
    expect(parseSeedArgs(["--fallback", "a.json", "--assets", "/root", "--apply"]).apply).toBe(true);
  });

  it("accepts --key=value", () => {
    expect(parseSeedArgs(["--fallback=a.json", "--assets=/root"])).toMatchObject({ fallbackPath: "a.json", assetsRoot: "/root" });
  });

  it.each([
    [["--assets", "/root"], /--fallback/],
    [["--fallback", "a.json"], /--assets/],
    [["--fallback", "a.json", "--assets", "/root", "--force"], /--force/],
    [["--fallback"], /--fallback/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseSeedArgs(argv)).toThrow(SeedUsageError);
    expect(() => parseSeedArgs(argv)).toThrow(message);
  });
});

describe("checkSeedEnvironment", () => {
  const complete = {
    DATABASE_URL: "postgresql://user:db-password@host/db",
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "cloud-secret",
  };

  it("lists the names of everything missing for --apply, never a value", () => {
    const missing = checkSeedEnvironment({ DATABASE_URL: "__REPLACE_DATABASE_URL__", CLOUDINARY_API_KEY: "key" }, { apply: true });

    expect(missing).toEqual(["DATABASE_URL", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_SECRET"]);
  });

  it("passes with a complete environment", () => {
    expect(checkSeedEnvironment(complete, { apply: true })).toEqual([]);
  });

  it("asks for nothing on a dry run", () => {
    expect(checkSeedEnvironment({}, { apply: false })).toEqual([]);
  });
});

describe("createLocalImageReader", () => {
  function assets() {
    const root = mkdtempSync(join(tmpdir(), "seed-assets-"));
    mkdirSync(join(root, "src", "assets", "team"), { recursive: true });
    writeFileSync(join(root, "src", "assets", "team", "ana.jpg"), "jpeg-bytes");
    writeFileSync(join(root, "src", "assets", "team", "notes.txt"), "text");
    return root;
  }

  it("reads a file under the root as an upload file with the right MIME type", async () => {
    const file = await createLocalImageReader(assets())("/src/assets/team/ana.jpg");

    expect(file).toMatchObject({ name: "ana.jpg", type: "image/jpeg", size: 10 });
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe("jpeg-bytes");
  });

  it("rejects a missing file, an unsupported extension and a path outside the root", async () => {
    const read = createLocalImageReader(assets());

    await expect(read("/src/assets/team/nope.jpg")).rejects.toThrow(/not found/i);
    await expect(read("/src/assets/team/notes.txt")).rejects.toThrow(/unsupported/i);
    await expect(read("/src/../../etc/passwd.jpg")).rejects.toThrow(/outside/i);
  });

  it("rejects a symlink that leaves the root", async () => {
    const root = assets();
    const outside = mkdtempSync(join(tmpdir(), "seed-outside-"));
    writeFileSync(join(outside, "secret.jpg"), "x");
    symlinkSync(join(outside, "secret.jpg"), join(root, "src", "assets", "team", "link.jpg"));

    await expect(createLocalImageReader(root)("/src/assets/team/link.jpg")).rejects.toThrow(/outside/i);
  });
});

describe("report formatting", () => {
  const plan: SeedPlan = {
    items: [
      { entity: "event", key: "semana", label: "Semana del Estudiante", action: "create", publish: true },
      { entity: "board", key: "Ana Pérez", label: "Ana Pérez — Presidenta", action: "create", publish: true, image: { path: "/src/assets/team/ana.jpg", width: 1200 } },
      { entity: "board", key: "Luis", label: "Luis — Secretario", action: "skip", reason: "already exists", publish: true },
    ],
    warnings: ["event photos are not seeded"],
    problems: [],
  };

  it("prints one line per item and the counts per entity, zeros included", () => {
    const text = formatSeedPlan(plan);

    expect(text).toContain("semana");
    expect(text).toContain("ana.jpg");
    expect(text).toMatch(/events\s+1 to create, 0 to skip/);
    expect(text).toMatch(/board\s+1 to create, 1 to skip/);
    expect(text).toMatch(/faqs\s+0 to create, 0 to skip/);
    expect(text).toContain("event photos are not seeded");
  });

  it("prints the outcome counts of an applied run", () => {
    const result: SeedResult = {
      items: [
        { ...plan.items[0]!, outcome: "created" },
        { ...plan.items[2]!, outcome: "skipped" },
        { ...plan.items[1]!, outcome: "failed", error: "upload exploded" },
      ],
      warnings: [],
      failed: true,
    };

    const text = formatSeedResult(result);

    expect(text).toMatch(/events\s+1 created, 0 skipped, 0 failed/);
    expect(text).toMatch(/board\s+0 created, 1 skipped, 1 failed/);
    expect(text).toContain("upload exploded");
  });
});
