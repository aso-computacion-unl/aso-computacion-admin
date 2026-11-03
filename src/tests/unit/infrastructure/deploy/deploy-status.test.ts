import { beforeEach, describe, expect, it, vi } from "vitest";

const { record, findLast, reportError } = vi.hoisted(() => ({ record: vi.fn(), findLast: vi.fn(), reportError: vi.fn() }));

vi.mock("@/infrastructure/repositories/deploy-status-prisma.repository", () => ({
  DeployStatusPrismaRepository: class {
    record = record;
    findLast = findLast;
  },
}));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError }));

import { readLastDeployStatus, recordDeployOutcome } from "@/infrastructure/deploy/deploy-status";

const NOW = new Date("2026-10-25T12:00:00.000Z");

beforeEach(() => {
  record.mockReset();
  findLast.mockReset();
  reportError.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("recordDeployOutcome", () => {
  it("stores the outcome with the time of the attempt", async () => {
    await recordDeployOutcome({ ok: true, httpStatus: 200 }, NOW);

    expect(record).toHaveBeenCalledWith({ ok: true, httpStatus: 200 }, NOW);
  });

  it("swallows a recorder failure: it logs and reports it, never throws", async () => {
    record.mockRejectedValue(new Error("db down"));

    await expect(recordDeployOutcome({ ok: false, errorKind: "network" }, NOW)).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it("does not leak the error text, which could carry a connection string, into the log line", async () => {
    record.mockRejectedValue(new Error("connect postgres://user:secret@db/aso"));

    await recordDeployOutcome({ ok: true, httpStatus: 200 }, NOW);

    expect(String(vi.mocked(console.warn).mock.calls.flat())).not.toContain("secret");
  });
});

describe("readLastDeployStatus", () => {
  it("returns what the repository holds", async () => {
    const status = { attemptedAt: NOW, ok: true, httpStatus: 200, errorKind: null };
    findLast.mockResolvedValue(status);

    expect(await readLastDeployStatus()).toEqual(status);
  });
});
