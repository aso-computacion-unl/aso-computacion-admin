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

interface PageFrameProps {
  /** A page that is one column of controls, with nothing beside it: the frame shrinks to the form's width. */
  narrow?: boolean;
  children: ReactNode;
}

/**
 * The one width rule of the admin. A page is a frame whose left and right margins inside the content area are
 * equal, header and body together. The frame fills the content area (the layout's `main`, already centered)
 * unless the page is a lone form column: then it is that column's width (41.5rem) and centered, header
 * included, so the title and the fields share one left edge and no side of the screen is left blank.
 * Lists, dashboards and forms with a side column fill; empty states and not-found states center themselves.
 */
export function PageFrame({ narrow = false, children }: PageFrameProps) {
  return (
    <div data-slot="page-frame" data-width={narrow ? "narrow" : "fill"} className={cn(narrow && "mx-auto w-full max-w-166")}>
      {children}
    </div>
  );
}

interface FormColumnsProps {
  /** Media, a gallery or a live preview, beside the form on lg+ and under it on a phone. Never a note: a note is the description. */
  aside?: ReactNode;
  /** Let the side column span the form's height, so a panel inside it can stick while the form scrolls. */
  stickyAside?: boolean;
  children: ReactNode;
}

/**
 * The form column, and beside it the side column when there is something to put there. With a side column the
 * form takes the rest of the frame and the side column keeps its fixed width (26rem at xl), so the pair always
 * spans the frame. Without one the column takes the frame, which `FormLayout` has already narrowed to 41.5rem:
 * a small form never stretches across the screen and never reserves an empty column.
 */
export function FormColumns({ aside, stickyAside = false, children }: FormColumnsProps) {
  return (
    <div
      data-layout={aside ? "split" : "single"}
      className={cn("mt-6 grid items-start gap-6", aside && "lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] xl:grid-cols-[minmax(0,1fr)_26rem]")}
    >
      <div data-slot="form-column" className="grid min-w-0 gap-6">
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
    <PageFrame narrow={!aside}>
      <FormHeader {...header} />
      <FormColumns aside={aside}>{children}</FormColumns>
    </PageFrame>
  );
}
