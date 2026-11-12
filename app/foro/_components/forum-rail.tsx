import type { ThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";

import { CategoryRail } from "./category-rail";
import { ThreadFilterTabs } from "./thread-filter-tabs";

interface ForumRailProps {
  filter: ThreadFilter;
  counts: Record<ThreadFilter, number>;
  categories: { slug: string; name: string; description: string | null; threadCount: number }[];
  /** The slug the list is narrowed to; none means every category. */
  category: string | undefined;
}

/**
 * The forum's side rail on wide screens, as tall as the screen: the thread filters and the categories. Phones get
 * the same links on top of the page instead (each page lays them out). The forum is only the forum: the event
 * registrations are a section of their own (`/inscripciones`) and have no link here.
 */
export function ForumRail({ filter, counts, categories, category }: ForumRailProps) {
  return (
    <div className="hidden gap-8 self-start border-r border-border bg-muted px-3 py-8 lg:sticky lg:top-14 lg:grid lg:max-h-[calc(100dvh-3.5rem)] lg:min-h-[calc(100dvh-3.5rem)] lg:content-start lg:overflow-y-auto">
      <ThreadFilterTabs active={filter} hrefFor={(target) => feedHref({ category, filter: target })} counts={counts} orientation="vertical" />
      <CategoryRail categories={categories} active={category} filter={filter} />
    </div>
  );
}
