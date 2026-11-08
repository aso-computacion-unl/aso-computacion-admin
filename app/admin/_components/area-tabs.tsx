import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { Role } from "@/domain/user";
import { cn } from "@/lib/utils";

import { MoreMenu } from "./more-menu";
import { AJUSTES_TABS, CONTENIDO_MORE, CONTENIDO_TABS, visibleTo, type TabItem } from "./nav-items";

type AreaTabsProps =
  | {
      area: "contenido";
      /** The path of the list in view, e.g. `/admin/news`. */
      current: string;
    }
  | {
      area: "ajustes";
      current: string;
      /** Admin-only tabs are hidden from editors; each page still enforces its own role. */
      role: Role;
    };

const TAB = cn(
  "inline-flex min-h-11 items-center gap-1.5 rounded border border-input px-3.5 text-sm font-semibold whitespace-nowrap text-mist",
  "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
  "aria-[current=page]:border-action aria-[current=page]:bg-action aria-[current=page]:text-on-action",
);

/**
 * The tab strip at the top of the pages of an area: Contenido (the types of the landing, with "+ Crear" for the
 * current one) and Ajustes. The strip scrolls sideways inside its own box on a phone, so it never widens the page.
 */
export function AreaTabs(props: AreaTabsProps) {
  const { current } = props;
  const contenido = props.area === "contenido";
  const tabs = contenido ? CONTENIDO_TABS : visibleTo(AJUSTES_TABS, props.role);
  const create = contenido ? [...CONTENIDO_TABS, ...CONTENIDO_MORE].find((tab) => tab.href === current)?.create : undefined;

  return (
    <div data-slot="area-tabs" className="mb-6 flex items-center gap-3">
      <div data-slot="tab-strip" className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav aria-label={contenido ? "Tipo de contenido" : "Ajustes"}>
          <ul className="flex w-max gap-2">
            {tabs.map((tab) => (
              <li key={tab.href}>
                <Tab tab={tab} current={current} />
              </li>
            ))}
            {contenido ? <MoreMenu items={CONTENIDO_MORE} current={current} tabClassName={TAB} /> : null}
          </ul>
        </nav>
      </div>
      {create ? (
        <Button asChild className="shrink-0">
          <Link href={create}>
            <Icon name="plus" />
            Crear
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function Tab({ tab, current }: { tab: TabItem; current: string }) {
  return (
    <Link href={tab.href} aria-current={tab.href === current ? "page" : undefined} className={TAB}>
      {tab.label}
      {tab.adminOnly ? (
        <>
          <Icon name="lock" className="size-4" />
          <span className="sr-only"> solo administradores</span>
        </>
      ) : null}
    </Link>
  );
}
