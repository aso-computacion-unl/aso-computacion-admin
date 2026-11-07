"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { TabItem } from "./nav-items";

const MENU_WIDTH = 224;
const EDGE = 8;

interface MoreMenuProps {
  items: readonly TabItem[];
  /** The path of the page in view: when it is one of the items, the button names it and lights up. */
  current: string;
  /** The look of a tab, so the button sits in the strip like its neighbours. */
  tabClassName: string;
}

/**
 * The "Más ▾" tab: the types that do not fit the strip. The menu is fixed to the button's place in the window
 * (not absolute inside the strip), because the strip scrolls sideways on a phone and would clip it.
 */
export function MoreMenu({ items, current, tabClassName }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const root = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const active = items.find((item) => item.href === current);

  useEffect(() => {
    if (!open) return;

    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", close);

    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function toggle() {
    const rect = button.current?.getBoundingClientRect();

    if (rect) setStyle({ top: rect.bottom + 4, left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - MENU_WIDTH - EDGE)) });
    setOpen((value) => !value);
  }

  return (
    <li
      ref={root}
      className="flex-none"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;

        setOpen(false);
        button.current?.focus();
      }}
    >
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="more-menu"
        aria-current={active ? "page" : undefined}
        onClick={toggle}
        className={tabClassName}
      >
        {active ? active.label : "Más"}
        <Icon name="chev" className={cn("size-4 transition-transform duration-150", open && "rotate-180")} />
      </button>
      <div
        id="more-menu"
        data-slot="more-menu"
        hidden={!open}
        style={style}
        className="fixed z-50 grid w-56 gap-0.5 rounded bg-card p-2 shadow-[0_0_0_1.5px_var(--color-border),6px_6px_0_var(--color-signal)]"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.href === current ? "page" : undefined}
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center rounded-xs px-3 font-semibold hover:bg-foreground/6 aria-[current=page]:bg-action aria-[current=page]:text-on-action"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </li>
  );
}
