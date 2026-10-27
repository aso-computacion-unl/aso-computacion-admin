import type { ForumThreadListItemResult } from "../dto/forum-result.dto";
import type { ForumCategoryRepository, ForumPostRepository, ForumThreadState } from "../ports/forum.ports";
import { NotFoundError } from "../use-cases/use-case-error";
import { FORUM_THREADS_PAGE_SIZE } from "./forum-threads.use-cases";

export interface ForumFeedCategory {
  slug: string;
  name: string;
}

/** A row of the cross-category list: the thread as the category list shows it, plus the category it belongs to. */
export interface ForumFeedItemResult extends ForumThreadListItemResult {
  /** Null only if the category vanished between the two reads. */
  category: ForumFeedCategory | null;
}

export interface ForumFeedPage {
  /** Every category in display order: the filter chips. */
  categories: ForumFeedCategory[];
  /** The category the list is narrowed to, if any. */
  category: ForumFeedCategory | null;
  state: ForumThreadState;
  items: ForumFeedItemResult[];
  /** Visible threads of the same scope per tab, so both tab counts stay true on any page. */
  counts: Record<ForumThreadState, number>;
  total: number;
  page: number;
  pageCount: number;
}

/** The forum home: the threads of every category (or of one) as an open / solved list, hidden threads never included. */
export class ListForumFeedUseCase {
  constructor(
    private readonly categories: ForumCategoryRepository,
    private readonly posts: ForumPostRepository,
  ) {}

  async execute(input: { categorySlug?: string; state: ForumThreadState; page: number; viewerId: string }): Promise<ForumFeedPage> {
    const all = (await this.categories.list()).map(({ category }) => category);
    const selected = input.categorySlug === undefined ? null : (all.find((category) => category.slug === input.categorySlug) ?? null);

    if (input.categorySlug !== undefined && !selected) {
      throw new NotFoundError("Forum category not found");
    }

    const scope = { categoryId: selected?.id, state: input.state };
    const requested = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
    const first = await this.posts.listFeed(scope, { offset: (requested - 1) * FORUM_THREADS_PAGE_SIZE, limit: FORUM_THREADS_PAGE_SIZE });
    const total = first.counts[input.state];
    const pageCount = Math.max(1, Math.ceil(total / FORUM_THREADS_PAGE_SIZE));
    const page = Math.min(requested, pageCount);
    // A page past the end (a stale link, an edited URL) shows the last page, not an empty one.
    const { items, counts } = page === requested ? first : await this.posts.listFeed(scope, { offset: (page - 1) * FORUM_THREADS_PAGE_SIZE, limit: FORUM_THREADS_PAGE_SIZE });
    const byId = new Map(all.map((category) => [category.id, { slug: category.slug, name: category.name }]));

    return {
      categories: all.map(({ slug, name }) => ({ slug, name })),
      category: selected && { slug: selected.slug, name: selected.name },
      state: input.state,
      items: items.map(({ thread, authorName, replyCount }) => ({
        id: thread.id,
        title: thread.title,
        authorName,
        createdAt: thread.createdAt,
        lastActivityAt: thread.lastActivityAt,
        replyCount,
        locked: thread.lockedAt !== null,
        hasBestAnswer: thread.bestReplyId !== null,
        mine: thread.authorId === input.viewerId,
        category: byId.get(thread.categoryId) ?? null,
      })),
      counts,
      total,
      page,
      pageCount,
    };
  }
}
