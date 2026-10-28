import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { BrandLogo } from "./brand-mark";

interface AuthSplitProps {
  /** Accessible name of the brand panel. */
  panelLabel: string;
  /** What the product is for, as a line in the title face; not a heading, the form side owns the page's h1. */
  headline: string;
  /** One or two short lines under the headline. */
  lines: string[];
  /** Decorative terminal line above the visual, without the prompt: "git log --oneline". */
  terminal: string;
  /** Decorative picture of the product (a commit log, a thread list); the caller marks it aria-hidden. */
  visual: ReactNode;
  /** A bar above the screen (the forum's) takes this much of the height. */
  belowTopBar?: boolean;
  /** Phones hide the panel, so the logo moves above the form. */
  mobileLogo?: boolean;
  /** The sign-in itself: heading, message and ways in. */
  children: ReactNode;
}

/**
 * The sign-in screen of the admin and of the forum: on wide screens a brand panel (the logo, what the product is
 * for and the branch line of the landing's history graph) beside the form, filling the height; on phones just the
 * form. The form side is `relative`, so a theme toggle placed in `children` can sit in its corner.
 */
export function AuthSplit({ panelLabel, headline, lines, terminal, visual, belowTopBar = false, mobileLogo = false, children }: AuthSplitProps) {
  return (
    <div className={cn("grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]", belowTopBar ? "min-h-[calc(100dvh-3.5rem)]" : "min-h-dvh")}>
      <aside aria-label={panelLabel} className="hidden flex-col justify-center gap-10 bg-navy-deep px-12 py-12 lg:flex xl:px-20">
        <BrandLogo alt="ASO Computación" width={128} className="h-auto w-32" />

        <div className="grid max-w-[40ch] gap-3">
          <p className="font-display text-[clamp(1.75rem,2.4vw,2.5rem)] leading-[1.1] text-balance">{headline}</p>
          {lines.map((line) => (
            <p key={line} className="text-lg text-mist">
              {line}
            </p>
          ))}
        </div>

        {/* The branch line, with the terminal as its first commit. */}
        <div className="relative max-w-xl border-l-2 border-sky pl-7">
          <span aria-hidden="true" className="absolute top-[0.1875rem] -left-[calc(0.5625rem+1px)] size-[1.125rem] rounded-full border-[3px] border-navy-deep bg-sky" />
          <p aria-hidden="true" className="mb-4 font-mono text-sm leading-6 text-sky">
            $ {terminal}
          </p>
          {visual}
        </div>
      </aside>

      <div className="relative grid place-items-center px-6 py-10 sm:px-12">
        <div className="w-full max-w-md">
          {mobileLogo ? <BrandLogo alt="ASO Computación" width={168} className="mb-10 h-auto w-42 lg:hidden" /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
