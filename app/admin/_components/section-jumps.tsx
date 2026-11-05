"use client";

import { useEffect, useState } from "react";

interface SectionJumpsProps {
  label: string;
  items: readonly { href: `#${string}`; label: string }[];
}

/** A section counts as reached once its top has scrolled above this line: the 56px top bar plus some air. */
const READING_LINE_PX = 120;

/**
 * In-page links to the sections of a long edit page, on a phone only: there the side column falls under the
 * form, thousands of pixels down. From lg up the side column sits beside the form and needs no shortcut.
 * The chip of the section in view is marked with `aria-current="location"`.
 */
export function SectionJumps({ label, items }: SectionJumpsProps) {
  const [current, setCurrent] = useState<string | undefined>(items[0]?.href);

  useEffect(() => {
    function update() {
      const sections = items.flatMap(({ href }) => {
        const section = document.getElementById(href.slice(1));

        return section ? [{ href, top: section.getBoundingClientRect().top }] : [];
      });
      const first = sections[0];
      if (!first) return;

      // The last section reached is the current one; at the very bottom the lowest section is, even when it is
      // too short to ever reach the line. Before any is reached, the first one on the page is.
      const lowest = (list: typeof sections) => list.reduce((best, section) => (section.top > best.top ? section : best), first);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const reached = sections.filter((section) => section.top <= READING_LINE_PX);
      const pick = atBottom ? lowest(sections) : reached.length > 0 ? lowest(reached) : sections.reduce((best, section) => (section.top < best.top ? section : best), first);

      setCurrent(pick.href);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  return (
    <nav aria-label={label} className="-mb-2 flex flex-wrap gap-2 lg:hidden">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={current === item.href ? "location" : undefined}
          onClick={() => setCurrent(item.href)}
          className="inline-flex min-h-11 items-center rounded bg-card px-4 text-sm font-semibold transition-colors duration-150 ease-out hover:bg-foreground/8 aria-[current=location]:bg-foreground/14 focus-visible:outline-2 focus-visible:outline-sky"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
