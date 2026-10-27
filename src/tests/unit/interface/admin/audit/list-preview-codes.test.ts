import { describe, expect, it } from "vitest";

import { ListPreviewCodesUseCase, PREVIEW_CODES_LIMIT } from "@/application/audit/list-preview-codes.use-case";
import type { AuditEntryInput } from "@/application/ports/auth.ports";
import { InMemoryAuditLog } from "@/tests/fakes/in-memory-auth";

const GENERATED: AuditEntryInput = {
  actorUserId: "ana",
  actorKind: "user",
  action: "preview.token_create",
  entityType: "preview",
  entityId: "24h",
  summary: "Código de vista previa generado (24 horas)",
};

async function logWith(...entries: Partial<AuditEntryInput>[]) {
  const log = new InMemoryAuditLog();

  for (const entry of entries) await log.record({ ...GENERATED, ...entry });

  return log;
}

describe("ListPreviewCodesUseCase", () => {
  it("shows an Admin every generation, whoever made it", async () => {
    const log = await logWith({ actorUserId: "ana" }, { actorUserId: "ben" }, { actorUserId: null, actorKind: "break_glass" });

    const rows = await new ListPreviewCodesUseCase(log).execute({ role: "ADMIN", userId: "root" });

    expect(rows.map((row) => row.actorUserId)).toEqual([null, "ben", "ana"]);
  });

  it("shows an Editor only the codes they generated, never another user's", async () => {
    const log = await logWith({ actorUserId: "ana" }, { actorUserId: "ben" }, { actorUserId: "ana" }, { actorUserId: null, actorKind: "break_glass" });

    const rows = await new ListPreviewCodesUseCase(log).execute({ role: "EDITOR", userId: "ana" });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.actorUserId === "ana")).toBe(true);
  });

  it("keeps the Editor's scope even when the reader ignores the actor filter", async () => {
    const log = await logWith({ actorUserId: "ana" }, { actorUserId: "ben" });
    const leaky = { list: (criteria: Parameters<typeof log.list>[0]) => log.list({ ...criteria, actor: undefined }), entityTypes: () => log.entityTypes() };

    const rows = await new ListPreviewCodesUseCase(leaky).execute({ role: "EDITOR", userId: "ana" });

    expect(rows.map((row) => row.actorUserId)).toEqual(["ana"]);
  });

  it("gives an Editor without an account id nothing instead of everything", async () => {
    const log = await logWith({ actorUserId: "ana" }, { actorUserId: null, actorKind: "break_glass" });

    expect(await new ListPreviewCodesUseCase(log).execute({ role: "EDITOR", userId: null })).toEqual([]);
  });

  it("leaves out every other kind of audit entry", async () => {
    const log = await logWith({}, { action: "event.create", entityType: "event" }, { action: "preview.other", entityType: "preview" });

    expect(await new ListPreviewCodesUseCase(log).execute({ role: "ADMIN", userId: "root" })).toHaveLength(1);
  });

  it("exposes when, who and how long, and never a token or any other field of the entry", async () => {
    const log = await logWith({});
    // A hostile or future entry shape: fields the use case did not ask for must not travel.
    Object.assign(log.entries[0]!, { token: "eyJsecret.token.value", secret: "s3cr3t" });

    const [row] = await new ListPreviewCodesUseCase(log).execute({ role: "ADMIN", userId: "root" });

    expect(Object.keys(row!).sort()).toEqual(["actorKind", "actorUserId", "at", "id", "lifetimeHint", "summary"]);
    expect(JSON.stringify(row)).not.toMatch(/eyJsecret|s3cr3t|token"/);
    expect(row).toMatchObject({ actorUserId: "ana", lifetimeHint: "24h", summary: GENERATED.summary });
  });

  it("reads the lifetime of an older entry, written before it was recorded, from its summary", async () => {
    const log = await logWith({ entityId: null, summary: "Código de vista previa generado (7 días)" });

    const [row] = await new ListPreviewCodesUseCase(log).execute({ role: "ADMIN", userId: "root" });

    expect(row?.lifetimeHint).toBeNull();
    expect(row?.summary).toContain("7 días");
  });

  it("returns the newest first and no more than the limit", async () => {
    const log = await logWith(...Array.from({ length: PREVIEW_CODES_LIMIT + 3 }, (_, index) => ({ summary: `n${index}` })));

    const rows = await new ListPreviewCodesUseCase(log).execute({ role: "ADMIN", userId: "root" });

    expect(rows).toHaveLength(PREVIEW_CODES_LIMIT);
    expect(rows[0]?.summary).toBe(`n${PREVIEW_CODES_LIMIT + 2}`);
  });
});
