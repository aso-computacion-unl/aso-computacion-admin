import type { TrashItemResult, TrashKind } from "@/application/dto/trash-result.dto";
import { TRASH_KINDS } from "@/application/dto/trash-result.dto";

/** Section titles of the trash page: the same names the admin nav uses. */
export const TRASH_KIND_LABELS: Record<TrashKind, string> = {
  event: "Eventos",
  news: "Novedades",
  faq: "FAQ",
  command: "Comandos",
  social: "Redes",
  pillar: "Pilares",
  board: "Directiva",
};

// What a permanent delete takes with it: the row, and the stored files it points to.
const PURGE_SUBJECTS: Record<TrashKind, string> = {
  event: "este evento? Se borran el evento, sus fotos y los archivos de las fotos.",
  news: "esta noticia? Se borran la noticia y el archivo de su portada.",
  faq: "esta pregunta?",
  command: "este comando?",
  social: "esta red?",
  pillar: "este pilar? Se borran el pilar y el archivo de su imagen.",
  board: "a este integrante? Se borran sus datos y el archivo de su foto.",
};

export function purgeWarning(kind: TrashKind): string {
  return `¿Eliminar definitivamente ${PURGE_SUBJECTS[kind]}`;
}

const LOJA_TIME_ZONE = "America/Guayaquil";

/** "25 oct 2026, 21:30" where the board lives, so the time does not depend on the server's zone. */
export function formatDeletedAt(date: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: LOJA_TIME_ZONE,
  }).format(date);
}

export interface TrashGroup {
  kind: TrashKind;
  items: TrashItemResult[];
}

/** The trash split by kind in the fixed section order; each group keeps the incoming (newest first) order. */
export function groupTrash(items: readonly TrashItemResult[]): TrashGroup[] {
  return TRASH_KINDS.map((kind) => ({ kind, items: items.filter((item) => item.kind === kind) })).filter((group) => group.items.length > 0);
}
