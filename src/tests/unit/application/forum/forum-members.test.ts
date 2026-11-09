import { beforeEach, describe, expect, it } from "vitest";

import { FORUM_MEMBERS_PAGE_SIZE, ListForumMembersUseCase } from "@/application/forum/forum-members.use-cases";
import { InMemoryForumMemberRepository, makeForumMember } from "@/tests/fakes/in-memory-forum";

const NOW = new Date("2026-10-27T12:00:00.000Z");

let members: InMemoryForumMemberRepository;

const list = (input: Partial<Parameters<ListForumMembersUseCase["execute"]>[0]> = {}) => new ListForumMembersUseCase(members).execute({ filter: "all", search: "", page: 1, ...input });
const member = (id: string, overrides: Parameters<typeof makeForumMember>[0] = {}) =>
  makeForumMember({ id, email: `${id}@unl.edu.ec`, googleSub: `sub-${id}`, displayName: id.toUpperCase(), ...overrides });

beforeEach(() => {
  members = new InMemoryForumMemberRepository([
    member("ana", { displayName: "Ana Pérez", createdAt: new Date("2026-10-01T00:00:00.000Z"), lastLoginAt: new Date("2026-10-20T00:00:00.000Z") }),
    member("beto", { displayName: "Beto Ruiz", createdAt: new Date("2026-10-03T00:00:00.000Z") }),
    member("cris", { displayName: "Cristina", createdAt: new Date("2026-10-02T00:00:00.000Z"), status: "SUSPENDED", suspendedAt: NOW }),
  ]);
});

describe("ListForumMembersUseCase", () => {
  it("lists every member, the newest first, with what a moderator needs: name, email, status and dates", async () => {
    const page = await list();

    expect(page).toMatchObject({ total: 3, page: 1, pageCount: 1 });
    expect(page.items.map((item) => item.id)).toEqual(["beto", "cris", "ana"]);
    expect(page.items[2]).toEqual({
      id: "ana",
      displayName: "Ana Pérez",
      email: "ana@unl.edu.ec",
      status: "ACTIVE",
      suspendedAt: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      lastLoginAt: new Date("2026-10-20T00:00:00.000Z"),
    });
  });

  it("never hands out the Google id", async () => {
    const page = await list();

    expect(JSON.stringify(page)).not.toContain("sub-");
  });

  it("keeps only the suspended members with the suspended filter", async () => {
    const page = await list({ filter: "suspended" });

    expect(page.items.map((item) => item.id)).toEqual(["cris"]);
    expect(page.total).toBe(1);
  });

  it("searches the display name or the email, ignoring case and surrounding spaces", async () => {
    expect((await list({ search: "pérez" })).items.map((item) => item.id)).toEqual(["ana"]);
    expect((await list({ search: "  BETO@unl " })).items.map((item) => item.id)).toEqual(["beto"]);
    expect((await list({ search: "nadie" })).items).toEqual([]);
  });

  it("combines the search with the suspended filter", async () => {
    expect((await list({ filter: "suspended", search: "ana" })).items).toEqual([]);
    expect((await list({ filter: "suspended", search: "cris" })).items.map((item) => item.id)).toEqual(["cris"]);
  });

  it("treats the wildcard characters of a search as plain text", async () => {
    members.members.set("pct", member("pct", { displayName: "100%" }));

    expect((await list({ search: "%" })).items.map((item) => item.id)).toEqual(["pct"]);
    expect((await list({ search: "_" })).items).toEqual([]);
  });

  describe("pages", () => {
    beforeEach(() => {
      for (let index = 0; index < FORUM_MEMBERS_PAGE_SIZE; index += 1) {
        members.members.set(`m${index}`, member(`m${index}`, { createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)) }));
      }
    });

    it("splits the list by the page size", async () => {
      const first = await list();
      const second = await list({ page: 2 });

      expect(first).toMatchObject({ total: FORUM_MEMBERS_PAGE_SIZE + 3, page: 1, pageCount: 2 });
      expect(first.items).toHaveLength(FORUM_MEMBERS_PAGE_SIZE);
      expect(second.items).toHaveLength(3);
    });

    it("shows the last page for a page past the end, and the first for a page that is not a positive integer", async () => {
      expect((await list({ page: 99 })).page).toBe(2);
      expect((await list({ page: 0 })).page).toBe(1);
      expect((await list({ page: 1.5 })).page).toBe(1);
    });
  });

  it("has one empty page when there are no members", async () => {
    members.members.clear();

    expect(await list()).toEqual({ items: [], total: 0, page: 1, pageCount: 1 });
  });
});
