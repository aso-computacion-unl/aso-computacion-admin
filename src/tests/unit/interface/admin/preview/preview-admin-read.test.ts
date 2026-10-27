import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock, eventsMock, newsMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  eventsMock: vi.fn(),
  newsMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvents: eventsMock }));
vi.mock("@/interface/admin/news/news-admin-read", () => ({ getAdminNewsItems: newsMock }));

import * as actions from "@/interface/admin/preview/actions";
import { getPreviewCodes, getPreviewPending } from "@/interface/admin/preview/preview-admin-read";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const form = (lifetime: string) => {
  const data = new FormData();
  data.set("lifetime", lifetime);
  return data;
};

/** Generates a code as `who` and returns the bearer secret the page must never learn. */
async function generateAs(who: "ADMIN" | "EDITOR" | "break_glass", lifetime = "24h") {
  cookieJar(cookiesMock, await signInAs(who));

  return ((await actions.createPreviewToken(null, form(lifetime))) as actions.PreviewTokenResult).token!;
}

describe("the preview page reads", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    vi.stubEnv("PREVIEW_TOKEN_SECRET", "p".repeat(40));
    redirectMock.mockClear();
    eventsMock.mockResolvedValue([]);
    newsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([getPreviewCodes, getPreviewPending])("send a visitor without a session to the login (%o)", async (read) => {
    cookieJar(cookiesMock, undefined);

    await expect(read()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("gives an Admin every generation, with who made it and when it expires", async () => {
    await generateAs("EDITOR", "1h");
    await generateAs("break_glass", "7d");
    await generateAs("ADMIN", "24h");

    const { scope, codes } = await getPreviewCodes();

    expect(scope).toBe("all");
    expect(codes.map((code) => code.by)).toEqual(["Test ADMIN", "Acceso de emergencia", "Test EDITOR"]);
    expect(codes.map((code) => (code.expiresAt!.getTime() - code.createdAt.getTime()) / 3_600_000)).toEqual([24, 168, 1]);
  });

  it("gives an Editor only their own codes and never another user's row", async () => {
    await generateAs("ADMIN");
    await generateAs("EDITOR");
    await testAuth.services.audit.record({ actorUserId: "other-editor", actorKind: "user", action: "preview.token_create", entityType: "preview", entityId: "1h", summary: "Código de vista previa generado (1 hora)" });
    await generateAs("EDITOR", "1h");

    const { scope, codes } = await getPreviewCodes();

    expect(scope).toBe("own");
    expect(codes).toHaveLength(2);
    expect(codes.every((code) => code.by === "Test EDITOR")).toBe(true);
    expect(JSON.stringify(codes)).not.toMatch(/Test ADMIN|other-editor/);
  });

  it("does not read the user list for an Editor", async () => {
    await generateAs("EDITOR");
    const listUsers = vi.spyOn(testAuth.services.listUsers, "execute");

    await getPreviewCodes();

    expect(listUsers).not.toHaveBeenCalled();
  });

  it("never carries a token value, for an Admin or an Editor", async () => {
    const tokens = [await generateAs("EDITOR"), await generateAs("ADMIN"), await generateAs("break_glass")];

    for (const who of ["ADMIN", "EDITOR"] as const) {
      cookieJar(cookiesMock, await signInAs(who));
      const serialized = JSON.stringify(await getPreviewCodes());

      for (const token of tokens) expect(serialized).not.toContain(token);
      expect(serialized).not.toMatch(/eyJ|token/i);
    }
  });

  it("estimates the expiry of an older entry, written before the lifetime was recorded, from its summary", async () => {
    await testAuth.services.audit.record({ actorUserId: "test-editor", actorKind: "user", action: "preview.token_create", entityType: "preview", summary: "Código de vista previa generado (7 días)" });
    await testAuth.services.audit.record({ actorUserId: "test-editor", actorKind: "user", action: "preview.token_create", entityType: "preview", summary: "Código de vista previa generado" });
    await signInAs("EDITOR");
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    const { codes } = await getPreviewCodes();

    expect(codes.map((code) => code.expiresAt === null)).toEqual([true, false]);
  });

  it("lists the drafts and the scheduled items a code reveals, each with its edit page", async () => {
    const later = new Date(Date.now() + 86_400_000);
    eventsMock.mockResolvedValue([{ id: "e1", title: "Taller", date: "2027-01-10", datePrecision: "day", isPublished: false, publishAt: later, registrationMode: "none", updatedAt: new Date() }]);
    newsMock.mockResolvedValue([{ id: "n1", title: "Novedad", isPublished: false, publishAt: null, updatedAt: new Date(Date.now() - 1000) }, { id: "n2", title: "Ya publicada", isPublished: true, publishAt: null, updatedAt: new Date() }]);
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    const { drafts, draftsTotal } = await getPreviewPending();

    expect(draftsTotal).toBe(2);
    expect(drafts.map(({ title, href, scheduled }) => ({ title, href, scheduled }))).toEqual([
      { title: "Taller", href: "/admin/events/e1/edit", scheduled: true },
      { title: "Novedad", href: "/admin/news/n1/edit", scheduled: false },
    ]);
  });

  it("shows no drafts, instead of failing the page, when a list cannot be read", async () => {
    eventsMock.mockRejectedValue(new Error("db down"));
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    expect(await getPreviewPending()).toEqual({ drafts: [], draftsTotal: 0 });
  });
});

