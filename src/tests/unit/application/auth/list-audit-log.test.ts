import { describe, expect, it } from "vitest";

import { AUDIT_PAGE_SIZE, ListAuditLogUseCase, clampPage } from "@/application/auth/list-audit-log.use-case";
import { InMemoryAuditLog } from "@/tests/fakes/in-memory-auth";

async function logWith(count: number) {
  const log = new InMemoryAuditLog();

  for (let index = 0; index < count; index += 1) {
    await log.record({ actorUserId: index % 2 ? "ana" : null, actorKind: index % 2 ? "user" : "break_glass", action: "event.create", entityType: index % 3 ? "event" : "faq", summary: `n${index}` });
  }

  return log;
}

describe("ListAuditLogUseCase", () => {
  it("pages the log newest first and reports the page count", async () => {
    const log = await logWith(AUDIT_PAGE_SIZE + 5);
    const list = new ListAuditLogUseCase(log);

    const first = await list.execute({ page: 1 });
    const second = await list.execute({ page: 2 });

    expect(first.items).toHaveLength(AUDIT_PAGE_SIZE);
    expect(first.items[0]?.summary).toBe(`n${AUDIT_PAGE_SIZE + 4}`);
    expect(second.items).toHaveLength(5);
    expect(first).toMatchObject({ total: AUDIT_PAGE_SIZE + 5, pageCount: 2, page: 1 });
  });

  it("filters by entity type and by actor", async () => {
    const list = new ListAuditLogUseCase(await logWith(9));

    expect((await list.execute({ page: 1, entityType: "faq" })).items.every((entry) => entry.entityType === "faq")).toBe(true);
    expect((await list.execute({ page: 1, actor: "ana" })).total).toBe(4);
    expect((await list.execute({ page: 1, actor: "break_glass" })).total).toBe(5);
  });

  it("lists the entity types that exist, for the filter", async () => {
    expect((await new ListAuditLogUseCase(await logWith(4)).execute({ page: 1 })).entityTypes).toEqual(["event", "faq"]);
  });

  it.each([0, -3, Number.NaN, 1.5])("treats page %s as the first page", async (page) => {
    expect((await new ListAuditLogUseCase(await logWith(2)).execute({ page })).page).toBe(1);
  });
});

describe("clampPage", () => {
  it.each([
    [1, 0, 1],
    [3, 0, 1],
    [1, 10, 1],
    [2, AUDIT_PAGE_SIZE + 1, 2],
    [3, AUDIT_PAGE_SIZE + 1, 2],
    [99, AUDIT_PAGE_SIZE * 3, 3],
    [3, AUDIT_PAGE_SIZE * 3, 3],
    [0, 100, 1],
    [-2, 100, 1],
    [Number.NaN, 100, 1],
    [1.5, 100, 1],
  ])("page %s of %s entries is page %s", (page, total, expected) => {
    expect(clampPage(page, total)).toBe(expected);
  });
});

describe("ListAuditLogUseCase with a page past the end", () => {
  it("returns the last page instead of an empty one", async () => {
    const list = new ListAuditLogUseCase(await logWith(AUDIT_PAGE_SIZE + 5));

    const result = await list.execute({ page: 99 });

    expect(result).toMatchObject({ page: 2, pageCount: 2 });
    expect(result.items).toHaveLength(5);
  });

  it("returns the first, empty page when the log (or the filter) has no entries", async () => {
    const result = await new ListAuditLogUseCase(await logWith(3)).execute({ page: 5, entityType: "nothing" });

    expect(result).toMatchObject({ page: 1, pageCount: 1, total: 0, items: [] });
  });
});

