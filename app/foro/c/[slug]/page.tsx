import { notFound, redirect } from "next/navigation";

import { parsePageParam, parseThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";
import { getForumCategories } from "@/interface/forum/forum-read";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ estado?: string | string[]; pagina?: string | string[] }>;
}

// Reads the session cookie: never prerendered.
export const dynamic = "force-dynamic";

/** The category list lives in the forum home (`?categoria=`); this URL stays so old links keep working. */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, { estado, pagina }] = await Promise.all([params, searchParams]);
  const categories = await getForumCategories(`/foro/c/${slug}`);

  if (!categories.some((category) => category.slug === slug)) {
    notFound();
  }

  redirect(feedHref({ category: slug, filter: parseThreadFilter(estado), page: parsePageParam(pagina) }));
}
