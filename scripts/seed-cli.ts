import { readFile, realpath } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

import type { ImageUploadFile } from "@/application/ports/media-storage.port";
import { SEED_ENTITIES, type SeedEntity, type SeedPlan, type SeedResult } from "@/application/seed/seed-landing-content.use-case";
import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

/** Wrong command line. The message is safe to print. */
export class SeedUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedUsageError";
  }
}

export interface SeedArgs {
  fallbackPath: string;
  assetsRoot: string;
  apply: boolean;
}

const VALUE_FLAGS = ["--fallback", "--assets"] as const;

/** `--fallback <file> --assets <dir> [--apply]`; `--flag=value` works too. Dry run unless `--apply`. */
export function parseSeedArgs(argv: readonly string[]): SeedArgs {
  const values = new Map<string, string>();
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? undefined : argument.slice(equals + 1);

    if (flag === "--apply" && inline === undefined) {
      apply = true;
    } else if ((VALUE_FLAGS as readonly string[]).includes(flag)) {
      const value = inline ?? argv[(index += 1)];

      if (!value || value.startsWith("--")) {
        throw new SeedUsageError(`${flag} needs a value.`);
      }

      values.set(flag, value);
    } else {
      throw new SeedUsageError(`Unknown argument: ${flag}`);
    }
  }

  const fallbackPath = values.get("--fallback");
  const assetsRoot = values.get("--assets");

  if (!fallbackPath) throw new SeedUsageError("--fallback <path to the landing's src/data/fallback.json> is required.");
  if (!assetsRoot) throw new SeedUsageError("--assets <the landing's root directory, where /src/assets/... resolves> is required.");

  return { fallbackPath, assetsRoot, apply };
}

const APPLY_VARIABLES = ["DATABASE_URL", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;

/** Names (never values) of the variables `--apply` needs and does not have. A dry run needs none. */
export function checkSeedEnvironment(env: Readonly<Record<string, string | undefined>>, { apply }: { apply: boolean }): string[] {
  if (!apply) return [];

  return APPLY_VARIABLES.filter((name) => {
    try {
      requireRuntimeValue(name, env[name]);
      return false;
    } catch {
      return true;
    }
  });
}

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Reads the images the content points at (`/src/assets/team/ana.jpg`) from
 * under `assetsRoot`. Nothing outside the root is readable: not by `..`, not
 * through a symlink.
 */
export function createLocalImageReader(assetsRoot: string): (path: string) => Promise<ImageUploadFile> {
  return async (path) => {
    const type = IMAGE_TYPES[extname(path).toLowerCase()];

    if (!type) {
      throw new Error(`Unsupported image extension: ${path}`);
    }

    const root = await realpath(resolve(assetsRoot));
    const target = resolve(root, `.${path}`);

    if (!target.startsWith(root + sep)) {
      throw new Error(`Image path is outside the assets root: ${path}`);
    }

    let real: string;

    try {
      real = await realpath(target);
    } catch {
      throw new Error(`Image file not found: ${path}`);
    }

    if (!real.startsWith(root + sep)) {
      throw new Error(`Image path is outside the assets root: ${path}`);
    }

    const bytes = await readFile(real);

    return {
      name: basename(real),
      type,
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    };
  };
}

const PLURAL: Record<SeedEntity, string> = {
  settings: "settings",
  event: "events",
  faq: "faqs",
  pillar: "pillars",
  social: "socials",
  board: "board",
};

const NAME_WIDTH = Math.max(...Object.values(PLURAL).map((name) => name.length));

function describe(item: SeedPlan["items"][number]): string {
  const notes = [
    item.action === "create" ? (item.publish ? "published" : "draft") : item.reason,
    item.image && `image ${item.image.path.split("/").at(-1)}, ${item.image.width} px`,
  ].filter(Boolean);

  return `${item.label} [${item.key}] (${notes.join(", ")})`;
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ["", title, ...lines.map((line) => `  ${line}`)];
}

function summary(entries: ReadonlyArray<[SeedEntity, string]>): string[] {
  return entries.map(([entity, text]) => `${PLURAL[entity].padEnd(NAME_WIDTH)}  ${text}`);
}

export function formatSeedPlan(plan: SeedPlan): string {
  const lines = plan.items.map((item) => `${item.entity.padEnd(NAME_WIDTH)}  ${item.action.padEnd(6)}  ${describe(item)}`);
  const counts = summary(
    SEED_ENTITIES.map((entity) => {
      const items = plan.items.filter((item) => item.entity === entity);

      return [entity, `${items.filter((item) => item.action === "create").length} to create, ${items.filter((item) => item.action === "skip").length} to skip`];
    }),
  );

  return [
    ...lines,
    ...section("Warnings:", plan.warnings),
    ...section("Problems (--apply would refuse to write anything):", plan.problems.map((problem) => `${problem.entity} "${problem.key}": ${problem.message}`)),
    "",
    "Summary:",
    ...counts.map((line) => `  ${line}`),
  ].join("\n");
}

export function formatSeedResult(result: SeedResult): string {
  const lines = result.items.map((item) => `${item.entity.padEnd(NAME_WIDTH)}  ${item.outcome.padEnd(7)}  ${item.label} [${item.key}]${item.error ? ` — ${item.error}` : ""}`);
  const counts = summary(
    SEED_ENTITIES.map((entity) => {
      const items = result.items.filter((item) => item.entity === entity);
      const count = (outcome: string) => items.filter((item) => item.outcome === outcome).length;

      return [entity, `${count("created")} created, ${count("skipped")} skipped, ${count("failed")} failed`];
    }),
  );

  return [
    ...lines,
    ...section("Warnings:", result.warnings),
    "",
    "Summary:",
    ...counts.map((line) => `  ${line}`),
    ...(result.failed ? ["", "Stopped at the first failure. Nothing half-created was left behind; fix the cause and run again to finish."] : []),
  ].join("\n");
}
