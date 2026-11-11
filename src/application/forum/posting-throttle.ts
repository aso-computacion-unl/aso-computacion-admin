import type { ForumPostRepository } from "../ports/forum.ports";

/**
 * How much a member may post (threads and replies together): at most `max` posts in the last
 * `windowSeconds`. Counted from the posts themselves in the database, so it holds across serverless
 * instances; two requests racing can slip a post or two past a limit, which is acceptable for a brake.
 */
export const POSTING_LIMITS = [
  { windowSeconds: 60, max: 3, per: "minuto" },
  { windowSeconds: 3600, max: 30, per: "hora" },
] as const;

/** The member posted too much recently. `retryAfterSeconds` is the time really left before the post that tripped the limit leaves its window; `max` and `per` name that limit ("3 por minuto"). */
export class ForumThrottledError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    public readonly max: number,
    public readonly per: "minuto" | "hora",
  ) {
    super("Posting too fast");
    this.name = "ForumThrottledError";
  }
}

export class PostingThrottle {
  constructor(
    private readonly posts: ForumPostRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Throws `ForumThrottledError` when one more post would exceed a limit. Every limit is checked and the error
   * is the one with the longest wait (the member can post again only when all are free): that wait runs until
   * the oldest post inside the window leaves it, not for the whole window.
   */
  async assertAllowed(memberId: string): Promise<void> {
    const at = this.now().getTime();
    let longest: ForumThrottledError | undefined;

    for (const { windowSeconds, max, per } of POSTING_LIMITS) {
      const since = new Date(at - windowSeconds * 1000);

      if ((await this.posts.countPostsSince(memberId, since)) < max) continue;

      const oldest = await this.posts.oldestPostSince(memberId, since);
      // No post left in the window: it emptied between the two reads, so this limit no longer holds.
      if (oldest === null) continue;

      const retryAfterSeconds = Math.max(1, Math.ceil((oldest.getTime() + windowSeconds * 1000 - at) / 1000));

      if (!longest || retryAfterSeconds > longest.retryAfterSeconds) longest = new ForumThrottledError(retryAfterSeconds, max, per);
    }

    if (longest) throw longest;
  }
}
