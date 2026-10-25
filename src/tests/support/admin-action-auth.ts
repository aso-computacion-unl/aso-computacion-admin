import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

export interface AdminActionAuthSuite {
  /** Repository-relative path of the actions module, read by the guard-first check. */
  actionsPath: string;
  actions: Record<string, unknown>;
  /** One entry per exported action: the suite fails when an action is added without a case here. */
  actionCalls: Record<string, () => Promise<unknown>>;
  cookiesMock: Mock;
  /** Mocks that must stay untouched when the session is rejected (container, use cases, cache, navigation). */
  untouchedMocks: Mock[];
}

const byName = (a: string, b: string) => a.localeCompare(b);

export function cookieJar(cookiesMock: Mock, value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

/**
 * Registers the shared session-guard cases inside the caller's describe block.
 * The caller adds its own positive control: a valid session reaching one use case.
 */
export function registerAdminActionAuthCases(suite: AdminActionAuthSuite): void {
  const actionNames = Object.keys(suite.actionCalls).sort(byName);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  });

  it("has an auth case for every exported action", () => {
    expect(actionNames).toEqual(Object.keys(suite.actions).sort(byName));
  });

  describe.each([
    ["no cookie", undefined],
    ["a forged token", "forged.token.value"],
  ])("with %s", (_label, cookie) => {
    beforeEach(() => cookieJar(suite.cookiesMock, cookie));

    it.each(Object.entries(suite.actionCalls))("%s rejects and performs no write", async (_name, call) => {
      expect(await call()).toEqual(SESSION_EXPIRED);
      for (const mock of suite.untouchedMocks) {
        expect(mock).not.toHaveBeenCalled();
      }
    });
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction(suite.actionsPath).sort(byName)).toEqual(actionNames);
  });
}
