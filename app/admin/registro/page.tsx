import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getAuditLogPage } from "@/interface/admin/audit/audit-admin-read";
import { actorLabel, auditQuery, entityTypeLabel } from "@/interface/admin/audit/audit-labels";
import { pluralize } from "@/interface/admin/publication-summary";

import { PageHead } from "../_components/page-head";
import { EmptyState } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "medium", timeZone: "America/Guayaquil" });

type SearchParams = Promise<{ pagina?: string | string[]; tipo?: string | string[]; actor?: string | string[] }>;

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { items, total, page, pageCount, entityTypes, filters, users } = await getAuditLogPage(await searchParams);
  const names = new Map(users.map((user) => [user.id, user.name]));
  const filtered = Boolean(filters.entityType || filters.actor);

  return (
    <div>
      <PageHead title="Registro de cambios" meta={`${pluralize(total, "entrada", "entradas")}${filtered ? " con este filtro" : ""} · lo más reciente primero`} />
      <p className="mt-4 max-w-2xl text-mist">
        Quién cambió qué y cuándo. Solo guarda nombres e identificadores: nunca el contenido de los textos ni contraseñas.
      </p>

      <form method="get" action="/admin/registro" className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3" aria-label="Filtrar el registro">
        <div className="grid min-w-44 gap-1.5">
          <Label htmlFor="audit-type">Tipo</Label>
          <Select id="audit-type" name="tipo" defaultValue={filters.entityType ?? ""}>
            <option value="">Todos</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {entityTypeLabel(type)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid min-w-44 gap-1.5">
          <Label htmlFor="audit-actor">Quién</Label>
          <Select id="audit-actor" name="actor" defaultValue={filters.actor ?? ""}>
            <option value="">Todos</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
            <option value="break_glass">Acceso de emergencia</option>
            <option value="system">Sistema</option>
          </Select>
        </div>
        <Button type="submit" variant="line" className="min-h-11">
          Filtrar
        </Button>
        {filtered ? (
          <Button asChild variant="quiet">
            <Link href="/admin/registro">Quitar filtros</Link>
          </Button>
        ) : null}
      </form>

      {items.length === 0 ? (
        <EmptyState>{filtered ? "Ninguna entrada coincide con el filtro." : "Todavía no hay entradas en el registro."}</EmptyState>
      ) : (
        <ol className="mt-6 grid gap-2" aria-label="Entradas del registro">
          {items.map((entry) => (
            <li key={entry.id} className="grid gap-1 rounded bg-card px-4 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-x-6">
              <time dateTime={entry.at.toISOString()} className="font-mono text-[0.8125rem] text-mist">
                {WHEN.format(entry.at)}
              </time>
              <div className="grid min-w-0 gap-0.5">
                <p className="wrap-anywhere">
                  <span className="font-bold">{actorLabel(entry, names)}</span> · {entry.summary}
                </p>
                <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">
                  {entityTypeLabel(entry.entityType)} · {entry.action}
                  {entry.entityId ? ` · ${entry.entityId}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Páginas del registro" className="mt-6 flex items-center gap-4">
          {page > 1 ? (
            <Button asChild variant="line" size="sm">
              <Link href={auditQuery(filters, page - 1)} rel="prev">
                Más recientes
              </Link>
            </Button>
          ) : null}
          <span className="font-mono text-[0.8125rem] text-mist">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Button asChild variant="line" size="sm">
              <Link href={auditQuery(filters, page + 1)} rel="next">
                Más antiguas
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
