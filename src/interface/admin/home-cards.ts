export interface HomeCard {
  id: "foro" | "inscripciones" | "contenido";
  count: number;
  /** What the number counts, said after it: "reportes en el foro". */
  label: string;
  href: string;
  /** The one button of the card. */
  action: string;
}

export interface OpenRegistration {
  id: string;
  title: string;
  registered: number;
}

interface HomeCardsInput {
  /** Open forum reports, or null when the queue could not be read. */
  openReports: number | null;
  registration: OpenRegistration | null;
  draftsTotal: number;
  /** Where the last edited unpublished item is edited. */
  firstDraftHref: string | null;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * "Lo que te espera": the few things somebody can act on right now, from counts the admin already reads.
 * A card with nothing behind it is not built, so an empty result means everything is up to date.
 */
export function buildHomeCards({ openReports, registration, draftsTotal, firstDraftHref }: HomeCardsInput): HomeCard[] {
  const cards: HomeCard[] = [];

  if (openReports !== null && openReports > 0) {
    cards.push({ id: "foro", count: openReports, label: plural(openReports, "reporte en el foro", "reportes en el foro"), href: "/admin/foro/reportes", action: "Revisar" });
  }

  if (registration && registration.registered > 0) {
    cards.push({
      id: "inscripciones",
      count: registration.registered,
      label: `${plural(registration.registered, "inscrito", "inscritos")} en ${registration.title}`,
      href: `/admin/registrations?evento=${registration.id}`,
      action: "Ver inscritos",
    });
  }

  if (draftsTotal > 0 && firstDraftHref) {
    cards.push({ id: "contenido", count: draftsTotal, label: plural(draftsTotal, "borrador sin publicar", "borradores sin publicar"), href: firstDraftHref, action: "Continuar" });
  }

  return cards;
}

/** The first event of the upcoming list (soonest first) that still takes registrations. */
export function nextOpenRegistration(upcoming: readonly (OpenRegistration & { state: "open" | "full" | "closed" })[]): OpenRegistration | null {
  const row = upcoming.find((item) => item.state === "open");

  return row ? { id: row.id, title: row.title, registered: row.registered } : null;
}
