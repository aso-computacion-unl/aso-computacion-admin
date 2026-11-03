import Link from "next/link";

import type { ThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";
import { cn } from "@/lib/utils";

interface CategoryRailProps {
  categories: { slug: string; name: string; description: string | null; threadCount: number }[];
  /** The slug the list is narrowed to; none means every category, `null` that no category applies (the registrations page). */
  active: string | null | undefined;
  /** The tab stays when the category changes. */
  filter: ThreadFilter;
}

const itemClass = "grid gap-0.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/70";
const currentClass = "bg-muted shadow-[inset_3px_0_0_var(--color-signal)]";

/** The categories on the side of the list on wide screens, each with what it is for and how many threads it has. */
export function CategoryRail({ categories, active, filter }: CategoryRailProps) {
  const total = categories.reduce((sum, category) => sum + category.threadCount, 0);

  return (
    <div>
      <h2 className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-mist uppercase">Categorías</h2>
      <nav aria-label="Categoría">
        <ul className="grid gap-0.5">
          <li>
            <Link href={feedHref({ filter })} aria-current={active === undefined ? "page" : undefined} className={cn(itemClass, active === undefined && currentClass)}>
              <RailLabel name="Todas" count={total} />
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={feedHref({ category: category.slug, filter })}
                aria-current={active === category.slug ? "page" : undefined}
                className={cn(itemClass, active === category.slug && currentClass)}
              >
                <RailLabel name={category.name} count={category.threadCount} />
                {category.description ? <span className="line-clamp-2 text-xs leading-snug text-mist wrap-anywhere">{category.description}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function RailLabel({ name, count }: { name: string; count: number }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="font-semibold wrap-anywhere text-foreground">{name}</span>
      <span className="font-mono text-xs text-mist">
        {count}
        <span className="sr-only"> hilos</span>
      </span>
    </span>
  );
}
