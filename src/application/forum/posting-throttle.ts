import type { ForumPostRepository } from "../ports/forum.ports";

/**
 * How much a member may post (threads and replies together): at most `max` posts in the last
 * `windowSeconds`. Counted from the posts themselves in the database, so it holds across serverless
 * instances; two requests racing can slip a post or two past a limit, which is acceptable for a brake.
 */
export const POSTING_LIMITS = [
  { windowSeconds: 60, max: 3 },
  { windowSeconds: 3600, max: 30 },
] as const;

/** The member posted too much recently. `retryAfterSeconds` is the window that tripped, an upper bound. */
export class ForumThrottledError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Posting too fast");
    this.name = "ForumThrottledError";
  }
}

export class PostingThrottle {
  constructor(
    private readonly posts: ForumPostRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Throws `ForumThrottledError` when one more post would exceed a limit. */
  async assertAllowed(memberId: string): Promise<void> {
    const at = this.now().getTime();

    for (const { windowSeconds, max } of POSTING_LIMITS) {
      if ((await this.posts.countPostsSince(memberId, new Date(at - windowSeconds * 1000))) >= max) {
        throw new ForumThrottledError(windowSeconds);
      }
    }
  }
}
