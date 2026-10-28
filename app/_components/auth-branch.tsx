import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { BrandLogo } from "./brand-mark";
import { GoogleButton } from "./google-button";
import "./auth-branch.css";

interface AuthBranchProps {
  /** The branch the terminal line names (`git branch --show-current admin`) and HEAD points to. */
  branch: string;
  /** The sign-in's heading, and the id its section is named by. */
  title: string;
  titleId: string;
  /** The first node (HEAD): what the way in says, its error and its buttons. */
  head: ReactNode;
  /** The nodes after it, as `<BranchNode>`: what comes once inside. */
  nodes: ReactNode;
  /** The line under the branch. */
  note: string;
  /** The brand at the top left. The forum's top bar already carries it. */
  logo?: boolean;
  /** A bar above the screen (the forum's) takes this much of the height. */
  belowTopBar?: boolean;
  /** Pinned to the top right, e.g. the theme toggle. */
  corner?: ReactNode;
}

/**
 * The sign-in screen of the admin and of the forum: a branch of the repository history that crosses the whole width.
 * The way in is HEAD, its first node; the hollow nodes after it say what the visitor will be able to do. On phones
 * the branch turns vertical. The caller supplies the page's `<main>` (the forum's layout already has one).
 */
export function AuthBranch({ branch, title, titleId, head, nodes, note, logo = false, belowTopBar = false, corner }: AuthBranchProps) {
  return (
    <div
      className={cn(
        "flex flex-col px-6 pt-5 pb-6 min-[900px]:px-[clamp(1.5rem,5vw,6rem)] min-[900px]:pt-[clamp(1.25rem,2.6vw,3rem)] min-[900px]:pb-[clamp(1.25rem,2.4vw,2.5rem)]",
        belowTopBar ? "min-h-[calc(100dvh-3.5rem)]" : "min-h-dvh",
      )}
    >
      <div className="flex items-center justify-between gap-6">
        {logo ? <BrandLogo alt="ASO Computación" width={156} className="h-auto w-[clamp(5rem,8vw,9.75rem)]" /> : <span />}
        <div className="flex items-center gap-4">
          <p aria-hidden="true" className="hidden font-mono text-[0.9375rem] text-sky min-[900px]:block">
            $ git branch --show-current <b className="font-semibold text-foreground">{branch}</b>
          </p>
          {corner}
        </div>
      </div>

      <section
        aria-labelledby={titleId}
        className="flex flex-1 flex-col justify-start gap-7 pt-6 pb-2 min-[900px]:justify-between min-[900px]:gap-[clamp(2rem,6vh,4.5rem)] min-[900px]:py-[clamp(1.5rem,4vh,3.5rem)]"
      >
        <h1
          id={titleId}
          className="font-display text-[clamp(2rem,9.6vw,3rem)] leading-[1.02] tracking-[-0.02em] text-balance min-[900px]:text-[clamp(2.25rem,4.7vw,5.75rem)] min-[900px]:whitespace-nowrap"
        >
          {title}
        </h1>

        <ol className="branch">
          <li>
            <span aria-hidden="true" className="mb-4 inline-block rounded-xs bg-sky px-2.5 py-0.5 font-mono text-[1.0625rem] font-semibold text-navy">
              HEAD → {branch}
            </span>
            {head}
          </li>
          {nodes}
        </ol>
      </section>

      <p className="flex flex-col gap-1 pt-6 font-mono text-sm text-mist min-[900px]:flex-row min-[900px]:justify-between min-[900px]:gap-6 min-[900px]:pt-2">
        <span>{note}</span>
        <span>ASO Computación · Universidad Nacional de Loja</span>
      </p>
    </div>
  );
}

interface BranchNodeProps {
  /** The short hash (or branch name) set above the node's text, in the terminal face. */
  hash: string;
  children: ReactNode;
  /** A sample, not content: hidden from assistive technology and inert. */
  decorative?: boolean;
}

/** A hollow node of the branch: what comes after HEAD. */
export function BranchNode({ hash, children, decorative = false }: BranchNodeProps) {
  return (
    <li {...(decorative ? { "aria-hidden": true, inert: true } : {})}>
      <span aria-hidden="true" className="mb-2.5 block font-mono text-[1.0625rem] text-sky">
        {hash}
      </span>
      {children}
    </li>
  );
}

/** What HEAD says: the one sentence above the way in. */
export function BranchLead({ children }: { children: ReactNode }) {
  return <p className="mb-7 max-w-[36ch] font-stretch-[108%] text-[clamp(1.125rem,1.35vw,1.625rem)] leading-[1.35] text-foreground">{children}</p>;
}

/** The title of a node after HEAD. */
export function BranchNodeTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-[750] font-stretch-[112%] text-[clamp(1.25rem,1.75vw,2.125rem)] leading-[1.15] tracking-[-0.015em] text-balance">{children}</h2>;
}

/** The text under a node's title. */
export function BranchNodeText({ children }: { children: ReactNode }) {
  return <p className="text-[clamp(1rem,1.1vw,1.3125rem)] leading-normal text-mist min-[900px]:max-w-[30ch]">{children}</p>;
}

/** HEAD's Google button, sized as the page's main action; the width of the way in. */
export function BranchGoogleButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <GoogleButton
      href={href}
      className="min-h-[clamp(3.75rem,8.4vh,5.5rem)] w-full text-[clamp(1.0625rem,1.35vw,1.5rem)] min-[900px]:max-w-[34rem] [&_svg]:size-[1.2em]"
    >
      {children}
    </GoogleButton>
  );
}
