import { describe, expect, it, vi } from "vitest";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import { NotFoundError } from "@/application";
import { orNotFound } from "@/interface/forum/forum-page-errors";

describe("orNotFound", () => {
  it("passes the value through", async () => {
    await expect(orNotFound(Promise.resolve(42))).resolves.toBe(42);
  });

  it("turns a missing record into a 404", async () => {
    await expect(orNotFound(Promise.reject(new NotFoundError("gone")))).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("lets every other failure through to the error boundary", async () => {
    await expect(orNotFound(Promise.reject(new Error("db down")))).rejects.toThrow("db down");
  });
});
