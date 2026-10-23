import path from "node:path";

import { defineConfig } from "vitest/config";

// Config for `npm run seed:landing` (vite-node): resolves the `@/` alias like the app does, and
// turns the `server-only` guard into a no-op, since this runs in Node and never in a client bundle.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: path.resolve(__dirname, "empty-module.ts") },
      { find: /^@\//, replacement: `${path.resolve(__dirname, "../src")}/` },
    ],
  },
});
