"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { HOME_NAV, MODULE_NAV, type NavItem } from "./nav-items";

function isCurrent(pathname: string, item: NavItem): boolean {
  return item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Sidebar list (desktop). */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones">
      <ul className="grid gap-1">
        {[HOME_NAV, ...MODULE_NAV].map((item) => {
          const current = isCurrent(pathname, item);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded px-3 font-semibold text-mist",
                  "transition-colors duration-150 ease-out hover:bg-white/6 hover:text-white",
                  "aria-[current=page]:bg-navy-lift aria-[current=page]:text-white",
                )}
              >
                <Icon name={item.icon} className="group-aria-[current=page]:text-sky" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom tab bar (phone): the six modules one tap away, thumb height. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 bg-muted pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-border)] lg:hidden"
    >
      <ul className="grid h-17 grid-cols-6">
        {MODULE_NAV.map((item) => {
          const current = isCurrent(pathname, item);

          return (
            <li key={item.href} className="contents">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-xs font-semibold text-mist no-underline",
                  "transition-colors duration-150 ease-out active:bg-navy-lift",
                  "aria-[current=page]:text-sky",
                  "focus-visible:-outline-offset-4",
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
