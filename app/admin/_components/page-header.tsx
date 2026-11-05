import type { ReactNode } from "react";

import { GuardedBackLink } from "./form-parts";

interface PageHeaderProps {
  title: string;
  /** One mono line under the title, like a branch status: `main · 3 publicados · 1 borrador`. */
  status?: ReactNode;
  /** One prose line, two at most: what the page is for. Long explanations belong in the page, not here. */
  description?: ReactNode;
  /** The page's primary action. It sits top right and drops under the text on a phone. */
  action?: ReactNode;
  back?: { href: string; label: string };
}

/** The head of every admin page: the same order and the same slots, so the title and the action never move between screens. */
export function PageHeader({ title, status, description, action, back }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto]">
      {back ? (
        <div className="md:col-span-2">
          <GuardedBackLink href={back.href}>{back.label}</GuardedBackLink>
        </div>
      ) : null}
      <div className="min-w-0">
        <h1 className="font-display text-[2rem] leading-[1.1] -tracking-[0.01em] text-balance wrap-anywhere md:text-[2.5rem]">{title}</h1>
        {status ? <p className="mt-1.5 font-mono text-[0.8125rem] wrap-anywhere text-mist">{status}</p> : null}
        {description ? <p className="mt-3 max-w-3xl text-mist">{description}</p> : null}
      </div>
      {action ? <div className="max-sm:[&>*]:w-full md:pt-1 [&_a]:min-h-12 [&_button]:min-h-12">{action}</div> : null}
    </header>
  );
}

const STATUS_NAME_MAX = 32;

/**
 * The status line of an edit page: which record this is and whether it is public, like a branch name and its state.
 * A long name is shortened so the state at the end is never cut off. `gender` agrees the participle: a news item is
 * `publicada`, an event `publicado`.
 */
export function recordStatus(name: string, isPublished: boolean, gender: "m" | "f"): string {
  const shortened = name.length > STATUS_NAME_MAX ? `${name.slice(0, STATUS_NAME_MAX).trimEnd()}…` : name;
  const state = isPublished ? (gender === "f" ? "publicada" : "publicado") : "borrador";

  return `${shortened} · ${state}`;
}
