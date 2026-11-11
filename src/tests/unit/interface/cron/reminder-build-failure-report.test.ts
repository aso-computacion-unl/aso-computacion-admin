import { describe, expect, it, vi } from "vitest";

import type { ReminderMessageBuilder } from "@/application";
import { reportingFirstBuildFailure } from "@/interface/cron/reminder-build-failure-report";

const EVENT = { id: "e1", slug: "charla", title: "Charla", date: "2026-11-21", datePrecision: "day", hora: null, lugar: null } as unknown as Parameters<ReminderMessageBuilder>[0];
const PERSON: Parameters<ReminderMessageBuilder>[1] = { id: "r1" };
const MESSAGE = { subject: "s", text: "t", html: "<p>t</p>" };

describe("reportingFirstBuildFailure", () => {
  it("reports the first message of a run that cannot be built, once, and still lets every failure through", async () => {
    const failure = new Error("REGISTRATION_CONFIRM_SECRET must be defined");
    const report = vi.fn();
    const build = reportingFirstBuildFailure(() => {
      throw failure;
    }, report);

    await expect(build(EVENT, PERSON)).rejects.toBe(failure);
    await expect(build(EVENT, { id: "r2" })).rejects.toBe(failure);

    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(failure);
  });

  it("reports nothing and returns the message when it can be built", async () => {
    const report = vi.fn();
    const build = reportingFirstBuildFailure(() => MESSAGE, report);

    expect(await build(EVENT, PERSON)).toBe(MESSAGE);
    expect(report).not.toHaveBeenCalled();
  });
});
