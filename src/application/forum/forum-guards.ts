import { assertCanPost, type ForumMember } from "@/domain/forum";

import type { ForumPostTarget } from "../ports/forum-moderation.ports";
import type { ForumMemberRepository, ForumPostRepository } from "../ports/forum.ports";
import { ForbiddenError, NotFoundError } from "../use-cases/use-case-error";

/** The member behind an action, who must still be allowed to take part: the session was valid, but the account may have changed since. */
export async function activeMember(members: ForumMemberRepository, memberId: string): Promise<ForumMember> {
  const member = await members.findById(memberId);

  if (!member) {
    throw new ForbiddenError();
  }

  assertCanPost(member);

  return member;
}

/** A post a student can see: not hidden itself and not in a hidden thread. Anything else is as good as gone. */
export async function assertVisible(posts: ForumPostRepository, target: ForumPostTarget): Promise<void> {
  const reply = target.kind === "reply" ? await posts.findReply(target.id) : null;
  const thread = await posts.findThread(target.kind === "thread" ? target.id : (reply?.threadId ?? ""));

  if (!thread || thread.thread.hiddenAt || (target.kind === "reply" && (!reply || reply.hiddenAt))) {
    throw new NotFoundError("Forum post not found");
  }
}
