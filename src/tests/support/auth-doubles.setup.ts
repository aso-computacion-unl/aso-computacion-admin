import { beforeEach, vi } from "vitest";

// Every unit test gets the in-memory auth services (see test-auth.ts) instead of the Prisma ones.
// A test that wants its own container mocks the module itself.
vi.mock("@/interface/auth/auth-container", async () => {
  const { testAuth } = await import("./test-auth");

  return { getAuthServices: () => testAuth.services };
});

beforeEach(async () => {
  (await import("./test-auth")).resetTestAuth();
});
