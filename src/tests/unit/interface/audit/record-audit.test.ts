import { beforeEach, describe, expect, it, vi } from "vitest";

const { reportErrorMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn() }));

vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));

import { SYSTEM_ACTOR, recordAudit } from "@/interface/audit/record-audit";
import { testAuth } from "@/tests/support/test-auth";

const USER_ACTOR = { kind: "user", userId: "ana" } as const;

describe("recordAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("writes the entry through the AuditRecorder port, attributed to the actor", async () => {
    await recordAudit(USER_ACTOR, { action: "event.create", entityType: "event", entityId: "e1", summary: "Evento creado: Hackatón" });
    await recordAudit({ kind: "break_glass", userId: null }, { action: "faq.trash", entityType: "faq", summary: "Pregunta movida a la papelera" });
    await recordAudit(SYSTEM_ACTOR, { action: "login.failure", entityType: "session", summary: "Contraseña de emergencia rechazada" });

    expect(testAuth.audit.entries.map(({ actorUserId, actorKind, action, entityId }) => ({ actorUserId, actorKind, action, entityId }))).toEqual([
      { actorUserId: null, actorKind: "system", action: "login.failure", entityId: null },
      { actorUserId: null, actorKind: "break_glass", action: "faq.trash", entityId: null },
      { actorUserId: "ana", actorKind: "user", action: "event.create", entityId: "e1" },
    ]);
  });

  it("keeps the summary short enough for the column", async () => {
    await recordAudit(USER_ACTOR, { action: "a", entityType: "event", summary: "x".repeat(500) });

    expect(testAuth.audit.entries[0]?.summary).toHaveLength(200);
  });

  it("never fails the action when the audit write fails: it reports the error and says nothing about the entry's content", async () => {
    const failure = new Error("db down");
    testAuth.audit.failWith = failure;

    await expect(recordAudit(USER_ACTOR, { action: "event.update", entityType: "event", entityId: "e1", summary: "Evento editado: Secreto" })).resolves.toBeUndefined();

    expect(reportErrorMock).toHaveBeenCalledWith(failure, { action: "audit-log", audit: "event.update" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Secreto");
    expect(testAuth.audit.entries).toEqual([]);
  });
});
