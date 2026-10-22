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

/** A flat, raised surface for a form or a block of controls. Never nested. */
export function Panel({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded bg-card p-4 md:p-5", className)} {...props}>
      {children}
    </section>
  );
}

interface FormPageProps {
  backHref: string;
  backLabel: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}

/** The frame of every create/edit page: back link, title and a narrow column of panels. */
export function FormPage({ backHref, backLabel, title, meta, children }: FormPageProps) {
  return (
    <div className="max-w-2xl">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <PageHead title={title} meta={meta} />
      <div className="mt-6 grid gap-6">{children}</div>
    </div>
  );
}
