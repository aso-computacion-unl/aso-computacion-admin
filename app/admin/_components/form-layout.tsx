import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { PageHeader } from "./page-header";

/**
 * A flat, raised surface for a form or a block of controls. Never nested. It is a size container:
 * the fields inside choose their columns from the panel's width (`@xl:`), not the screen's, because
 * on a wide screen the panel shares the row with a side column.
 */
export function Panel({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("@container rounded bg-card p-4 md:p-5", className)} {...props}>
      {children}
    </section>
  );
}

interface FormHeaderProps {
  backHref: string;
  backLabel: string;
  title: string;
  /** The mono line: the record and its state on an edit page, `sin guardar` on a create page. */
  status: ReactNode;
  description?: ReactNode;
}

/** The head of every create/edit page: back link, title, status and what the page is for. */
export function FormHeader({ backHref, backLabel, title, status, description }: FormHeaderProps) {
  return <PageHeader back={{ href: backHref, label: backLabel }} title={title} status={status} description={description} />;
}

interface FormColumnsProps {
  /** Media, a gallery or a live preview, beside the form on lg+ and under it on a phone. Never a note: a note is the description. */
  aside?: ReactNode;
  /** Let the side column span the form's height, so a panel inside it can stick while the form scrolls. */
  stickyAside?: boolean;
  children: ReactNode;
}

/**
 * The form column, and beside it the side column when there is something to put there. The form is the same
 * width (41.5rem at xl) with or without a side column, so a small form is a narrow column of its own and never
 * stretches across the screen or reserves an empty one.
 */
export function FormColumns({ aside, stickyAside = false, children }: FormColumnsProps) {
  return (
    <div
      data-layout={aside ? "split" : "single"}
      className={cn("mt-6 grid items-start gap-6", aside && "lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] xl:grid-cols-[minmax(0,41.5rem)_26rem]")}
    >
      <div data-slot="form-column" className="grid min-w-0 max-w-166 gap-6">
        {children}
      </div>
      {aside ? (
        <div data-slot="form-aside" className={cn("grid min-w-0 content-start gap-6", stickyAside && "lg:self-stretch")}>
          {aside}
        </div>
      ) : null}
    </div>
  );
}

/** Keeps a block of the side column in view while a long form scrolls, below the 56px top bar (3.5rem) with a 2rem gap. */
export function StickyAside({ children }: { children: ReactNode }) {
  return <div className="lg:sticky lg:top-22">{children}</div>;
}

interface FormLayoutProps extends FormHeaderProps {
  aside?: ReactNode;
  children: ReactNode;
}

/** The frame of every create/edit page: the head, then the form column and its optional side column. */
export function FormLayout({ aside, children, ...header }: FormLayoutProps) {
  return (
    <div>
      <FormHeader {...header} />
      <FormColumns aside={aside}>{children}</FormColumns>
    </div>
  );
}
