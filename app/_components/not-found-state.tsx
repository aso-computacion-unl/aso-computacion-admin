import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotFoundStateProps {
  title: string;
  /** The one sentence that says why: what is gone and what the visitor can do about it. */
  children: ReactNode;
  /** The single way back, inside the same product. */
  href: string;
  actionLabel: string;
  /** The admin and the root page use the brand display face; the forum keeps its own title face. */
  face?: "display" | "forum";
}

const FACES = {
  display: "font-display text-[2rem] leading-[1.1]",
  forum: "text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight",
} as const;

/**
 * The 404 of every product (admin, forum, the root fallback). It carries no chrome of its own: each
 * product renders it inside its own shell, so only the title face and the way back differ.
 */
export function NotFoundState({ title, children, href, actionLabel, face = "display" }: NotFoundStateProps) {
  return (
    <section data-slot="not-found-state" className="grid max-w-xl justify-items-start gap-4 py-10 md:py-16">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded bg-card text-sky">
        <Icon name="search" className="size-6" />
      </span>
      <h1 className={cn("text-balance", FACES[face])}>{title}</h1>
      <p className="max-w-prose text-mist">{children}</p>
      <Button asChild variant="line">
        <Link href={href}>{actionLabel}</Link>
      </Button>
    </section>
  );
}
