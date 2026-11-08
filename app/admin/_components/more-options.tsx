"use client";

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface MoreOptionsProps {
  /** A field inside has an error: the disclosure opens, and stays open, so the error is in sight. */
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}

/** The one closed disclosure of an editor: what a record needs to exist is on the page, the rest is here. */
export function MoreOptions({ invalid = false, className, children }: MoreOptionsProps) {
  const [opened, setOpened] = useState(false);

  return (
    <details open={opened || invalid} onToggle={(event) => setOpened(event.currentTarget.open)} className="group min-w-0 rounded border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded px-4 text-sm font-[650] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky [&::-webkit-details-marker]:hidden">
        Más opciones
        <Icon name="chev" className="size-4 transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className={cn("grid gap-x-4 gap-y-5 px-4 pt-2 pb-4 @xl:grid-cols-2", className)}>{children}</div>
    </details>
  );
}
