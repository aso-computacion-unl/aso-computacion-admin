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
 * The profile row on a phone: one full-width row at the top of the page (the rail's card is hidden), nothing
 * about the account in the top bar. Its actions are thumb-sized, stay on the screen above the floating bottom
 * bar, can be tapped (nothing on top of them) and do not push the page sideways. The emergency session has no
 * account, so its row has no «Mis sesiones» and reads «Emergencia».
 */
async function checkProfileRow(page: Page, testInfo: TestInfo, label: "emergency" | "editor", viewport: { width: number; height: number }) {
  const rows = page.getByRole("region", { name: /^Sesión:/ });
  await expect(rows).toHaveCount(1);
  const row = rows.first();
  await expect(row).toBeVisible();
  await expect(row).toHaveAccessibleName(label === "emergency" ? "Sesión: acceso de emergencia" : /^Sesión: .+, Editor$/);
  if (label === "emergency") await expect(row).toContainText("Emergencia");
  await expect(page.getByRole("banner").getByRole("button", { name: /Cerrar sesión|Menú de cuenta/ })).toHaveCount(0);

  const tabBar = page.locator("nav.fixed[aria-label='Áreas']");
  await expect(tabBar).toBeVisible();
  const tabBarTop = (await tabBar.boundingBox())!.y;

  const sessions = row.getByRole("link", { name: "Mis sesiones" });
  await expect(sessions).toHaveCount(label === "emergency" ? 0 : 1);
  const items = [
    ...(label === "emergency" ? [] : [sessions]),
    row.getByRole("button", { name: /Modo (oscuro|claro)/ }),
    row.getByRole("button", { name: "Cerrar sesión" }),
  ];
  for (const target of [row, ...items]) {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box, "the row part has a box").not.toBeNull();
    expect(box!.x, `${label}: left edge on screen`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${label}: right edge on screen`).toBeLessThanOrEqual(viewport.width);
    expect(box!.y, `${label}: top edge on screen`).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `${label}: above the tab bar`).toBeLessThanOrEqual(tabBarTop);
  }
  // A thumb-sized target (size-11).
  for (const item of items) {
    const box = (await item.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  // The row does not make the page scroll sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await screenshot(page, testInfo, `profile-row-${label}-${viewport.width}x${viewport.height}`);

  // Each action can be tapped: a trial click fails if anything (the tab bar, the page) covers it.
  for (const item of items) await item.click({ trial: true });
}

for (const viewport of PHONES) {
  test.describe(`the profile row at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: false, hasTouch: true });

    test("the emergency session's row stays on screen, above the tab bar, and every action can be tapped", async ({ page }, testInfo) => {
      await logInAsAdmin(page);
      await checkProfileRow(page, testInfo, "emergency", viewport);
    });

    test("a named editor's row stays on screen, above the tab bar, and every action can be tapped", async ({ page, context }, testInfo) => {
      await context.clearCookies();
      await context.addCookies([{ name: "admin_session", value: EDITOR_SESSION, url: BASE_URL }]);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin$/);
      await checkProfileRow(page, testInfo, "editor", viewport);
    });
  });
}
