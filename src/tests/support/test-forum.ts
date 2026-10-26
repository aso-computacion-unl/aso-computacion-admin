import { buildForumServices } from "@/application";
import {
  InMemoryForumCategoryRepository,
  InMemoryForumMemberRepository,
  InMemoryForumModerationRepository,
  InMemoryForumPostRepository,
  InMemoryForumReactionRepository,
  InMemoryForumSessionRepository,
  InMemoryForumStore,
  makeForumMember,
} from "@/tests/fakes/in-memory-forum";

export const FORUM_TEST_DOMAIN = "unl.edu.ec";

const members = new InMemoryForumMemberRepository();
const store = new InMemoryForumStore(members);
const sessions = new InMemoryForumSessionRepository(members);
const categories = new InMemoryForumCategoryRepository(store);
const posts = new InMemoryForumPostRepository(store);
const moderation = new InMemoryForumModerationRepository(store, sessions);
const reactions = new InMemoryForumReactionRepository(store);

/**
 * The forum services every unit test sees instead of the Prisma-backed container (installed for all
 * tests by `auth-doubles.setup.ts`): the real use cases over in-memory repositories.
 */
export const testForum = {
  members,
  store,
  sessions,
  categories,
  posts,
  moderation,
  reactions,
  services: buildForumServices({ members, sessions, categories, posts, moderation, reactions }, { allowedDomain: FORUM_TEST_DOMAIN }),
};

export function resetTestForum(): void {
  members.members.clear();
  sessions.sessions.clear();
  sessions.touched = [];
  store.categories.clear();
  store.threads.clear();
  store.replies.clear();
  store.reports.clear();
  store.reactions.clear();
}

/**
 * Registers a member (active unless overridden), opens a real forum session for them and returns the
 * signed cookie value. Needs FORUM_SESSION_SECRET (and ADMIN_SECRET, different) stubbed, and `server-only` mocked.
 */
export async function signInToForumAs(overrides: Parameters<typeof makeForumMember>[0] = {}): Promise<{ cookie: string; memberId: string; sessionId: string }> {
  const member = makeForumMember(overrides);

  members.members.set(member.id, member);

  const { sessionId } = await testForum.services.openSession.execute({ memberId: member.id });
  // Loaded here, not at the top: the token module is `server-only`, and this file is loaded by every test.
  const { signForumSession } = await import("@/infrastructure/forum/forum-session-jwt");

  return { cookie: await signForumSession({ sid: sessionId, memberId: member.id }), memberId: member.id, sessionId };
}
