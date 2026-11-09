import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, closeMock } = vi.hoisted(() => ({ executeMock: vi.fn(), closeMock: vi.fn() }));

vi.mock("@/interface/cron/registration-reminders-container", () => ({ getRegistrationReminders: () => ({ execute: executeMock, close: closeMock }) }));

import { REMINDER_TIME_BUDGET_MS, runRegistrationReminders } from "@/interface/cron/registration-reminders";

const NOW = new Date("2026-11-20T11:00:00.000Z");
const RESULT = { sent: 4, failed: 0, events: 1, stoppedBy: "done" } as const;

beforeEach(() => {
  executeMock.mockReset();
  closeMock.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runRegistrationReminders", () => {
  it("sends the reminders due at the given time and returns the counts", async () => {
    executeMock.mockResolvedValue(RESULT);

    expect(await runRegistrationReminders(NOW, { startedAt: Date.now() })).toEqual(RESULT);
    expect(executeMock).toHaveBeenCalledOnce();
    expect(executeMock.mock.calls[0]![0].now).toBe(NOW);
  });

  it("tells the use case to stop starting sends once 45 seconds of the function's time are gone", async () => {
    executeMock.mockResolvedValue(RESULT);
    await runRegistrationReminders(NOW, { startedAt: Date.now() });

    const { shouldStop } = executeMock.mock.calls[0]![0] as { shouldStop: () => boolean };

    expect(REMINDER_TIME_BUDGET_MS).toBe(45_000);
    expect(shouldStop()).toBe(false);
    vi.setSystemTime(new Date(NOW.getTime() + REMINDER_TIME_BUDGET_MS - 1));
    expect(shouldStop()).toBe(false);
    vi.setSystemTime(new Date(NOW.getTime() + REMINDER_TIME_BUDGET_MS));
    expect(shouldStop()).toBe(true);
  });

  it("counts the time from when the route started, not from when the step did", async () => {
    executeMock.mockResolvedValue(RESULT);
    await runRegistrationReminders(NOW, { startedAt: Date.now() - 40_000 });

    const { shouldStop } = executeMock.mock.calls[0]![0] as { shouldStop: () => boolean };

    expect(shouldStop()).toBe(false);
    vi.setSystemTime(new Date(NOW.getTime() + 5_000));
    expect(shouldStop()).toBe(true);
  });

  it("closes the mail connection after the run, and also when the run fails, and lets the failure through", async () => {
    executeMock.mockResolvedValueOnce(RESULT);
    await runRegistrationReminders(NOW, { startedAt: Date.now() });
    expect(closeMock).toHaveBeenCalledTimes(1);

    const failure = new Error("smtp down");

    executeMock.mockRejectedValueOnce(failure);
    await expect(runRegistrationReminders(NOW, { startedAt: Date.now() })).rejects.toBe(failure);
    expect(closeMock).toHaveBeenCalledTimes(2);
  });

  it("does not let a failure to close hide the result", async () => {
    executeMock.mockResolvedValue(RESULT);
    closeMock.mockRejectedValue(new Error("socket"));

    expect(await runRegistrationReminders(NOW, { startedAt: Date.now() })).toEqual(RESULT);
  });
});
