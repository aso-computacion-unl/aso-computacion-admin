import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getAdminBoardMembers } from "@/interface/admin/board/board-members-admin-read";
import { getAdminEvents } from "@/interface/admin/events/events-admin-read";
import { getAdminFaqs } from "@/interface/admin/faqs/faqs-admin-read";
import { getAdminNewsItems } from "@/interface/admin/news/news-admin-read";
import { getAdminPillars } from "@/interface/admin/pillars/pillars-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { getAdminSocialLinks } from "@/interface/admin/socials/socials-admin-read";

import { PageHead } from "./_components/page-head";
import { MODULE_NAV } from "./_components/nav-items";

// Counts are read on every request.
export const dynamic = "force-dynamic";

type Summary = (typeof MODULE_NAV)[number]["href"];

interface ModuleSummary {
  /** How many records the module holds; `null` when it has no list or its read failed. */
  count: number | null;
  line: string;
}

/** One summary per module; a module whose read fails shows a dash instead of taking the whole home down. */
async function summaries(): Promise<Record<Summary, ModuleSummary>> {
  const describe = async (read: () => Promise<readonly { isPublished: boolean }[]>): Promise<ModuleSummary> => {
    try {
      const items = await read();

      return { count: items.length, line: publicationSummary(items) };
    } catch {
      return { count: null, line: "—" };
    }
  };

  const [events, news, faqs, board, pillars, socials] = await Promise.all([
    describe(getAdminEvents),
    describe(getAdminNewsItems),
    describe(getAdminFaqs),
    describe(getAdminBoardMembers),
    describe(getAdminPillars),
    describe(getAdminSocialLinks),
  ]);

  return {
    "/admin/events": events,
    "/admin/news": news,
    "/admin/faqs": faqs,
    "/admin/board": board,
    "/admin/pillars": pillars,
    "/admin/socials": socials,
    "/admin/settings": { count: null, line: "Lema, descripción y «Acerca de»" },
  };
}

export default async function AdminHomePage() {
  const lines = await summaries();

  return (
    <div>
      <PageHead
        title="Inicio"
        meta="main · el sitio se vuelve a publicar con cada cambio"
        action={
          <Button asChild className="min-h-12">
            <Link href="/admin/events/new">
              <Icon name="plus" />
              Nuevo evento
            </Link>
          </Button>
        }
      />

      {/* A list on a phone; from sm up one card per module: its count, its state and its main action. */}
      <nav aria-label="Contenido del sitio" className="mt-8">
        <ul className="divide-y divide-border border-y border-border sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:border-y-0 xl:grid-cols-3">
          {MODULE_NAV.map((item) => {
            const { count, line } = lines[item.href] ?? { count: null, line: "—" };

            return (
              <li key={item.href} className="group relative sm:flex sm:flex-col sm:rounded sm:bg-card">
                <Link
                  href={item.href}
                  className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 py-3 pr-2 transition-colors duration-150 ease-out after:absolute after:inset-0 after:content-[''] hover:bg-foreground/4 sm:flex-1 sm:items-start sm:rounded sm:p-5 sm:pb-4"
                >
                  <Icon name={item.icon} className="ml-2 text-sky sm:mt-1 sm:ml-0" />
                  <span className="grid">
                    <span className="font-bold font-stretch-[112%] sm:text-lg">{item.label}</span>
                    <span className="font-mono text-[0.8125rem] text-mist">{line}</span>
                  </span>
                  {count === null ? null : (
                    <span aria-hidden="true" className="hidden font-display text-4xl leading-none text-sky tabular-nums sm:block">
                      {count}
                    </span>
                  )}
                  <Icon name="right" className="text-mist transition-transform duration-200 ease-(--ease-reveal) group-hover:translate-x-0.5 group-hover:text-foreground sm:hidden" />
                </Link>
                {item.action ? (
                  <div className="relative z-1 hidden px-5 pb-5 sm:block">
                    <Button asChild variant="line" size="sm">
                      <Link href={item.action.href}>
                        {item.action.href === item.href ? <Icon name="edit" className="size-4" /> : <Icon name="plus" className="size-4" />}
                        {item.action.label}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
