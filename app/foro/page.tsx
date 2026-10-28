import type { Metadata } from "next";

import { getOpenRegistrationEvents } from "@/interface/forum/event-registration-read";
import { parseForumLoginError } from "@/interface/forum/forum-login-errors";
import { parsePageParam, parseThreadFilter, type ThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";
import { orNotFound } from "@/interface/forum/forum-page-errors";
import { parseForumReturnPath } from "@/interface/forum/forum-return-path";
import { getForumCategories, getForumFeed } from "@/interface/forum/forum-read";
import { getForumMember } from "@/interface/forum/require-forum-member";

import { CategoryFilter } from "./_components/category-filter";
import { CategoryRail } from "./_components/category-rail";
import { ForumHowItWorks } from "./_components/forum-how-it-works";
import { NewThreadMenu } from "./_components/new-thread-menu";
import { OpenRegistrationsAside } from "./_components/open-registrations-aside";
import { Pagination } from "./_components/pagination";
import { SignInGate } from "./_components/sign-in-gate";
import { StartThreadRow } from "./_components/start-thread-row";
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
  // The feed carries only the names; the rail also shows what each category is for and how many threads it has.
  const [feed, openEvents, railCategories] = await Promise.all([
    orNotFound(getForumFeed({ categorySlug, state: filter, page: parsePageParam(pagina) })),
    getOpenRegistrationEvents(),
    orNotFound(getForumCategories()),
  ]);
  const { categories, category, items, counts, page, pageCount } = feed;
  const now = new Date();
  const hrefForFilter = (target: ThreadFilter) => feedHref({ category: category?.slug, filter: target });

  if (categories.length === 0) {
    return (
      <div data-wide>
        <h1 className="mb-5 text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight">Hilos</h1>
        <div className="rounded-xl border border-border bg-muted">
          <ThreadListEmpty title="Todavía no hay categorías.">La directiva las irá creando. Vuelva pronto.</ThreadListEmpty>
        </div>
      </div>
    );
  }

  return (
    <div data-wide className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_18rem]">
      {/* Wide screens: the filters live in a rail beside the list; on phones they stay on top of it. */}
      <div className="-m-1.5 hidden max-h-[calc(100dvh-7rem)] gap-6 overflow-y-auto p-1.5 lg:sticky lg:top-20 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:grid xl:row-span-1">
        <ThreadFilterTabs active={filter} hrefFor={hrefForFilter} counts={counts} orientation="vertical" />
        <CategoryRail categories={railCategories} active={category?.slug} filter={filter} />
      </div>

      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="min-w-0 text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight">Hilos</h1>
          <NewThreadMenu categories={categories} currentSlug={category?.slug} />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <div className="border-b border-border px-2 py-1.5 lg:hidden">
            <ThreadFilterTabs active={filter} hrefFor={hrefForFilter} counts={counts} />
          </div>
          {categories.length > 1 ? (
            <div className="border-b border-border px-3 py-2.5 sm:px-4 lg:hidden">
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
        {items.length > 0 ? <StartThreadRow categories={categories} currentSlug={category?.slug} /> : null}
        <Pagination page={page} pageCount={pageCount} hrefFor={(target) => feedHref({ category: category?.slug, filter, page: target })} />
      </div>

      <div className="grid gap-6 lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1">
        {openEvents.length > 0 ? <OpenRegistrationsAside events={openEvents} /> : null}
        <ForumHowItWorks />
      </div>
    </div>
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
