import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AUTH_COOKIE_NAME, signSession } from "@/infrastructure/auth/session-jwt";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

export interface AdminActionAuthSuite {
  title: string;
  /** Repository-relative path of the actions module, read by the guard-first check. */
  actionsPath: string;
  actions: Record<string, unknown>;
  /** One entry per exported action: the suite fails when an action is added without a case here. */
  actionCalls: Record<string, () => Promise<unknown>>;
  cookiesMock: Mock;
  /** Mocks that must stay untouched when the session is rejected (container, use cases, cache, navigation). */
  untouchedMocks: Mock[];
  /** Runs one action with a valid session and asserts it reached its use case. */
  positiveControl: () => Promise<void>;
}

function cookieJar(cookiesMock: Mock, value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

export function describeAdminActionAuth(suite: AdminActionAuthSuite): void {
  const actionNames = Object.keys(suite.actionCalls).sort();

  describe(suite.title, () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    });

    it("has an auth case for every exported action", () => {
      expect(actionNames).toEqual(Object.keys(suite.actions).sort());
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

    it("positive control: a valid session reaches the use cases", async () => {
      cookieJar(suite.cookiesMock, await signSession());
      await suite.positiveControl();
    });

    it("the guard is the first statement of every action", () => {
      expect(expectGuardFirstInEveryAction(suite.actionsPath).sort()).toEqual(actionNames);
    });
  });
}
