import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getAdminBoardMembers } from "@/interface/admin/board/board-members-admin-read";
import { getAdminEvents } from "@/interface/admin/events/events-admin-read";
import { getAdminFaqs } from "@/interface/admin/faqs/faqs-admin-read";
import { getAdminPillars } from "@/interface/admin/pillars/pillars-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { getAdminSocialLinks } from "@/interface/admin/socials/socials-admin-read";

import { PageHead } from "./_components/page-head";
import { MODULE_NAV } from "./_components/nav-items";

// Counts are read on every request.
export const dynamic = "force-dynamic";

type Summary = (typeof MODULE_NAV)[number]["href"];

/** One line per module; a module whose read fails shows a dash instead of taking the whole home down. */
async function summaries(): Promise<Record<Summary, string>> {
  const describe = async (read: () => Promise<readonly { isPublished: boolean }[]>) => {
    try {
      return publicationSummary(await read());
    } catch {
      return "—";
    }
  };

  const [events, faqs, board, pillars, socials] = await Promise.all([
    describe(getAdminEvents),
    describe(getAdminFaqs),
    describe(getAdminBoardMembers),
    describe(getAdminPillars),
    describe(getAdminSocialLinks),
  ]);

  return {
    "/admin/events": events,
    "/admin/faqs": faqs,
    "/admin/board": board,
    "/admin/pillars": pillars,
    "/admin/socials": socials,
    "/admin/settings": "Lema, descripción y «Acerca de»",
  };
}

export default async function AdminHomePage() {
  const lines = await summaries();

  return (
    <div className="max-w-3xl">
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

      <nav aria-label="Contenido del sitio" className="mt-8">
        <ul className="divide-y divide-border border-y border-border">
          {MODULE_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 py-3 pr-2 transition-colors duration-150 ease-out hover:bg-white/4"
              >
                <Icon name={item.icon} className="ml-2 text-sky" />
                <span className="grid">
                  <span className="font-bold font-stretch-[112%]">{item.label}</span>
                  <span className="font-mono text-[0.8125rem] text-mist">{lines[item.href]}</span>
                </span>
                <Icon name="right" className="text-mist transition-transform duration-200 ease-(--ease-reveal) group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
