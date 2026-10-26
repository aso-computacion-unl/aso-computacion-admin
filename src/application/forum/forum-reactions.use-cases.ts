import type { ForumThreadReactionsResult } from "../dto/forum-reaction-result.dto";
import type { ForumPostTarget } from "../ports/forum-moderation.ports";
import type { ForumReactionRepository } from "../ports/forum-reactions.ports";
import type { ForumMemberRepository, ForumPostRepository } from "../ports/forum.ports";
import { NotFoundError } from "../use-cases/use-case-error";
import { activeMember, assertVisible } from "./forum-guards";

type Clock = () => Date;

export class ToggleForumReactionUseCase {
  constructor(
    private readonly members: ForumMemberRepository,
    private readonly posts: ForumPostRepository,
    private readonly reactions: ForumReactionRepository,
    private readonly now: Clock = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  /** A locked thread still takes reactions: they are feedback on what is there, not new posts. */
  async execute(input: { memberId: string; target: ForumPostTarget }): Promise<{ reacted: boolean; count: number }> {
    const member = await activeMember(this.members, input.memberId);

    await assertVisible(this.posts, input.target);

    return this.reactions.toggle(member.id, input.target, { id: this.newId(), at: this.now() });
  }
}

export class GetForumReactionsUseCase {
  constructor(
    private readonly posts: ForumPostRepository,
    private readonly reactions: ForumReactionRepository,
  ) {}

  async execute(input: { threadId: string; viewerId: string }): Promise<ForumThreadReactionsResult> {
    const row = await this.posts.findThread(input.threadId);

    if (!row || row.thread.hiddenAt) {
      throw new NotFoundError("Forum thread not found");
    }

    return this.reactions.summarize(input.threadId, input.viewerId);
  }
}
