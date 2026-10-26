import { beforeEach, vi } from "vitest";

// Every unit test gets the in-memory auth services (see test-auth.ts) instead of the Prisma ones.
// A test that wants its own container mocks the module itself.
vi.mock("@/interface/auth/auth-container", async () => {
  const { testAuth } = await import("./test-auth");

  return { getAuthServices: () => testAuth.services };
});

// Same for the forum: the real use cases over in-memory repositories (see test-forum.ts).
vi.mock("@/interface/forum/forum-container", async () => {
  const { testForum } = await import("./test-forum");

  return { getForumServices: () => testForum.services };
});

beforeEach(async () => {
  (await import("./test-auth")).resetTestAuth();
  (await import("./test-forum")).resetTestForum();
});
