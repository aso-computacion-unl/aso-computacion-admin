import { defineConfig, devices } from "@playwright/test";

/**
 * Runs specs against an already running local instance (no build, no disposable database). For audits:
 *   ADMIN_PASSWORD=<that instance's password> DATABASE_URL=<its database> npx playwright test -c playwright.live.config.ts e2e/<spec>
 * The instance URL comes from LIVE_BASE_URL (default http://127.0.0.1:3100). `npm run e2e` stays the CI path.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.LIVE_BASE_URL ?? "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
