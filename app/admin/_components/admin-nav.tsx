"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { Role } from "@/domain/user";

import { TAB_NAV, moreNav, sideNavGroups, type NavItem } from "./nav-items";

function isCurrent(pathname: string, item: NavItem): boolean {
  return item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Sidebar (desktop), in groups. Every section must fit the screen without scrolling and without dead space,
 * so the rows share the height the sidebar's fixed parts leave (`--sidebar-chrome`, set on the aside):
 * never below 24 px (the target-size minimum), never above 44 px. The scroll is only a last resort for
 * windows shorter than every row at its minimum.
 */
export function SideNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const groups = sideNavGroups(role);
  const rows = groups.reduce((count, group) => count + group.items.length, 0);

  return (
    <nav
      aria-label="Secciones"
      className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]"
      style={{ "--nav-rows": rows } as CSSProperties}
    >
      {groups.map((group) => {
        const headingId = group.label ? `nav-${group.label}` : undefined;

        return (
          <div key={group.label ?? "home"} className="[&+&]:mt-1">
            {group.label ? (
              <p id={headingId} className="flex h-5 items-end px-3 pb-1 font-mono text-[0.6875rem] leading-none text-mist">
                {group.label}/
              </p>
            ) : null}
            <ul aria-labelledby={headingId}>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isCurrent(pathname, item) ? "page" : undefined}
                    className={cn(
                      "group flex h-[clamp(1.5rem,calc((100dvh-var(--sidebar-chrome))/var(--nav-rows)),2.75rem)] items-center gap-2.5 rounded px-3",
                      "text-sm font-medium text-mist transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                      "aria-[current=page]:bg-navy-lift aria-[current=page]:font-semibold aria-[current=page]:text-foreground aria-[current=page]:shadow-[inset_3px_0_0_var(--color-signal)]",
                    )}
                  >
                    <Icon name={item.icon} className="size-4 shrink-0 opacity-80 group-aria-[current=page]:opacity-100" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

const TAB_LINK_CLASSES = cn(
  "flex flex-col items-center justify-center gap-1 text-xs font-semibold text-mist no-underline",
  "transition-colors duration-150 ease-out active:bg-navy-lift",
  "aria-[current=page]:text-foreground aria-[current=page]:shadow-[inset_0_3px_0_var(--color-signal)]",
  "focus-visible:-outline-offset-4",
);

/**
 * The "Más" tab opens a modal sheet with the sections that are not on the bar. A native `<dialog>`
 * gives the focus trap, Escape to close, an inert page behind it and focus back on the tab for free;
 * the sheet is capped to the space above the tab bar and scrolls inside it, so no item is cut off on a short phone;
 * it closes on navigation and when the screen grows past the phone layout. It has no
 * animation, so there is nothing for reduced motion to switch off.
 */
function MoreTab({ pathname, role }: { pathname: string; role: Role }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const items = moreNav(role);
  const current = items.some((item) => isCurrent(pathname, item));

  function close() {
    dialog.current?.close();
  }

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) dialog.current?.close();
    };

    desktop.addEventListener("change", closeOnDesktop);

    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <li className="contents">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-current={current ? "page" : undefined}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        className={cn(TAB_LINK_CLASSES, "cursor-pointer")}
      >
        <Icon name="more" />
        Más
      </button>
      <dialog
        ref={dialog}
        aria-label="Más secciones"
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the dialog element itself, outside its content box.
        onClick={(event) => event.target === event.currentTarget && close()}
        className="fixed inset-x-0 top-auto bottom-[calc(4.25rem+env(safe-area-inset-bottom))] m-0 max-h-[calc(100dvh-4.25rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] w-full max-w-none overflow-y-auto overscroll-contain rounded-t border-0 bg-muted p-2 text-foreground shadow-[0_-1px_0_var(--color-border)] backdrop:bg-scrim lg:hidden"
      >
        <ul className="grid gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent(pathname, item) ? "page" : undefined}
                onClick={close}
                className={cn(
                  "group flex min-h-12 items-center gap-3 rounded px-3 font-semibold text-mist",
                  "transition-colors duration-150 ease-out active:bg-navy-lift",
                  "aria-[current=page]:bg-navy-lift aria-[current=page]:text-foreground aria-[current=page]:shadow-[inset_3px_0_0_var(--color-signal)]",
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </li>
  );
}

/** Bottom tab bar (phone): the busiest modules one tap away at thumb height, the rest behind "Más". */
export function TabBar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 bg-muted pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-border)] lg:hidden"
    >
      <ul className="grid h-17 auto-cols-fr grid-flow-col">
        {TAB_NAV.map((item) => {
          const current = isCurrent(pathname, item);

          return (
            <li key={item.href} className="contents">
              <Link href={item.href} aria-current={current ? "page" : undefined} className={TAB_LINK_CLASSES}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
        <MoreTab pathname={pathname} role={role} />
      </ul>
    </nav>
  );
}
