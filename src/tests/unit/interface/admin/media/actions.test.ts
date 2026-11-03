import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock, deletion } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn(), deletion: { execute: vi.fn() } }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/interface/admin/media/media-container", () => ({ getOrphanDeletion: () => deletion }));

import { ORPHAN_DELETE_MAX } from "@/application";
import { deleteOrphanImages } from "@/interface/admin/media/actions";
import { ORPHAN_IDS_MESSAGE } from "@/interface/admin/media/media-input";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";

describe("deleteOrphanImages", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    cookieJar(cookiesMock, await signInAs("ADMIN"));
  });

  it("reports every image, audits only the files destroyed and refreshes the pages", async () => {
    deletion.execute.mockImplementation(async ({ onDeleted }: { onDeleted: (id: string) => Promise<void> }) => {
      await onDeleted("aso/a");

      return [
        { publicId: "aso/a", outcome: "deleted" },
        { publicId: "aso/b", outcome: "in_use" },
        { publicId: "aso/c", outcome: "too_recent" },
        { publicId: "aso/d", outcome: "not_found" },
        { publicId: "aso/e", outcome: "failed" },
      ];
    });

    const result = await deleteOrphanImages(["aso/a", "aso/b", "aso/c", "aso/d", "aso/e"]);

    expect(result.results?.map((item) => [item.id, item.ok])).toEqual([
      ["aso/a", true],
      ["aso/b", false],
      ["aso/c", false],
      ["aso/d", false],
      ["aso/e", false],
    ]);
    expect(result.results?.[1]?.error).toContain("se usa");
    expect(result.results?.[2]?.error).toContain("24 horas");
    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityType, entry.entityId])).toEqual([["media.delete_orphan", "media", "aso/a"]]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/medios");
  });

  it("writes the audit entry as each file is destroyed, so a request cut short never leaves a deleted file unaudited", async () => {
    const seen: number[] = [];

    deletion.execute.mockImplementation(async ({ onDeleted }: { onDeleted: (id: string) => Promise<void> }) => {
      await onDeleted("aso/a");
      seen.push(testAuth.audit.entries.length);
      await onDeleted("aso/b");
      seen.push(testAuth.audit.entries.length);
      throw new Error("the platform killed the function");
    });

    await deleteOrphanImages(["aso/a", "aso/b", "aso/c"]);

    expect(seen).toEqual([1, 2]);
    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityId]).sort()).toEqual([
      ["media.delete_orphan", "aso/a"],
      ["media.delete_orphan", "aso/b"],
    ]);
  });

  it("writes no audit entry and refreshes nothing when no file was destroyed", async () => {
    deletion.execute.mockResolvedValue([{ publicId: "aso/b", outcome: "in_use" }]);

    await deleteOrphanImages(["aso/b"]);

    expect(testAuth.audit.entries).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("passes the ids on without repeats, in order", async () => {
    deletion.execute.mockResolvedValue([]);

    await deleteOrphanImages(["aso/a", "aso/b", "aso/a"]);

    expect(deletion.execute).toHaveBeenCalledWith({ publicIds: ["aso/a", "aso/b"], onDeleted: expect.any(Function) });
  });

  it.each([
    ["none", []],
    ["too many", Array.from({ length: ORPHAN_DELETE_MAX + 1 }, (_, index) => `aso/${index}`)],
    ["a blank id", [" "]],
    ["a path that climbs out", ["aso/../secret"]],
    ["a current-folder segment", ["aso/./x"]],
    ["a non-string", [42]],
    ["not a list", "aso/a"],
  ])("refuses %s without destroying anything", async (_label, ids) => {
    expect(await deleteOrphanImages(ids as string[])).toEqual({ error: ORPHAN_IDS_MESSAGE });
    expect(deletion.execute).not.toHaveBeenCalled();
  });
});
