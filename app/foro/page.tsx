import type { Metadata } from "next";

import { parseForumLandingError } from "@/interface/forum/forum-login-errors";
import { parsePageParam, parseThreadFilter, type ThreadFilter } from "@/interface/forum/forum-display";
import { feedHref } from "@/interface/forum/forum-links";
import { orNotFound } from "@/interface/forum/forum-page-errors";
import { parseForumReturnPath } from "@/interface/forum/forum-return-path";
import { getForumCategories, getForumFeed } from "@/interface/forum/forum-read";
import { hasSuspendedForumSession } from "@/interface/forum/forum-suspension";
import { getForumMember } from "@/interface/forum/require-forum-member";

import { CategoryFilter } from "./_components/category-filter";
import { ForumHowItWorks } from "./_components/forum-how-it-works";
import { ForumRail } from "./_components/forum-rail";
import { ForumShell } from "./_components/forum-shell";
import { NewThreadMenu } from "./_components/new-thread-menu";
import { Pagination } from "./_components/pagination";
import { SignInGate } from "./_components/sign-in-gate";
import { StartThreadRow } from "./_components/start-thread-row";
import { SuspensionNotice } from "./_components/suspension-notice";
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
    const returnTo = parseForumReturnPath(typeof next === "string" ? next : null) ?? undefined;

    // Only words: the guard above has already refused this request, and a suspended member gets no forum from here either.
    if (await hasSuspendedForumSession()) {
      return <SuspensionNotice next={returnTo} />;
    }

    return <SignInGate problem={parseForumLandingError(error)} next={returnTo} />;
  }

  const filter = parseThreadFilter(estado);
  const categorySlug = typeof categoria === "string" && categoria !== "" ? categoria : undefined;
  // The feed carries only the names; the rail also shows what each category is for and how many threads it has.
  const [feed, railCategories] = await Promise.all([
    orNotFound(getForumFeed({ categorySlug, state: filter, page: parsePageParam(pagina) })),
    orNotFound(getForumCategories()),
  ]);
  const { categories, category, items, counts, page, pageCount } = feed;
  const now = new Date();
  const hrefForFilter = (target: ThreadFilter) => feedHref({ category: category?.slug, filter: target });

  if (categories.length === 0) {
    return (
      <div data-wide className="px-4 py-8 sm:px-6">
        <h1 className="mb-5 text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight">Hilos</h1>
        <div className="rounded-xl border border-border bg-muted">
          <ThreadListEmpty title="Todavía no hay categorías.">La directiva las irá creando. Vuelva pronto.</ThreadListEmpty>
        </div>
      </div>
    );
  }

  return (
    // The list fills the width under the top bar: the rail of filters as tall as the screen, then the list and the guide on its side.
    <ForumShell rail={<ForumRail filter={filter} counts={counts} categories={railCategories} category={category?.slug} />}>
      <div className="mx-auto grid max-w-[100rem] gap-x-10 gap-y-12 2xl:min-h-[calc(100dvh-3.5rem-5rem)] 2xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:mb-6">
            <h1 className="min-w-0 text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.15] font-bold font-stretch-[106%] tracking-tight">Hilos</h1>
            <NewThreadMenu categories={categories} currentSlug={category?.slug} />
          </div>

          <div className="mb-4 overflow-hidden rounded-xl border border-border bg-muted lg:hidden">
            <div className="border-b border-border px-2 py-1.5">
              <ThreadFilterTabs active={filter} hrefFor={hrefForFilter} counts={counts} />
            </div>
            {categories.length > 1 ? (
              <div className="px-3 py-2.5 sm:px-4">
                <CategoryFilter categories={categories} active={category?.slug} filter={filter} />
              </div>
            ) : null}
          </div>

          {category?.description ? (
            <p data-slot="category-description" className="mb-4 max-w-[65ch] text-mist wrap-anywhere">
              {category.description}
            </p>
          ) : null}

          <div className="thread-graph">
            {items.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted">
                <ThreadListEmpty title={emptyTitle(filter, counts.open + counts.solved, category?.name)} action={<NewThreadMenu categories={categories} currentSlug={category?.slug} variant="line" align="center" />}>
                  {emptyHint(filter, counts.open + counts.solved)}
                </ThreadListEmpty>
              </div>
            ) : (
              <>
                <div aria-hidden="true" className="thread-cols hidden border-b border-border pb-2.5 text-xs font-semibold text-mist xl:grid">
                  <span className="col-start-2">Hilo</span>
                  <span>Autor</span>
                  <span>Última actividad</span>
                  <span className="justify-self-end">Respuestas</span>
                </div>
                <ul>
                  {items.map((thread) => (
                    <ThreadRow key={thread.id} thread={thread} now={now} category={category ? null : thread.category} />
                  ))}
                </ul>
                <StartThreadRow categories={categories} currentSlug={category?.slug} />
              </>
            )}
          </div>
          <Pagination page={page} pageCount={pageCount} hrefFor={(target) => feedHref({ category: category?.slug, filter, page: target })} />
        </div>

        {/* The column runs the height of the screen, with its divider; its guide stays in view while the list scrolls. */}
        <div className="2xl:border-l 2xl:border-border 2xl:pl-10">
          <div className="2xl:sticky 2xl:top-24">
            <ForumHowItWorks />
          </div>
        </div>
      </div>
    </ForumShell>
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
