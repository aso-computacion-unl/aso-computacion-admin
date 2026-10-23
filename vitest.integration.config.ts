import path from "path";
import { defineConfig } from "vitest/config";

import { INTEGRATION_SUITES } from "./src/tests/support/integration-suites";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    allowOnly: false,
    environment: "node",
    // Integration suites share one real Postgres instance; running files in
    // parallel races each other's beforeEach cleanup against concurrently
    // seeded rows. Force sequential file execution to keep each suite's
    // row counts deterministic.
    fileParallelism: false,
    include: [...INTEGRATION_SUITES],
    // No suites exist until the first content entity lands.
    passWithNoTests: true,
    setupFiles: ["src/tests/support/prisma-integration.setup.ts"],
  },
});
