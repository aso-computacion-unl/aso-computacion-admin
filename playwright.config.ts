import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end tests against the production build (`next start`) and the disposable Postgres. Run them with
 * `npm run e2e`, which starts the database, migrates it, builds the app and tears everything down
 * (scripts/run-e2e.mjs); the app gets its test-only environment from that script.
 */
export default defineConfig({
  testDir: "./e2e",
  // One shared database and one admin session: no parallelism.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start --hostname 127.0.0.1 --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
