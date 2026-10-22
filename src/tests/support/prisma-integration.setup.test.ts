import { describe, expect, it, vi } from "vitest";

import { CANONICAL_TEST_DATABASE_URL } from "./prisma-test-target";
import {
  assertPrismaIntegrationEnvironment,
  createPrismaIntegrationCleanup,
} from "./prisma-integration-cleanup";

describe("createPrismaIntegrationCleanup", () => {
  it("rejects an unsafe target before cleanup can run", async () => {
    const cleanup = vi.fn();

    await expect(createPrismaIntegrationCleanup(undefined, undefined, cleanup)).rejects.toThrow(
      "TEST_DATABASE_URL must target the isolated Prisma test database.",
    );
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("cleans tables only after the canonical target is validated", async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);

    await createPrismaIntegrationCleanup(
      CANONICAL_TEST_DATABASE_URL,
      CANONICAL_TEST_DATABASE_URL,
      cleanup,
    );

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("rejects cleanup when Prisma DATABASE_URL differs from the validated test target", async () => {
    const cleanup = vi.fn();

    await expect(
      createPrismaIntegrationCleanup(
        CANONICAL_TEST_DATABASE_URL,
        "postgresql://development:development@127.0.0.1:5432/aso_computacion_admin?schema=public",
        cleanup,
      ),
    ).rejects.toThrow("DATABASE_URL must exactly match TEST_DATABASE_URL");
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("returns the validated URL only when Prisma will use the same exact value", () => {
    expect(
      assertPrismaIntegrationEnvironment(
        CANONICAL_TEST_DATABASE_URL,
        CANONICAL_TEST_DATABASE_URL,
      ).toString(),
    ).toBe(CANONICAL_TEST_DATABASE_URL);
  });
});
