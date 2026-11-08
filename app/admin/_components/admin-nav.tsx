"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import isotype from "@/components/brand/isotype.svg";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { Role } from "@/domain/user";

import { activeArea, areaNav } from "./nav-items";

const FOCUS = "focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-white";

/**
 * Rail (desktop): a narrow strip in the deep navy of the design, the isotype on top (it is the way to Inicio)
 * and the four areas under it, an icon above a short label. The area of the current page is lit by the
 * `matches` of each item (see nav-items.ts), not by guessing from the link's own path.
 */
export function Rail({ role }: { role: Role }) {
  const pathname = usePathname();
  const current = activeArea(pathname);

  return (
    <nav aria-label="Áreas" className="flex h-full flex-col items-center py-4">
      <Link
        href="/admin"
        aria-label="ASO Computación, inicio de la administración"
        aria-current={pathname === "/admin" ? "page" : undefined}
        className={cn("grid size-16 place-items-center rounded-sm", FOCUS, "focus-visible:outline-offset-2")}
      >
        <Image src={isotype} alt="" width={46} height={52} priority />
      </Link>
      <ul className="mt-4 grid w-full gap-1">
        {areaNav(role).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item === current ? "page" : undefined}
              className={cn(
                "flex h-23 w-full flex-col items-center justify-center gap-1.5 px-0.5 text-xs leading-none font-bold tracking-tight whitespace-nowrap text-white/80",
                "transition-colors duration-150 ease-out hover:bg-white/8 hover:text-white",
                "aria-[current=page]:bg-white/12 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_4px_0_0_var(--color-signal)]",
                FOCUS,
              )}
            >
              <Icon name={item.icon} className="size-7" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Bottom tab bar (phone): the same four areas one tap away at thumb height; the logo in the top bar is Inicio. */
export function TabBar({ role }: { role: Role }) {
  const current = activeArea(usePathname());

  return (
    <nav
      aria-label="Áreas"
      className="fixed inset-x-0 bottom-0 z-40 bg-deep pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-1px_0_var(--color-border)] lg:hidden"
    >
      <ul className="grid h-17 grid-cols-4">
        {areaNav(role).map((item) => (
          <li key={item.href} className="contents">
            <Link
              href={item.href}
              aria-current={item === current ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-0.5 text-xs leading-none font-bold tracking-tight whitespace-nowrap text-white/80 no-underline",
                "transition-colors duration-150 ease-out active:bg-white/12",
                "aria-[current=page]:bg-white/12 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_0_4px_0_var(--color-signal)]",
                FOCUS,
              )}
            >
              <Icon name={item.icon} className="size-6" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
