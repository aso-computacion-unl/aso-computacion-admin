import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, requestSiteRebuildMock, executeMock, order, containers } = vi.hoisted(() => {
  const order: string[] = [];
  const executeMock = vi.fn(async () => {
    order.push("write");
    return { id: "item-1", wasPublished: true };
  });
  // Every use case of every module is the same recording stub: this suite is about when the hook fires, not what the use cases do.
  const useCases = new Proxy({}, { get: () => ({ execute: executeMock }) });

  return {
    cookiesMock: vi.fn(),
    executeMock,
    order,
    requestSiteRebuildMock: vi.fn(() => {
      order.push("hook");
    }),
    containers: () => useCases,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));
vi.mock("@/interface/admin/sponsors/sponsors-container", () => ({ getSponsorUseCases: containers }));

import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";
import * as sponsors from "@/interface/admin/sponsors/actions";
import { signInAs } from "@/tests/support/test-auth";

const form = (fields: Record<string, string> = {}, file = false) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  if (file) data.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }));
  return data;
};

// Every exported action of the sponsors module: each one is a mutation of what the landing shows.
const CALLS: Array<[string, () => Promise<unknown>]> = [
  ["sponsors/createSponsor", () => sponsors.createSponsor(null, form({ name: "Acme", url: "" }))],
  ["sponsors/updateSponsor", () => sponsors.updateSponsor("s", null, form({ name: "Acme", url: "" }))],
  ["sponsors/setSponsorPublished", () => sponsors.setSponsorPublished("s", true)],
  ["sponsors/trashSponsor", () => sponsors.trashSponsor("s")],
  ["sponsors/moveSponsor", () => sponsors.moveSponsor("s", "up")],
  ["sponsors/uploadSponsorLogo", () => sponsors.uploadSponsorLogo("s", null, form({ logoAlt: "Acme" }, true))],
  ["sponsors/removeSponsorLogo", () => sponsors.removeSponsorLogo("s")],
];

function session(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

// A redirecting action (create) throws after the write; that is its success path.
const run = (call: () => Promise<unknown>) => call().catch((error: Error) => (error.message === "REDIRECT" ? { success: true } : Promise.reject(error)));

beforeEach(async () => {
  vi.clearAllMocks();
  order.length = 0;
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  session(await signInAs("EDITOR"));
});

describe("deploy hook after social proof mutations", () => {
  it("covers every exported action of the module", () => {
    const exported = Object.keys(sponsors);

    expect(CALLS.map(([name]) => name.split("/")[1]).sort()).toEqual(exported.sort());
  });

  it.each(CALLS)("%s asks for a rebuild exactly once, after the write", async (_name, call) => {
    await run(call);

    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
    expect(order.indexOf("hook")).toBeGreaterThan(order.indexOf("write"));
  });

  it.each(CALLS)("%s does NOT ask for a rebuild when the write fails", async (_name, call) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeMock.mockRejectedValueOnce(new Error("db down"));

    expect(await call()).toMatchObject({ error: expect.any(String) });
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it.each(CALLS)("%s does NOT ask for a rebuild without a session", async (_name, call) => {
    session(undefined);

    await call();

    expect(executeMock).not.toHaveBeenCalled();
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it.each(CALLS.filter(([name]) => /\/trash[A-Z]/.test(name)))("%s of a draft does NOT ask for a rebuild: the public content did not change", async (_name, call) => {
    executeMock.mockResolvedValueOnce({ id: "item-1", wasPublished: false });

    expect(await call()).toEqual({ success: true });

    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });
});
