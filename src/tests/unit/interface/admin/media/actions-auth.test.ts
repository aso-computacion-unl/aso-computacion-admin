import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getOrphanDeletionMock, revalidatePathMock, deletion } = vi.hoisted(() => {
  const deletion = {
    execute: vi.fn(async ({ publicIds, onDeleted }: { publicIds: string[]; onDeleted: (publicId: string) => Promise<void> }) => {
      for (const publicId of publicIds) await onDeleted(publicId);

      return publicIds.map((publicId) => ({ publicId, outcome: "deleted" as const }));
    }),
  };

  return { cookiesMock: vi.fn(), getOrphanDeletionMock: vi.fn(() => deletion), revalidatePathMock: vi.fn(), deletion };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/interface/admin/media/media-container", () => ({ getOrphanDeletion: getOrphanDeletionMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import * as actions from "@/interface/admin/media/actions";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";
import { signInAs } from "@/tests/support/test-auth";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  deleteOrphanImages: () => actions.deleteOrphanImages(["aso/pillars/old"]),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({ get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined) });
}

describe("the orphan cleanup action requires an admin session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  });

  it("has an auth case for every exported action", () => {
    expect(Object.keys(ACTION_CALLS).sort()).toEqual(Object.keys(actions).sort());
  });

  describe.each([
    ["no cookie", undefined],
    ["a forged token", "forged.token.value"],
  ])("with %s", (_label, cookie) => {
    beforeEach(() => cookieJar(cookie));

    it.each(Object.entries(ACTION_CALLS))("%s rejects and destroys nothing", async (_name, call) => {
      expect(await call()).toEqual(SESSION_EXPIRED);
      expect(getOrphanDeletionMock).not.toHaveBeenCalled();
      expect(deletion.execute).not.toHaveBeenCalled();
    });
  });

  it("an editor is refused before anything is built or destroyed", async () => {
    cookieJar(await signInAs("EDITOR"));

    expect(await actions.deleteOrphanImages(["aso/pillars/old"])).toEqual({ error: "No tiene permiso para realizar esta acción." });
    expect(getOrphanDeletionMock).not.toHaveBeenCalled();
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/media/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });

  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: "src/interface/admin/media/actions.ts",
      actionCalls: ACTION_CALLS,
      cookiesMock,
      untouchedMocks: [getOrphanDeletionMock, revalidatePathMock],
    });
  });
});
