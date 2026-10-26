import { defineConfig } from "vitest/config";
import path from "path";

import { INTEGRATION_SUITES } from "./src/tests/support/integration-suites";

export default defineConfig({
  // Next.js compiles JSX with the automatic runtime; mirror it here so app
  // components written in JSX (no React import) stay unit-testable.
  esbuild: { jsx: "automatic" },
  resolve: {
    // Mirrors the `paths` in tsconfig.json; the more specific aliases come first.
    alias: {
      "@/components": path.resolve(__dirname, "./components"),
      "@/lib": path.resolve(__dirname, "./lib"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    exclude: [...INTEGRATION_SUITES],
    coverage: {
      provider: "v8",
      // Floor of the coverage measured when the gate was added. Raise these as
      // coverage grows; never lower them to make a change pass.
      thresholds: {
        lines: 56,
        statements: 56,
        branches: 93,
        functions: 78,
      },
    },
  },
});
