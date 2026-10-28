import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { BrandLogo } from "./brand-mark";

interface AuthSplitProps {
  /** Accessible name of the brand panel. */
  panelLabel: string;
  /** What the product is for, set large in the title face; not a heading, the form side owns the page's h1. */
  headline: string;
  /** Short lines under the headline, if the form side does not already say it. */
  lines?: string[];
  /** Decorative terminal line above the visual, without the prompt: "git log --oneline". */
  terminal: string;
  /** Decorative picture of the product (a commit log, a thread list); the caller marks it aria-hidden. */
  visual: ReactNode;
  /** The panel's logo, and on phones (no panel) the logo above the form. The forum's top bar already carries the brand. */
  logo?: boolean;
  /** A bar above the screen (the forum's) takes this much of the height. */
  belowTopBar?: boolean;
  /** The visual runs off the bottom edge of the panel, and the branch line with it. */
  bleed?: boolean;
  /** The sign-in's heading, and the id its section is named by. */
  title: ReactNode;
  titleId: string;
  /** The face of the title: the admin's or the forum's. */
  titleClassName: string;
  /** Pinned to the corner of the form side, e.g. the theme toggle. */
  corner?: ReactNode;
  /** The rest of the sign-in: message and ways in. */
  children: ReactNode;
}

/**
 * The sign-in screen of the admin and of the forum. On wide screens it is two zones that fill the height: a brand
 * panel (the product named at the scale of a poster, then its branch of the repository history) and the form,
 * which carries the same branch line with the title as its first commit. On phones, just the form.
 */
export function AuthSplit({ panelLabel, headline, lines = [], terminal, visual, logo = false, belowTopBar = false, bleed = false, title, titleId, titleClassName, corner, children }: AuthSplitProps) {
  return (
    <div className={cn("grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]", belowTopBar ? "min-h-[calc(100dvh-3.5rem)]" : "min-h-dvh")}>
      <aside
        aria-label={panelLabel}
        className={cn("hidden flex-col justify-between gap-14 bg-muted px-12 pt-14 lg:flex xl:px-20 xl:pt-16 2xl:px-28", bleed ? "pb-0" : "pb-14 xl:pb-16")}
      >
        <div className="grid justify-items-start gap-10 xl:gap-12">
          {logo ? <BrandLogo alt="ASO Computación" width={128} className="h-auto w-32" /> : null}

          <div className="grid gap-5">
            <p className="max-w-[16ch] font-display text-[clamp(2.5rem,4.2vw,4.5rem)] leading-[1.03] tracking-tight text-balance">{headline}</p>
            {lines.map((line) => (
              <p key={line} className="max-w-[60ch] text-lg text-mist">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* The branch line, with the terminal as its first commit. */}
        <div className={cn("relative max-w-3xl border-l-2 border-sky pl-7", bleed ? "pb-0" : "pb-1")}>
          <span aria-hidden="true" className="absolute top-[0.1875rem] -left-[calc(0.5625rem+1px)] size-[1.125rem] rounded-full border-[3px] border-muted bg-sky" />
          <p aria-hidden="true" className="mb-6 font-mono text-sm leading-6 text-sky xl:text-base">
            $ {terminal}
          </p>
          {visual}
        </div>
      </aside>

      <div className="relative flex items-center bg-background px-6 py-10 sm:px-12 lg:px-14 xl:px-24">
        {corner ? <div className="absolute top-3 right-3">{corner}</div> : null}
        <div className="mx-auto w-full max-w-md xl:max-w-[28rem]">
          {logo ? <BrandLogo alt="ASO Computación" width={168} className="mb-10 h-auto w-42 lg:hidden" /> : null}
          <section aria-labelledby={titleId} className="relative grid gap-6 border-l-2 border-sky pb-2 pl-7">
            <h1 id={titleId} className={cn(
                // The history graph's node, on the branch line and level with the title's first line (`em` is the title's size).
                "relative before:absolute before:top-[calc(0.575em-0.5625rem)] before:left-[calc(-1.75rem-0.625rem)] before:size-[1.125rem] before:rounded-full before:border-[3px] before:border-background before:bg-sky before:content-['']",
                titleClassName,
              )}>
              {title}
            </h1>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
