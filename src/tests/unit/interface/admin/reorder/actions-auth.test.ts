import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getReorderTargetMock, requestSiteRebuildMock, revalidatePathMock, target } = vi.hoisted(() => {
  const target = { reorder: { execute: vi.fn(async () => undefined) } };

  return { cookiesMock: vi.fn(), getReorderTargetMock: vi.fn(() => target), requestSiteRebuildMock: vi.fn(), revalidatePathMock: vi.fn(), target };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));
vi.mock("@/interface/admin/reorder/reorder-container", () => ({ getReorderTarget: getReorderTargetMock }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import * as actions from "@/interface/admin/reorder/actions";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";
import { signInAs } from "@/tests/support/test-auth";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  reorderContent: () => actions.reorderContent("faq", "faq-1", 0),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({ get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined) });
}

describe("the reorder server action requires an admin session", () => {
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

    it.each(Object.entries(ACTION_CALLS))("%s rejects and performs no write", async (_name, call) => {
      expect(await call()).toEqual(SESSION_EXPIRED);
      expect(getReorderTargetMock).not.toHaveBeenCalled();
      expect(target.reorder.execute).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  it("positive control: a valid session reaches the use case", async () => {
    cookieJar(await signInAs("EDITOR"));

    await expect(actions.reorderContent("faq", "faq-1", 3)).resolves.toEqual({ success: true });

    expect(target.reorder.execute).toHaveBeenCalledWith({ id: "faq-1", position: 3 });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/reorder/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });

  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: "src/interface/admin/reorder/actions.ts",
      actionCalls: ACTION_CALLS,
      cookiesMock,
      untouchedMocks: [getReorderTargetMock, revalidatePathMock, requestSiteRebuildMock],
    });
  });
});
