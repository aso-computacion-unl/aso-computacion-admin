import { beforeEach, vi } from "vitest";

// `server-only` guards the Next bundle, not unit tests; the invite token module test-auth.ts builds on carries it.
vi.mock("server-only", () => ({}));

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

// And for event registration: the real use cases over in-memory repositories (see test-event-registration.ts).
vi.mock("@/interface/public/event-registration-container", async () => {
  const { testEventRegistration } = await import("./test-event-registration");

  return { getEventRegistrationServices: () => testEventRegistration.services };
});

beforeEach(async () => {
  (await import("./test-auth")).resetTestAuth();
  (await import("./test-forum")).resetTestForum();
  (await import("./test-event-registration")).resetTestEventRegistration();
});
