import { cn } from "@/lib/utils";
import type { WindowBadge as WindowBadgeData } from "@/interface/admin/publication-window-badge";

/** "Programado" / "Vencido" next to a published item that is not on the public site right now, with the when as text. */
export function WindowBadge({ badge, className }: { badge: WindowBadgeData | null; className?: string }) {
  if (!badge) {
    return null;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          "inline-flex h-6 items-center rounded-xs px-2 font-mono text-xs leading-none font-semibold",
          badge.label === "Programado" ? "bg-muted text-sky" : "bg-signal text-destructive-foreground",
        )}
      >
        {badge.label}
      </span>
      <span className="font-mono text-xs text-mist">{badge.detail}</span>
    </span>
  );
}
