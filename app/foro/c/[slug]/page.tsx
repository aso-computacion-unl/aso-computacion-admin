import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { parsePageParam, parseThreadFilter, threadStatus } from "@/interface/forum/forum-display";
import { categoryHref } from "@/interface/forum/forum-links";
import { orNotFound } from "@/interface/forum/forum-page-errors";
import { getForumThreads } from "@/interface/forum/forum-read";

import { Pagination } from "../../_components/pagination";
import { ThreadFilterTabs } from "../../_components/thread-filter-tabs";
import { ThreadListEmpty } from "../../_components/thread-list-empty";
import { ThreadRow } from "../../_components/thread-row";

// The title and the page share one read per request.
const loadThreads = cache((slug: string, page: number) => orNotFound(getForumThreads(slug, page, categoryHref(slug, { page }))));

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ estado?: string | string[]; pagina?: string | string[] }>;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const [{ slug }, { pagina }] = await Promise.all([params, searchParams]);
  const { category } = await loadThreads(slug, parsePageParam(pagina));

  return { title: category.name };
}

// Reads the session cookie: never prerendered.
export const dynamic = "force-dynamic";

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, { estado, pagina }] = await Promise.all([params, searchParams]);
  const filter = parseThreadFilter(estado);
  const { category, items, page, pageCount, total } = await loadThreads(slug, parsePageParam(pagina));
  const now = new Date();
  const solved = items.filter((item) => threadStatus(item) === "solved");
  const shown = filter === "solved" ? solved : items.filter((item) => threadStatus(item) !== "solved");
  // On a multi-page category the counts of one page would read as the whole category's.
  const counts = pageCount === 1 ? { open: items.length - solved.length, solved: solved.length } : undefined;

  return (
    <>
      <Link href="/foro" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mist hover:text-foreground">
        <Icon name="left" className="size-4" />
        Todos los hilos
      </Link>
      <div className="mt-1 mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight wrap-anywhere">{category.name}</h1>
          {category.description ? <p className="mt-1 text-mist wrap-anywhere">{category.description}</p> : null}
        </div>
        <Button asChild>
          <Link href={`/foro/c/${category.slug}/nuevo`}>
            <Icon name="plus" />
            Nuevo hilo
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        <div className="border-b border-border px-2 py-1.5">
          <ThreadFilterTabs active={filter} hrefFor={(target) => categoryHref(category.slug, { filter: target })} counts={counts} />
        </div>
        {total === 0 ? (
          <ThreadListEmpty title="Todavía no hay hilos en esta categoría.">Sea la primera persona en abrir uno.</ThreadListEmpty>
        ) : shown.length === 0 ? (
          <ThreadListEmpty title={`${filter === "solved" ? "No hay hilos resueltos" : "No hay hilos abiertos"}${pageCount > 1 ? " en esta página" : ""}.`}>
            {filter === "solved" ? "Un hilo queda resuelto cuando se marca su mejor respuesta." : "Todos los hilos de esta categoría ya están resueltos."}
          </ThreadListEmpty>
        ) : (
          <ul className="divide-y divide-border/50">
            {shown.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} now={now} />
            ))}
          </ul>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} hrefFor={(target) => categoryHref(category.slug, { filter, page: target })} />
    </>
  );
}
