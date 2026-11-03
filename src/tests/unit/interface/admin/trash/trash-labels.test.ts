import { describe, expect, it } from "vitest";

import { TRASH_KINDS } from "@/application";
import { formatDeletedAt, groupTrash, purgeWarning, TRASH_KIND_LABELS } from "@/interface/admin/trash/trash-labels";

const entry = (kind: (typeof TRASH_KINDS)[number], id: string, deletedAt: string) => ({ kind, id, title: id, deletedAt: new Date(deletedAt) });

describe("trash labels", () => {
  it("names every kind of content in Spanish", () => {
    expect(Object.keys(TRASH_KIND_LABELS).sort()).toEqual([...TRASH_KINDS].sort());
    expect(Object.values(TRASH_KIND_LABELS).every((label) => label.length > 0)).toBe(true);
  });

  it.each([
    ["event", /evento.*fotos/i],
    ["news", /noticia.*portada/i],
    ["pillar", /pilar.*imagen/i],
    ["board", /integrante.*foto/i],
    ["faq", /pregunta/i],
    ["command", /comando/i],
    ["social", /red/i],
  ] as const)("the %s purge warning says what is lost, and that it cannot be undone", (kind, lost) => {
    const warning = purgeWarning(kind);

    expect(warning).toMatch(/^¿Eliminar definitivamente/);
    expect(warning).toMatch(lost);
  });

  it("formats the deletion time where the board lives, not in the server's zone", () => {
    // 02:30 UTC on the 26th is 21:30 on the 25th in Loja (UTC-5).
    expect(formatDeletedAt(new Date("2026-10-26T02:30:00Z"))).toMatch(/25.*oct.*2026.*21:30/);
  });

  it("groups by kind in a fixed order, keeping the newest-first order inside each group and skipping empty kinds", () => {
    const groups = groupTrash([entry("faq", "f2", "2026-10-02"), entry("event", "e1", "2026-10-03"), entry("faq", "f1", "2026-10-01")]);

    expect(groups.map((group) => [group.kind, group.items.map((item) => item.id)])).toEqual([
      ["event", ["e1"]],
      ["faq", ["f2", "f1"]],
    ]);
  });
});
