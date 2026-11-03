import { publicationState, type Windowed } from "@/domain/publication-window";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export interface WindowBadge {
  label: "Programado" | "Vencido";
  detail: string;
}

/**
 * What a list shows next to a published item that is not on the public site right now: "Programado" until
 * its window opens, "Vencido" once it closed. Live items, drafts and items without a window show nothing.
 */
export function windowBadge(item: Windowed, now: Date): WindowBadge | null {
  const state = publicationState(item, now);

  if (state === "scheduled" && item.publishAt) {
    return { label: "Programado", detail: `Se publica el ${WHEN.format(item.publishAt)} (hora de Ecuador)` };
  }

  if (state === "expired" && item.unpublishAt) {
    return { label: "Vencido", detail: `Se retiró el ${WHEN.format(item.unpublishAt)} (hora de Ecuador)` };
  }

  return null;
}
