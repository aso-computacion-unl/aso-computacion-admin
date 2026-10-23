/**
 * Loads the landing's real content (`src/data/fallback.json`) into the admin database, through the
 * admin's own use cases. Dry run by default; `--apply` writes. See docs/DEPLOY.md, "Seeding".
 *
 *   npm run seed:landing -- --fallback ../aso-computacion-landing/src/data/fallback.json \
 *                           --assets ../aso-computacion-landing [--apply]
 *
 * Exit codes: 0 done (or a clean dry run), 1 the content has problems or the apply failed, 2 wrong usage
 * or missing environment. Nothing in the output is a secret: variables are reported by name only.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { parseLandingSeedContent, SeedSourceError } from "@/application/seed/landing-seed-content";
import {
  emptyExistingKeys,
  SeedLandingContentUseCase,
  SeedPlanInvalidError,
  type SeedDependencies,
} from "@/application/seed/seed-landing-content.use-case";

import {
  SeedUsageError,
  checkSeedEnvironment,
  createLocalImageReader,
  formatSeedPlan,
  formatSeedResult,
  parseSeedArgs,
} from "./seed-cli";

/** Stands in for a repository on a dry run without a database: the plan then assumes an empty one and never calls it. */
function unavailable<T extends object>(): T {
  return new Proxy({}, { get: () => () => Promise.reject(new Error("DATABASE_URL is not configured.")) }) as T;
}

/** Where the data goes, without credentials: enough to notice a wrong target before `--apply`. */
function describeDatabase(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);

    return `${hostname}${pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function createDependencies(readImage: SeedDependencies["readImage"], { apply, hasDatabase }: { apply: boolean; hasDatabase: boolean }) {
  if (!hasDatabase) {
    return { deps: { events: unavailable(), faqs: unavailable(), pillars: unavailable(), socials: unavailable(), board: unavailable(), settings: unavailable(), storage: unavailable(), readImage } satisfies SeedDependencies, close: async () => {} };
  }

  const [{ prisma }, infrastructure, { CloudinaryMediaStorage }] = await Promise.all([
    import("@/infrastructure/prisma/client"),
    import("@/infrastructure"),
    import("@/infrastructure/storage/cloudinary-media-storage"),
  ]);

  return {
    deps: {
      events: new infrastructure.EventPrismaRepository(),
      faqs: new infrastructure.FaqPrismaRepository(),
      pillars: new infrastructure.PillarPrismaRepository(),
      socials: new infrastructure.SocialLinkPrismaRepository(),
      board: new infrastructure.BoardMemberPrismaRepository(),
      settings: new infrastructure.SiteSettingsPrismaRepository(),
      // A dry run never uploads or destroys, so it does not need (or build) the Cloudinary client.
      storage: apply ? new CloudinaryMediaStorage() : unavailable(),
      readImage,
    } satisfies SeedDependencies,
    close: () => prisma.$disconnect(),
  };
}

async function main(): Promise<number> {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }

  const args = parseSeedArgs(process.argv.slice(2));
  const missing = checkSeedEnvironment(process.env, args);

  if (missing.length > 0) {
    console.error(`Refusing to --apply: ${missing.join(", ")} must be set to real values (see .env.example). Nothing was written.`);
    return 2;
  }

  const content = parseLandingSeedContent(JSON.parse(await readFile(args.fallbackPath, "utf8")));
  const hasDatabase = Boolean(process.env.DATABASE_URL) && !/^__REPLACE_/.test(process.env.DATABASE_URL ?? "");
  const { deps, close } = await createDependencies(createLocalImageReader(args.assetsRoot), { apply: args.apply, hasDatabase });

  try {
    const seed = new SeedLandingContentUseCase(deps);

    console.log(args.apply ? "ASO landing seed: APPLY" : "ASO landing seed: DRY RUN (nothing is written; add --apply to write)");
    console.log(`source:   ${args.fallbackPath}`);
    console.log(`assets:   ${args.assetsRoot}`);
    console.log(hasDatabase ? `database: ${describeDatabase(process.env.DATABASE_URL ?? "")} (${args.apply ? "will be written" : "read only"})` : "database: not configured, so the plan assumes an empty database");
    console.log("");

    if (!args.apply) {
      const plan = await seed.plan(content, hasDatabase ? undefined : emptyExistingKeys());

      console.log(formatSeedPlan(plan));
      return plan.problems.length > 0 ? 1 : 0;
    }

    const result = await seed.apply(content);

    console.log(formatSeedResult(result));
    console.log("");
    console.log("The seed does not trigger a landing rebuild: run the Cloudflare deploy hook or wait for the daily cron.");
    return result.failed ? 1 : 0;
  } finally {
    await close();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Usage, content and plan errors carry no secrets by construction; anything else is reduced to its message.
    const known = error instanceof SeedUsageError || error instanceof SeedSourceError || error instanceof SeedPlanInvalidError;

    console.error(known || error instanceof Error ? error.message : "Unexpected error.");
    process.exitCode = error instanceof SeedUsageError ? 2 : 1;
  },
);
