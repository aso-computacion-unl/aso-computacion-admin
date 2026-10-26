import { describe, expect, it, vi } from "vitest";

const { cookiesMock, getTrashUseCasesMock, revalidatePathMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn(async () => undefined);
  // One stub per kind, created on first use and then reused, so the test can inspect the one that ran.
  const byKind = () => {
    const stubs = new Map<string | symbol, { execute: ReturnType<typeof vi.fn> }>();

    return new Proxy({}, { get: (_target, kind) => stubs.get(kind) ?? stubs.set(kind, { execute: execute() }).get(kind) });
  };
  const useCases = { restore: byKind() as Record<string, { execute: ReturnType<typeof vi.fn> }>, purge: byKind() as Record<string, { execute: ReturnType<typeof vi.fn> }> };

  return {
    cookiesMock: vi.fn(),
    getTrashUseCasesMock: vi.fn(() => useCases),
    revalidatePathMock: vi.fn(),
    useCases,
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/interface/admin/trash/trash-container", () => ({ getTrashUseCases: getTrashUseCasesMock }));

import { signInAs } from "@/tests/support/test-auth";
import * as actions from "@/interface/admin/trash/actions";
import { cookieJar, registerAdminActionAuthCases } from "@/tests/support/admin-action-auth";
import { registerPolicyCases } from "@/tests/support/action-policy";

const SUITE = {
    actionsPath: "src/interface/admin/trash/actions.ts",
    actions,
    actionCalls: {
      restoreTrashed: () => actions.restoreTrashed("faq", "faq-1"),
      purgeTrashed: () => actions.purgeTrashed("faq", "faq-1"),
    },
    cookiesMock,
    untouchedMocks: [getTrashUseCasesMock, revalidatePathMock],
};

describe("trash server actions require an admin session (L9)", () => {
  registerAdminActionAuthCases(SUITE);

  it("positive control: a valid session reaches the use cases", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    await expect(actions.restoreTrashed("faq", "faq-1")).resolves.toEqual({ success: true });
    await expect(actions.purgeTrashed("faq", "faq-1")).resolves.toEqual({ success: true });

    expect(useCases.restore.faq?.execute).toHaveBeenCalledWith({ id: "faq-1" });
    expect(useCases.purge.faq?.execute).toHaveBeenCalledWith({ id: "faq-1" });
  });

  describe("role matrix and audit", () => {
    registerPolicyCases(SUITE);
  });
});
