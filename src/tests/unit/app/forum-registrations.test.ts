import { beforeEach, describe, expect, it, vi } from "vitest";

const { permanentRedirectMock, redirectMock } = vi.hoisted(() => ({
  permanentRedirectMock: vi.fn((destination: string) => {
    throw new Error(`PERMANENT_REDIRECT ${destination}`);
  }),
  redirectMock: vi.fn((destination: string) => {
    throw new Error(`REDIRECT ${destination}`);
  }),
}));

vi.mock("next/navigation", () => ({ permanentRedirect: permanentRedirectMock, redirect: redirectMock, notFound: vi.fn() }));

import ForumRegistrationsPage from "../../../../app/foro/eventos/page";

const open = (query: Record<string, string | string[] | undefined> = {}) => ForumRegistrationsPage({ searchParams: Promise.resolve(query) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("D8: /foro/eventos is no longer a forum page", () => {
  it("sends everyone, signed in or not, to /inscripciones with a permanent redirect (308), never a temporary one", async () => {
    await expect(open()).rejects.toThrow("PERMANENT_REDIRECT /inscripciones");
    expect(permanentRedirectMock).toHaveBeenCalledWith("/inscripciones");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("keeps the query string, repeated keys and encoding included", async () => {
    await expect(open({ utm_source: "landing", y: ["1", "2"], q: "a b&c" })).rejects.toThrow("PERMANENT_REDIRECT /inscripciones?utm_source=landing&y=1&y=2&q=a+b%26c");
  });

  it("leaves out a key without a value", async () => {
    await expect(open({ a: undefined })).rejects.toThrow("PERMANENT_REDIRECT /inscripciones");
  });
});
