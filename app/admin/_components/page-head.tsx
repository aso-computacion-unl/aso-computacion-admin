import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface PageHeadProps {
  title: string;
  /** One mono line under the title, like a branch status: `main · 3 publicados · 1 borrador`. */
  meta?: ReactNode;
  action?: ReactNode;
}

export function PageHead({ title, meta, action }: PageHeadProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="font-display text-[2rem] leading-[1.1] -tracking-[0.01em] md:text-[2.5rem]">{title}</h1>
        {meta ? <p className="mt-1.5 font-mono text-[0.8125rem] text-mist">{meta}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-2 rounded px-1 text-sm font-semibold text-mist transition-colors duration-150 ease-out hover:text-white"
    >
      <Icon name="left" className="size-4" />
      {children}
    </Link>
  );
}

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

interface FormFrameProps {
  backHref: string;
  backLabel: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}

/** The head of every create/edit page: back link and title. */
export function FormFrame({ backHref, backLabel, title, meta, children }: FormFrameProps) {
  return (
    <div>
      <BackLink href={backHref}>{backLabel}</BackLink>
      <PageHead title={title} meta={meta} />
      {children}
    </div>
  );
}

interface FormColumnsProps {
  /** The right column on lg+: photos, the image panel, a preview. Below lg it stacks under the form. */
  aside?: ReactNode;
  /** Let the right column span the form's height, so a panel inside it can stick while the form scrolls. */
  stickyAside?: boolean;
  children: ReactNode;
}

/**
 * The form on the left and, when there is one, the side column on the right (a sticky save bar
 * inside the form keeps working in both). Without a side column the form keeps a readable width
 * instead of stretching across the screen.
 */
export function FormColumns({ aside, stickyAside = false, children }: FormColumnsProps) {
  return (
    <div
      className={cn(
        "mt-6 grid items-start gap-6",
        aside ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] xl:grid-cols-[minmax(0,1fr)_26rem]" : "max-w-4xl",
      )}
    >
      <div className="grid min-w-0 gap-6">{children}</div>
      {aside ? <div className={cn("grid min-w-0 content-start gap-6", stickyAside && "lg:self-stretch")}>{aside}</div> : null}
    </div>
  );
}

interface FormPageProps extends Omit<FormFrameProps, "children"> {
  aside?: ReactNode;
  children: ReactNode;
}

/** The frame of every create/edit page: the head, then the form column and its optional side column. */
export function FormPage({ aside, children, ...frame }: FormPageProps) {
  return (
    <FormFrame {...frame}>
      <FormColumns aside={aside}>{children}</FormColumns>
    </FormFrame>
  );
}

/** A quiet note for a side column that has nothing to show yet (a create page, before the first save). */
export function AsideNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 border-l-2 border-dashed border-sky pl-4">
      <h2 className="text-lg font-bold font-stretch-[112%]">{title}</h2>
      <p className="text-sm text-mist">{children}</p>
    </div>
  );
}
