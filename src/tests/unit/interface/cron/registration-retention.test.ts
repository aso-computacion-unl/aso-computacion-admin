import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/interface/cron/registration-retention-container", () => ({ getPurgeExpiredRegistrations: () => ({ execute: executeMock }) }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: vi.fn() }));

import { PurgeInterruptedError } from "@/application";
import { runRegistrationRetention } from "@/interface/cron/registration-retention";
import { testAuth } from "@/tests/support/test-auth";

const NOW = new Date("2026-04-11T11:00:00.000Z");

beforeEach(() => {
  executeMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("runRegistrationRetention", () => {
  it("purges at the given time and writes one audit entry by the system with the count and nothing else", async () => {
    executeMock.mockResolvedValue({ deleted: 7 });

    expect(await runRegistrationRetention(NOW)).toEqual({ deleted: 7 });
    expect(executeMock).toHaveBeenCalledWith(NOW);
    expect(testAuth.audit.entries).toHaveLength(1);
    expect(testAuth.audit.entries[0]).toMatchObject({
      actorUserId: null,
      actorKind: "system",
      action: "event.registration_purge",
      entityType: "event",
      entityId: null,
      summary: "Depuración de inscripciones: 7 eliminadas (90 días después de cada evento o correo sin confirmar en 48 h)",
    });
  });

  it("writes no entry when there was nothing to delete: an idle day leaves no trace in the log", async () => {
    executeMock.mockResolvedValue({ deleted: 0 });

    expect(await runRegistrationRetention(NOW)).toEqual({ deleted: 0 });
    expect(testAuth.audit.entries).toEqual([]);
  });

  it("audits what was already deleted when a later batch fails, then rethrows the real cause", async () => {
    const cause = new Error("connection reset");

    executeMock.mockRejectedValue(new PurgeInterruptedError(500, cause));

    await expect(runRegistrationRetention(NOW)).rejects.toBe(cause);
    expect(testAuth.audit.entries).toHaveLength(1);
    expect(testAuth.audit.entries[0]!.summary).toBe("Depuración de inscripciones interrumpida: 500 eliminadas antes del fallo");
  });

  it("lets any other failure through without writing an entry", async () => {
    const failure = new Error("db down");

    executeMock.mockRejectedValue(failure);

    await expect(runRegistrationRetention(NOW)).rejects.toBe(failure);
    expect(testAuth.audit.entries).toEqual([]);
  });

  it("an audit failure does not fail the purge that already happened", async () => {
    executeMock.mockResolvedValue({ deleted: 3 });
    testAuth.audit.failWith = new Error("audit down");

    expect(await runRegistrationRetention(NOW)).toEqual({ deleted: 3 });
  });
});
