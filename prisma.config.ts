import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads `.env` on its own. Load it for local runs; variables already in the
// environment (CI, the integration runner, a one-off `DATABASE_URL=... prisma migrate deploy`) win.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // The Prisma CLI needs the direct (non-pooled) string for `migrate deploy`; `prisma generate`
    // runs in CI with no database, so a missing value must not fail config loading.
    url: process.env.DATABASE_URL ?? "",
  },
});
