const ENTITY_LABELS: Record<string, string> = {
  event: "Evento",
  news: "Novedad",
  faq: "Pregunta frecuente",
  command: "Comando",
  social: "Red social",
  pillar: "Pilar",
  board: "Directiva",
  settings: "Sitio",
  user: "Usuario",
  session: "Sesión",
};

export function entityTypeLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

/** Who did it, by name; a deleted or unknown user never shows as an id. */
export function actorLabel(entry: { actorKind: "user" | "break_glass" | "system"; actorUserId: string | null }, names: ReadonlyMap<string, string>): string {
  if (entry.actorKind === "break_glass") return "Acceso de emergencia";
  if (entry.actorKind === "system") return "Sistema";

  return (entry.actorUserId && names.get(entry.actorUserId)) || "Usuario eliminado";
}

const FILTER_MAX_LENGTH = 64;

type Param = string | string[] | undefined;

const single = (value: Param) => (Array.isArray(value) ? value[0] : value);

function filter(value: Param): string | undefined {
  const text = single(value)?.trim();

  return text && text.length <= FILTER_MAX_LENGTH ? text : undefined;
}

export interface AuditFilters {
  entityType?: string;
  actor?: string;
}

/** The query string of `/admin/registro`, reduced to what it can mean: a page number and two short filters. */
export function parseAuditParams(params: { pagina?: Param; tipo?: Param; actor?: Param }): AuditFilters & { page: number } {
  const raw = single(params.pagina);
  const page = raw !== undefined && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;

  return { page, entityType: filter(params.tipo), actor: filter(params.actor) };
}

/** Link to a page of the log that keeps the filters. */
export function auditQuery({ entityType, actor }: AuditFilters, page: number): string {
  const query = new URLSearchParams();

  if (entityType) query.set("tipo", entityType);
  if (actor) query.set("actor", actor);
  if (page > 1) query.set("pagina", String(page));

  const text = query.toString();

  return text ? `/admin/registro?${text}` : "/admin/registro";
}
