import type { ThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";

import { CategoryRail } from "./category-rail";
import { RegistrationsLink } from "./registrations-link";
import { ThreadFilterTabs } from "./thread-filter-tabs";

interface ForumRailProps {
  /** Which part of the forum the page is: the thread list or the registrations. The rail marks it. */
  section: "threads" | "registrations";
  /** The tab of the list; none on the registrations page. */
  filter: ThreadFilter | null;
  counts: Record<ThreadFilter, number>;
  categories: { slug: string; name: string; description: string | null; threadCount: number }[];
  /** The slug the list is narrowed to; none means every category. `null` when no category applies (registrations). */
  category: string | null | undefined;
  /** Events open for registration. */
  registrationsCount: number;
}

/**
 * The forum's side rail on wide screens, as tall as the screen: the thread filters, the categories and, apart from
 * them, the registrations. Phones get the same links on top of the page instead (each page lays them out).
 */
export function ForumRail({ section, filter, counts, categories, category, registrationsCount }: ForumRailProps) {
  return (
    <div className="hidden gap-8 self-start border-r border-border bg-muted px-3 py-8 lg:sticky lg:top-14 lg:grid lg:max-h-[calc(100dvh-3.5rem)] lg:min-h-[calc(100dvh-3.5rem)] lg:content-start lg:overflow-y-auto">
      <ThreadFilterTabs
        active={filter}
        hrefFor={(target) => feedHref({ category: category ?? undefined, filter: target })}
        counts={counts}
        orientation="vertical"
      />
      <CategoryRail categories={categories} active={category} filter={filter ?? "open"} />
      <div>
        <h2 className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-mist uppercase">Eventos</h2>
        <RegistrationsLink count={registrationsCount} current={section === "registrations"} />
      </div>
    </div>
  );
}
