"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

import { BrandIsotype } from "../../_components/brand-mark";
import isotype from "@/components/brand/isotype.svg";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { Role } from "@/domain/user";

import { activeArea, areaNav, HOME_NAV, type NavItem } from "./nav-items";
import { GuardedLink } from "./unsaved-changes";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white";

/** The pill of a rail or tab bar item: white (on the always-navy rail) on the current area, a faint fill on hover. */
const PILL = cn(
  "relative grid place-items-center rounded-full transition-colors duration-150 ease-out",
  "group-hover:bg-white/8 group-aria-[current=page]:bg-white group-aria-[current=page]:text-deep",
);

/** Inicio first, then the four areas, each with whether it is the page's own. */
function useNavItems(role: Role): { item: NavItem & { short?: string }; current: boolean }[] {
  const pathname = usePathname();
  const area = activeArea(pathname);

  return [
    { item: HOME_NAV, current: pathname === HOME_NAV.href },
    ...areaNav(role).map((item) => ({ item, current: item === area })),
  ];
}

/**
 * Rail (desktop): the navy strip that floats 12px from the window's edges (the rounded box is the layout's), the
 * isotype on top and Inicio plus the four areas under it, each an icon in a 56×32 pill above a short label. The
 * area of the current page is lit by the `matches` of each item (see nav-items.ts), not by guessing from the link's
 * own path. Every link asks before it leaves unsaved changes behind (`GuardedLink`), and so does the tab bar.
 */
export function Rail({ role }: { role: Role }) {
  const items = useNavItems(role);

  return (
    <nav aria-label="Áreas" className="flex flex-col items-center">
      <GuardedLink
        href="/admin"
        aria-label="ASO Computación, inicio de la administración"
        className={cn("grid size-14 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--color-border)]", FOCUS, "focus-visible:outline-offset-2")}
      >
        <Image src={isotype} alt="" width={30} height={34} priority />
      </GuardedLink>
      <ul className="mt-5 grid gap-1.5">
        {items.map(({ item, current }) => (
          <li key={item.href}>
            <GuardedLink
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group flex w-22 flex-col items-center gap-1 rounded-card py-1 text-xs leading-none font-bold tracking-tight whitespace-nowrap text-white/80",
                "hover:text-white aria-[current=page]:text-white",
                FOCUS,
              )}
            >
              <span className={cn(PILL, "h-8 w-14")}>
                <Icon name={item.icon} className="size-5" />
              </span>
              {item.label}
            </GuardedLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Bottom tab bar (phone): the rail turned into a floating bar 12px from the edges, with the same pill, Inicio and
 * the four areas one tap away at thumb height.
 */
export function TabBar({ role }: { role: Role }) {
  const items = useNavItems(role);

  return (
    <nav
      aria-label="Áreas"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-card bg-deep p-1.5 text-white shadow-[0_0_0_1px_var(--color-border)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ item, current }) => (
          <li key={item.href} className="contents">
            <GuardedLink
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.6875rem] leading-none font-bold tracking-tight whitespace-nowrap text-white/80 no-underline",
                "aria-[current=page]:text-white",
                FOCUS,
                "focus-visible:-outline-offset-2",
              )}
            >
              <span className={cn(PILL, "h-7.5 w-13")}>
                <Icon name={item.icon} className="size-5" />
              </span>
              {item.short ? (
                <>
                  <span aria-hidden="true">{item.short}</span>
                  <span className="sr-only">{item.label}</span>
                </>
              ) : (
                item.label
              )}
            </GuardedLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Top bar (phone only): the isotype, which is the way to Inicio, and the name of the area the page belongs to. Nothing about the session. */
export function PhoneTopBar() {
  const pathname = usePathname();
  const title = pathname === HOME_NAV.href ? HOME_NAV.label : (activeArea(pathname)?.label ?? "Admin ASO");

  return (
    <header className="sticky top-0 z-30 flex h-15 items-center gap-3 bg-background px-4 shadow-[0_1px_0_var(--color-border)] sm:px-6 lg:hidden">
      <GuardedLink
        href="/admin"
        aria-label="ASO Computación, inicio de la administración"
        className="grid size-11 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--color-border)]"
      >
        <BrandIsotype width={22} height={25} />
      </GuardedLink>
      <span className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold">{title}</span>
    </header>
  );
}
