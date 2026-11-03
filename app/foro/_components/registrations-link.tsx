import Link from "next/link";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export const REGISTRATIONS_PATH = "/foro/eventos";

interface RegistrationsLinkProps {
  /** How many events are open for registration. */
  count: number;
  /** The visitor is on the registrations page. */
  current: boolean;
  /** Stacked in the side rail of wide screens; a row under the filters on phones. */
  orientation?: "horizontal" | "vertical";
}

/** The way into the registrations page: one entry with the number of events open, shaped like the Abiertos / Resueltos tabs. */
export function RegistrationsLink({ count, current, orientation = "vertical" }: RegistrationsLinkProps) {
  const vertical = orientation === "vertical";

  return (
    <nav aria-label="Eventos">
      <Link
        href={REGISTRATIONS_PATH}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold transition-colors",
          vertical ? "hover:bg-muted/70" : "hover:bg-card/60",
          current ? (vertical ? "bg-muted text-foreground shadow-[inset_3px_0_0_var(--color-signal)]" : "bg-card text-foreground shadow-[inset_0_-2px_0_var(--color-signal)]") : "text-mist hover:text-foreground",
        )}
      >
        <Icon name="events" className="size-4.5" />
        Inscripciones
        <span className="ml-auto min-w-6 rounded-full bg-foreground/12 px-1.5 text-center font-mono text-xs leading-6 text-foreground">
          {count}
          <span className="sr-only"> {count === 1 ? "abierta" : "abiertas"}</span>
        </span>
      </Link>
    </nav>
  );
}
