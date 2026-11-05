import { describe, expect, it } from "vitest";

import { groupSessionsByPerson, type GroupableSession } from "@/interface/admin/sessions/group-sessions";

const session = (id: string, userId: string | null, over: Partial<GroupableSession> = {}): GroupableSession => ({
  id,
  userId,
  kind: userId ? "user" : "break_glass",
  userName: userId ? userId.toUpperCase() : null,
  userEmail: userId ? `${userId}@example.org` : null,
  isCurrent: false,
  ...over,
});

describe("groupSessionsByPerson", () => {
  it("puts each person's sessions together, keeping the incoming (newest first) order inside and between groups", () => {
    const groups = groupSessionsByPerson([session("1", "ben"), session("2", "ana"), session("3", "ben")]);

    expect(groups.map((group) => [group.userId, group.sessions.map((s) => s.id)])).toEqual([
      ["ben", ["1", "3"]],
      ["ana", ["2"]],
    ]);
  });

  it("lists the group with the current session first, then the others", () => {
    const groups = groupSessionsByPerson([session("1", "ben"), session("2", "ana", { isCurrent: true })]);

    expect(groups.map((group) => group.userId)).toEqual(["ana", "ben"]);
    expect(groups[0]).toMatchObject({ isOwn: true });
    expect(groups[1]).toMatchObject({ isOwn: false });
  });

  it("collects every emergency session in one group with no user id, which cannot be closed in bulk", () => {
    const groups = groupSessionsByPerson([session("1", null), session("2", "ana"), session("3", null)]);

    expect(groups.map((group) => [group.userId, group.sessions.map((s) => s.id), group.closableOthers])).toEqual([
      [null, ["1", "3"], 0],
      ["ana", ["2"], 1],
    ]);
  });

  it("counts the sessions the bulk action would close: everything but the current one", () => {
    const [own, other] = groupSessionsByPerson([
      session("1", "ana", { isCurrent: true }),
      session("2", "ana"),
      session("3", "ana"),
      session("4", "ben"),
    ]);

    expect(own?.closableOthers).toBe(2);
    expect(other?.closableOthers).toBe(1);
  });

  it("returns no groups for no sessions", () => {
    expect(groupSessionsByPerson([])).toEqual([]);
  });
});
