import type { Metadata } from "next";

import { parseForumLoginError } from "@/interface/forum/forum-login-errors";
import { parsePageParam, parseThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";
import { orNotFound } from "@/interface/forum/forum-page-errors";
import { parseForumReturnPath } from "@/interface/forum/forum-return-path";
import { getForumFeed } from "@/interface/forum/forum-read";
import { getForumMember } from "@/interface/forum/require-forum-member";

import { CategoryFilter } from "./_components/category-filter";
import { NewThreadMenu } from "./_components/new-thread-menu";
import { Pagination } from "./_components/pagination";
import { SignInGate } from "./_components/sign-in-gate";
import { ThreadFilterTabs } from "./_components/thread-filter-tabs";
import { ThreadListEmpty } from "./_components/thread-list-empty";
import { ThreadRow } from "./_components/thread-row";

export const metadata: Metadata = { title: "Hilos" };

// Reads the session cookie: never prerendered.
export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;

interface ForumHomePageProps {
  searchParams: Promise<{ error?: Param; next?: Param; estado?: Param; categoria?: Param; pagina?: Param }>;
}

export default async function ForumHomePage({ searchParams }: ForumHomePageProps) {
  const [member, { error, next, estado, categoria, pagina }] = await Promise.all([getForumMember(), searchParams]);

  // Not `getForumFeed` first: it sends a visitor to /foro, which is this page.
  if (!member) {
    return <SignInGate problem={parseForumLoginError(error)} next={parseForumReturnPath(typeof next === "string" ? next : null) ?? undefined} />;
  }

  const filter = parseThreadFilter(estado);
  const categorySlug = typeof categoria === "string" && categoria !== "" ? categoria : undefined;
  const feed = await orNotFound(getForumFeed({ categorySlug, state: filter, page: parsePageParam(pagina) }));
  const { categories, category, items, counts, page, pageCount } = feed;
  const now = new Date();

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight">Hilos</h1>
        {categories.length > 0 ? <NewThreadMenu categories={categories} currentSlug={category?.slug} /> : null}
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted">
          <ThreadListEmpty title="Todavía no hay categorías.">La directiva las irá creando. Vuelva pronto.</ThreadListEmpty>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-muted">
            <div className="border-b border-border px-2 py-1.5">
              <ThreadFilterTabs active={filter} hrefFor={(target) => feedHref({ category: category?.slug, filter: target })} counts={counts} />
            </div>
            {categories.length > 1 ? (
              <div className="border-b border-border px-3 py-2.5 sm:px-4">
                <CategoryFilter categories={categories} active={category?.slug} filter={filter} />
              </div>
            ) : null}
            {category?.description ? (
              <p data-slot="category-description" className="border-b border-border px-3 py-2.5 text-sm text-mist wrap-anywhere sm:px-4">
                {category.description}
              </p>
            ) : null}
            {items.length === 0 ? (
              <ThreadListEmpty title={emptyTitle(filter, counts.open + counts.solved, category?.name)} action={<NewThreadMenu categories={categories} currentSlug={category?.slug} variant="line" align="center" />}>
                {emptyHint(filter, counts.open + counts.solved)}
              </ThreadListEmpty>
            ) : (
              <ul className="divide-y divide-border/50">
                {items.map((thread) => (
                  <ThreadRow key={thread.id} thread={thread} now={now} category={category ? null : thread.category} />
                ))}
              </ul>
            )}
          </div>
          <Pagination page={page} pageCount={pageCount} hrefFor={(target) => feedHref({ category: category?.slug, filter, page: target })} />
        </>
      )}
    </>
  );
}

function emptyTitle(filter: "open" | "solved", threadsInScope: number, categoryName: string | undefined): string {
  const where = categoryName ? ` en ${categoryName}` : "";

  if (threadsInScope === 0) return `Todavía no hay hilos${where}.`;

  return `${filter === "solved" ? "No hay hilos resueltos" : "No hay hilos abiertos"}${where}.`;
}

function emptyHint(filter: "open" | "solved", threadsInScope: number): string {
  if (threadsInScope === 0) return "Sea la primera persona en abrir uno.";

  return filter === "solved" ? "Un hilo queda resuelto cuando se marca su mejor respuesta." : "Todos los hilos ya están resueltos.";
}
