import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, requestSiteRebuildMock, revalidatePathMock, target } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  requestSiteRebuildMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  target: { reorder: { execute: vi.fn() } },
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));
vi.mock("@/interface/admin/reorder/reorder-container", () => ({ getReorderTarget: () => target }));

import { NotFoundError } from "@/application";
import { reorderContent } from "@/interface/admin/reorder/actions";
import { REORDER_KIND_MESSAGE } from "@/interface/admin/reorder/reorder-input";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";

describe("reorderContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    target.reorder.execute.mockResolvedValue(undefined);
  });

  it.each([
    ["impact", "/admin/impact", "Cifra de impacto reordenada"],
    ["testimonial", "/admin/testimonials", "Testimonio reordenado"],
    ["sponsor", "/admin/sponsors", "Aliado reordenado"],
  ])("reorders the social proof list %s the same way", async (kind, path, summary) => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    expect(await reorderContent(kind, "x-1", 0)).toEqual({ success: true });

    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityType, entry.summary])).toEqual([[`${kind}.move`, kind, summary]]);
    expect(revalidatePathMock).toHaveBeenCalledWith(path);
  });

  it("moves the item to the place, audits it as the single-step move does, and refreshes the list and the site", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    expect(await reorderContent("pillar", "p-1", 2)).toEqual({ success: true });

    expect(target.reorder.execute).toHaveBeenCalledWith({ id: "p-1", position: 2 });
    expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityType, entry.entityId, entry.actorUserId])).toEqual([
      ["pillar.move", "pillar", "p-1", "test-editor"],
    ]);
    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/pillars");
  });

  it.each([
    ["event", "p-1", 1],
    ["faq", "", 1],
    ["faq", "p-1", -1],
    ["faq", "p-1", 1.5],
  ])("refuses %s / %j / %j without touching anything", async (kind, id, position) => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    expect(await reorderContent(kind, id, position)).toHaveProperty("error");

    expect(target.reorder.execute).not.toHaveBeenCalled();
    expect(testAuth.audit.entries).toEqual([]);
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it("says the list cannot be reordered for a kind that has no order", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    expect(await reorderContent("news", "n-1", 0)).toEqual({ error: REORDER_KIND_MESSAGE });
  });

  it("reports an item that no longer exists, with no audit entry and no rebuild", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));
    target.reorder.execute.mockRejectedValue(new NotFoundError("Pillar not found"));

    expect(await reorderContent("pillar", "gone", 0)).toHaveProperty("error");

    expect(testAuth.audit.entries).toEqual([]);
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
