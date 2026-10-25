import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";
import { DeployStatusPrismaRepository } from "@/infrastructure/repositories/deploy-status-prisma.repository";

const repository = new DeployStatusPrismaRepository();
const T0 = new Date("2026-10-25T12:00:00.000Z");

describe("DeployStatusPrismaRepository (integration)", () => {
  it("returns null before any attempt is recorded", async () => {
    expect(await repository.findLast()).toBeNull();
  });

  it("round-trips a success", async () => {
    await repository.record({ ok: true, httpStatus: 200 }, T0);

    expect(await repository.findLast()).toEqual({ attemptedAt: T0, ok: true, httpStatus: 200, errorKind: null });
  });

  it("round-trips a failure with an HTTP status and one with an error kind", async () => {
    await repository.record({ ok: false, httpStatus: 500 }, T0);
    expect(await repository.findLast()).toEqual({ attemptedAt: T0, ok: false, httpStatus: 500, errorKind: null });

    await repository.record({ ok: false, errorKind: "timeout" }, T0);
    expect(await repository.findLast()).toEqual({ attemptedAt: T0, ok: false, httpStatus: null, errorKind: "timeout" });
  });

  it("keeps only the last attempt: a later one replaces the earlier and the table holds a single row", async () => {
    await repository.record({ ok: false, httpStatus: 500 }, T0);
    await repository.record({ ok: true, httpStatus: 200 }, new Date(T0.getTime() + 60_000));

    expect(await repository.findLast()).toMatchObject({ ok: true, httpStatus: 200, errorKind: null });
    expect(await prisma.deployStatus.count()).toBe(1);
  });

  it("refuses, in the database, a second row", async () => {
    await repository.record({ ok: true, httpStatus: 200 }, T0);

    await expect(prisma.deployStatus.create({ data: { id: "other", attemptedAt: T0, ok: true } })).rejects.toThrow();
  });
});
