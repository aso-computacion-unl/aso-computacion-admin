import type { UpdateNewsItemInput } from "@/domain/news-item";

import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { NewsRepository } from "../ports/news-repository.port";
import { withSlugIssue } from "./merge-slug-issue";
import { resolveNewsSlug } from "./resolve-news-slug";
import { NotFoundError } from "./use-case-error";
import type { Updated } from "./updated-result";

export type UpdateNewsItemCommand = UpdateNewsItemInput & { id: string };

/** Text, slug, date, publish flag and the alt of the current cover. Adding, replacing or removing the cover has its own use cases. */
export class UpdateNewsItemUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute({ id, ...updates }: UpdateNewsItemCommand): Promise<Updated<NewsItemResult>> {
    const item = await this.news.getById(id);

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    // The slug only changes when the caller asks for it; the title alone never rewrites a public URL.
    const slugChanges = updates.slug !== undefined && updates.slug !== item.props.slug;
    const updated = await withSlugIssue(
      async () => (slugChanges ? resolveNewsSlug(this.news, item.props.title, updates.slug, id) : undefined),
      undefined,
      () => item.update(updates),
    );

    return { ...toNewsItemResult(await this.news.update(updated)), wasPublished: item.props.isPublished };
  }
}
