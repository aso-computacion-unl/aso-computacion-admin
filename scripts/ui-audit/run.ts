/**
 * Local UI audit: captures every screen the board reviews (admin, forum, landing) on desktop and phone in the
 * dark theme and on desktop in the light theme, and writes the screenshots plus a manifest to
 * test-results/ui-audit/. Local only: it refuses a DATABASE_URL that is not on this machine, signs in to
 * the admin with the emergency password, mints a forum session like e2e/forum-member.spec.ts, and
 * deletes that session row when it ends. It only navigates; it never submits a form.
 *
 *   npm run audit:ui
 *
 * Needs the admin on http://localhost:3000, the landing on http://localhost:4321 and the demo seed
 * (`npm run seed:demo`). Env values are read from .env.local and never printed or written.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { ADMIN_URL, DESKTOP_DARK, LOCAL_HOSTS, OUTPUT_DIR, THEME_KEY, VARIANTS, type Auth, type Capture, type Target, type Variant } from "./config";
import { mintForumSession } from "./forum-session";
import { adminTargets, forumTargets, landingTargets, loginTarget } from "./targets";

const NAVIGATION_TIMEOUT = 90_000;
const IDLE_TIMEOUT = 10_000;

/** The dev overlays are not part of the product: keep them out of the pictures. */
const HIDE_DEV_OVERLAYS = "nextjs-portal, astro-dev-toolbar { display: none !important; }";

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

function loadLocalEnv(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const url = process.env.DATABASE_URL ?? "";
  let host: string;

  try {
    host = new URL(url).hostname;
  } catch {
    fail("DATABASE_URL is missing or not a valid URL (.env.local). Nothing was captured.");
  }

  if (!LOCAL_HOSTS.has(host)) fail(`Refusing to audit against a non-local database (${host}). Nothing was captured.`);
  if (!process.env.ADMIN_PASSWORD) fail("ADMIN_PASSWORD is not set (.env.local). Nothing was captured.");
}

const variantLabel = (variant: Variant) => `${variant.viewport}-${variant.theme}`;

async function newContext(browser: Browser, variant: Variant, options: { storageState?: Awaited<ReturnType<BrowserContext["storageState"]>> } = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: variant.width, height: variant.height },
    reducedMotion: "reduce",
    colorScheme: variant.theme,
    storageState: options.storageState,
  });

  await context.addInitScript(
    ({ key, theme }) => {
      try {
        localStorage.setItem(key, theme);
      } catch {
        // Storage unavailable (about:blank): the pre-paint script then falls back to the colour scheme, which is set too.
      }
    },
    { key: THEME_KEY, theme: variant.theme },
  );

  return context;
}

async function logInAsAdmin(browser: Browser): Promise<Awaited<ReturnType<BrowserContext["storageState"]>>> {
  const context = await newContext(browser, DESKTOP_DARK);
  const page = await context.newPage();

  await page.goto(`${ADMIN_URL}/login`, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT });
  await page.getByLabel("Contraseña").fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/admin$/, { timeout: NAVIGATION_TIMEOUT });

  const state = await context.storageState();

  await context.close();

  return state;
}

/** Scroll top to bottom so lazy images and scroll-triggered sections are painted before the full-page shot. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.8, 200);

    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    window.scrollTo(0, 0);
  });
}

interface Tracked {
  page: Page;
  errors: string[];
}

async function track(context: BrowserContext): Promise<Tracked> {
  const page = await context.newPage();
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 300));
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message.slice(0, 300)}`));

  return { page, errors };
}

async function capture(tracked: Tracked, target: Target, variant: Variant): Promise<Capture> {
  const { page, errors } = tracked;
  const file = path.join(OUTPUT_DIR, target.area, `${target.name}__${variantLabel(variant)}.png`);
  const notes: string[] = target.notes ? [target.notes] : [];
  const result: Capture = {
    area: target.area,
    name: target.name,
    url: target.url,
    finalUrl: target.url,
    viewport: variant.viewport,
    theme: variant.theme,
    file,
    status: 0,
    consoleErrors: [],
    horizontalOverflow: false,
    notes,
  };

  errors.length = 0;

  try {
    const response = await page.goto(target.url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT });

    result.status = response?.status() ?? 0;
    await page.addStyleTag({ content: HIDE_DEV_OVERLAYS });
    await page.waitForLoadState("networkidle", { timeout: IDLE_TIMEOUT }).catch(() => notes.push("Network never went idle; shot taken anyway."));
    await scrollThrough(page);
    await page.waitForLoadState("networkidle", { timeout: IDLE_TIMEOUT }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);

    const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? null);

    if (theme !== null && theme !== variant.theme) notes.push(`Theme on <html> is "${theme}", expected "${variant.theme}".`);

    result.finalUrl = page.url();
    result.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await mkdir(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  } catch (error) {
    result.status = result.status || 0;
    notes.push(`Capture failed: ${(error as Error).message.split("\n")[0]}`);
  }

  const wanted = target.expectStatus ?? 200;

  if (result.status !== wanted) notes.push(`Status ${result.status}, expected ${wanted}.`);
  if (new URL(result.finalUrl).pathname !== new URL(target.url).pathname) notes.push(`Redirected to ${new URL(result.finalUrl).pathname}.`);

  result.consoleErrors = [...new Set(errors)];

  return result;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const prisma = new PrismaClient();
  const forum = await mintForumSession(prisma);
  const browser = await chromium.launch();
  const captures: Capture[] = [];
  let aborted = false;

  const cleanup = async () => {
    await forum.revoke().catch(() => console.error("Could not delete the minted forum session row; it expires in an hour."));
    await prisma.$disconnect();
  };

  process.once("SIGINT", () => {
    aborted = true;
    void cleanup().finally(() => process.exit(130));
  });

  try {
    const adminState = await logInAsAdmin(browser);
    const contexts = new Map<string, Tracked>();

    const trackedFor = async (auth: Auth, variant: Variant): Promise<Tracked> => {
      const key = `${auth}:${variantLabel(variant)}`;
      let tracked = contexts.get(key);

      if (!tracked) {
        const context = await newContext(browser, variant, { storageState: auth === "admin" ? adminState : undefined });

        if (auth === "forum") await context.addCookies([{ name: "forum_session", value: forum.token, domain: "localhost", path: "/foro", httpOnly: true, sameSite: "Lax" }]);
        tracked = await track(context);
        contexts.set(key, tracked);
      }

      return tracked;
    };

    // Discovery reads the lists and the database; it navigates only.
    const discoveryContext = await newContext(browser, DESKTOP_DARK, { storageState: adminState });
    const discoveryPage = await discoveryContext.newPage();
    const landingContext = await newContext(browser, DESKTOP_DARK);
    const targets = [
      loginTarget(),
      ...(await adminTargets(discoveryPage)),
      ...(await forumTargets(prisma)),
      ...(await landingTargets(await landingContext.newPage())),
    ];

    await discoveryContext.close();
    await landingContext.close();
    console.log(`Capturing ${targets.length} screens x ${VARIANTS.length} variants.`);

    for (const target of targets) {
      for (const variant of VARIANTS) {
        if (aborted) break;

        const result = await capture(await trackedFor(target.auth, variant), target, variant);
        const flags = [result.status !== (target.expectStatus ?? 200) ? `status ${result.status}` : "", result.consoleErrors.length ? `${result.consoleErrors.length} console errors` : "", result.horizontalOverflow ? "overflow" : ""].filter(Boolean);

        captures.push(result);
        console.log(`${target.area}/${target.name} ${variantLabel(variant)}${flags.length ? `  !! ${flags.join(", ")}` : ""}`);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(captures, null, 2)}\n`);
    await cleanup();
  }

  console.log(`Done: ${captures.length} captures, manifest at ${path.join(OUTPUT_DIR, "manifest.json")}.`);
}

main().catch((error: unknown) => {
  console.error(`UI audit failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
