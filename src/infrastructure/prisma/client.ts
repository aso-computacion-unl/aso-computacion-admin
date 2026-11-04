import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

import { createPrismaClient } from "./create-client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The runtime uses the pooled DATABASE_URL; only the Prisma CLI (migrations) takes the direct one.
// Prisma 6 gave up connecting after 5s by default; the `pg` driver never does, so keep that bound.
export const prisma =
  globalForPrisma.prisma ?? createPrismaClient(process.env.DATABASE_URL, { connectionTimeoutMillis: 5_000 });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
