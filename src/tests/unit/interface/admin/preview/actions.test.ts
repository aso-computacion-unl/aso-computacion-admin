import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { verifyPreviewToken } from "@/infrastructure/preview/preview-token";
import * as actions from "@/interface/admin/preview/actions";
import { registerPolicyCases } from "@/tests/support/action-policy";
import { cookieJar } from "@/tests/support/action-policy";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };
const form = (lifetime: string) => {
  const data = new FormData();
  data.set("lifetime", lifetime);
  return data;
};

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createPreviewToken: () => actions.createPreviewToken(null, form("24h")),
};

describe("preview token server action", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    vi.stubEnv("PREVIEW_TOKEN_SECRET", "p".repeat(40));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("has a case for every exported action and starts each with the session guard", () => {
    expect(Object.keys(ACTION_CALLS).sort()).toEqual(Object.keys(actions).sort());
    expect(expectGuardFirstInEveryAction("src/interface/admin/preview/actions.ts").sort()).toEqual(Object.keys(ACTION_CALLS).sort());
  });

  it.each([
    ["no cookie", undefined],
    ["a forged token", "forged.token.value"],
  ])("signs nothing with %s", async (_label, cookie) => {
    cookieJar(cookiesMock, cookie);

    expect(await actions.createPreviewToken(null, form("1h"))).toEqual(SESSION_EXPIRED);
    expect(testAuth.audit.entries).toEqual([]);
  });

  it("gives an Editor a token that the public preview accepts, with its expiry in Ecuador time and the endpoint to call", async () => {
    // Only here: a lone AUTH_URL is a half-configured Google login, which switches the emergency login off.
    vi.stubEnv("AUTH_URL", "https://admin.aso.test");
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    const result = (await actions.createPreviewToken(null, form("24h"))) as actions.PreviewTokenResult;

    expect(result).toMatchObject({ success: true, endpoint: "https://admin.aso.test/api/public/preview" });
    expect(await verifyPreviewToken(result.token!)).toBe(true);
    expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("rejects a lifetime that is not on the menu, without signing or recording anything", async () => {
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    for (const lifetime of ["30d", "", "forever"]) {
      expect(await actions.createPreviewToken(null, form(lifetime))).toEqual({ fieldErrors: { lifetime: "Elija una duración de la lista." } });
    }

    expect(testAuth.audit.entries).toEqual([]);
  });

  it("says so, instead of failing obscurely, when the server has no preview secret", async () => {
    vi.stubEnv("PREVIEW_TOKEN_SECRET", "");
    cookieJar(cookiesMock, await signInAs("ADMIN"));

    expect(await actions.createPreviewToken(null, form("1h"))).toEqual({
      error: "La vista previa no está configurada: falta PREVIEW_TOKEN_SECRET en el servidor.",
    });
    expect(testAuth.audit.entries).toEqual([]);
  });

  it("writes the audit entry without the token", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    const { token } = (await actions.createPreviewToken(null, form("7d"))) as actions.PreviewTokenResult;

    expect(testAuth.audit.entries).toHaveLength(1);
    expect(testAuth.audit.entries[0]).toMatchObject({ action: "preview.token_create", entityType: "preview", summary: "Código de vista previa generado (7 días)" });
    expect(JSON.stringify(testAuth.audit.entries)).not.toContain(token!);
  });

  describe("role matrix and audit", () => {
    registerPolicyCases({ actionsPath: "src/interface/admin/preview/actions.ts", actionCalls: ACTION_CALLS, cookiesMock, untouchedMocks: [] });
  });
});
