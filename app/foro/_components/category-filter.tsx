import Link from "next/link";

import { categoryHue, type ThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";

interface CategoryFilterProps {
  categories: { slug: string; name: string }[];
  /** The slug the list is narrowed to; none means every category. */
  active: string | undefined;
  /** The tab stays when the category changes. */
  filter: ThreadFilter;
}

/** "Todas" and one chip per category as links: the filter lives in the URL like the tabs do. */
export function CategoryFilter({ categories, active, filter }: CategoryFilterProps) {
  return (
    <nav aria-label="Categoría" className="flex flex-wrap gap-2">
      <Link href={feedHref({ filter })} aria-current={active === undefined ? "page" : undefined} className="chip" data-size="lg" data-current={active === undefined}>
        Todas
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={feedHref({ category: category.slug, filter })}
          aria-current={active === category.slug ? "page" : undefined}
          className="chip"
          data-size="lg"
          data-hue={categoryHue(category.slug)}
          data-current={active === category.slug}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
