import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

type PoolOptions = {
  /** Largest number of connections the client opens (the `pg` default is 10). */
  max?: number;
  /** How long to wait for a connection before failing; the `pg` default is to wait forever. */
  connectionTimeoutMillis?: number;
};

/**
 * Builds a Prisma client over the `pg` driver adapter. Prisma 7 no longer reads `DATABASE_URL`
 * (or `.env`) by itself, so every client states its connection string. No `server-only` guard:
 * the seed scripts and the Playwright specs build their own clients with this too.
 */
export function createPrismaClient(connectionString: string | undefined, poolOptions: PoolOptions = {}): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, ...poolOptions }) });
}
