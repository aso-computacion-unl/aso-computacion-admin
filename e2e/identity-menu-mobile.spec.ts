import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
// Signed cookie value of an editor session that scripts/run-e2e.mjs planted in the database (a named account).
const EDITOR_SESSION = process.env.E2E_EDITOR_SESSION ?? "";
const BASE_URL = "http://127.0.0.1:3100";
// Optional: a directory for evidence screenshots (never committed). Without it they only go to the test report.
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR ?? "";

// The phone sizes the admin is used at: a common large phone and the narrowest common one.
const PHONES = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
];

test.beforeAll(() => {
  expect(PASSWORD, "run the suite with `npm run e2e`").not.toBe("");
  expect(EDITOR_SESSION, "run the suite with `npm run e2e`").not.toBe("");
});

async function logInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot();

  await testInfo.attach(name, { body, contentType: "image/png" });
  if (SCREENSHOT_DIR) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`) });
  }
}

/**
 * The identity menu on a phone: the chip shrinks to the avatar, and the panel it opens has to stay on the
 * screen, above the bottom tab bar (z-40, fixed), without pushing the page sideways. Escape closes it and gives
 * the focus back to the chip, and every item in it can be tapped (nothing on top of it).
 */
async function checkMenu(page: Page, testInfo: TestInfo, label: string, viewport: { width: number; height: number }) {
  const chip = page.getByRole("banner").getByRole("button", { name: /^Menú de cuenta/ });

  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await chip.click({ trial: true });

  const chipBox = await chip.boundingBox();
  expect(chipBox, "the chip has a box").not.toBeNull();
  expect(chipBox!.x).toBeGreaterThanOrEqual(0);
  expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(viewport.width);
  // A thumb-sized target (h-11 min-w-11).
  expect(chipBox!.width).toBeGreaterThanOrEqual(44);
  expect(chipBox!.height).toBeGreaterThanOrEqual(44);

  await chip.click();
  await expect(chip).toHaveAttribute("aria-expanded", "true");

  const panel = page.locator(`[id="${await chip.getAttribute("aria-controls")}"]`);
  await expect(panel).toBeVisible();

  const tabBar = page.locator("nav.fixed[aria-label='Áreas']");
  await expect(tabBar).toBeVisible();
  const tabBarTop = (await tabBar.boundingBox())!.y;

  const items = [panel.getByRole("button", { name: /Modo (oscuro|claro)/ }), panel.getByRole("button", { name: "Cerrar sesión" })];
  for (const target of [panel, ...items]) {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box, "the menu part has a box").not.toBeNull();
    expect(box!.x, `${label}: left edge on screen`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${label}: right edge on screen`).toBeLessThanOrEqual(viewport.width);
    expect(box!.y, `${label}: top edge on screen`).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `${label}: above the tab bar`).toBeLessThanOrEqual(tabBarTop);
  }

  // Opening the menu does not make the page scroll sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await screenshot(page, testInfo, `identity-menu-${label}-${viewport.width}x${viewport.height}-open`);

  // Each item can be tapped: a trial click fails if anything (the tab bar, the page) covers it.
  for (const item of items) await item.click({ trial: true });

  await page.keyboard.press("Escape");
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  await expect(chip).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await screenshot(page, testInfo, `identity-menu-${label}-${viewport.width}x${viewport.height}-closed`);
}

for (const viewport of PHONES) {
  test.describe(`the identity menu at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: false, hasTouch: true });

    test("the emergency session's menu stays on screen, above the tab bar, and closes with Escape", async ({ page }, testInfo) => {
      await logInAsAdmin(page);
      await checkMenu(page, testInfo, "emergency", viewport);
    });

    test("a named editor's menu stays on screen, above the tab bar, and closes with Escape", async ({ page, context }, testInfo) => {
      await context.clearCookies();
      await context.addCookies([{ name: "admin_session", value: EDITOR_SESSION, url: BASE_URL }]);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin$/);
      await checkMenu(page, testInfo, "editor", viewport);
    });
  });
}
