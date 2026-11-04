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
    setupFiles: ["src/tests/support/auth-doubles.setup.ts"],
    coverage: {
      provider: "v8",
      // Vitest 4 dropped `coverage.all`: without an explicit include, files no
      // test imports would silently leave the report.
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "src/**/*.{ts,tsx}",
        "scripts/**/*.{ts,mts,mjs}",
        "middleware.ts",
        "instrumentation*.ts",
      ],
      exclude: ["src/tests/**", "src/generated/**", "**/*.d.{ts,mts}", "scripts/**/*.config.ts"],
      // Floor of the coverage measured under Vitest 5's AST-aware v8 remapping.
      // Vitest 4 replaced v8-to-istanbul and dropped `coverage.all`, so the same
      // tests report different numbers than under v3 (branches 94 there, 74.86
      // here). Raise these as coverage grows; never lower them to make a change
      // pass.
      thresholds: {
        lines: 77,
        statements: 76,
        branches: 74,
        functions: 71,
      },
    },
  },
});
