import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getAuditLogPage } from "@/interface/admin/audit/audit-admin-read";
import { actorLabel, auditQuery, entityTypeLabel } from "@/interface/admin/audit/audit-labels";
import { formatClock, groupByDay, shortId } from "@/interface/admin/day-groups";
import { pluralize } from "@/interface/admin/publication-summary";

import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ pagina?: string | string[]; tipo?: string | string[]; actor?: string | string[] }>;

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { items, total, page, pageCount, entityTypes, filters, users } = await getAuditLogPage(await searchParams);
  const names = new Map(users.map((user) => [user.id, user.name]));
  const filtered = Boolean(filters.entityType || filters.actor);
  const days = groupByDay(items, (entry) => entry.at, new Date());

  return (
    <div>
      <PageHeader
        title="Registro de cambios"
        status={`${pluralize(total, "entrada", "entradas")}${filtered ? " con este filtro" : ""} · lo más reciente primero`}
        description="Quién cambió qué y cuándo. Solo guarda nombres e identificadores: nunca el contenido de los textos ni contraseñas."
      />

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
        <EmptyState icon="list">{filtered ? "Ninguna entrada coincide con el filtro." : "Todavía no hay entradas en el registro."}</EmptyState>
      ) : (
        <div className="mt-6 grid gap-6" aria-label="Entradas del registro" role="group">
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`day-${day.key}`} className="grid gap-2">
              <h2 id={`day-${day.key}`} className="font-mono text-[0.8125rem] font-semibold text-mist first-letter:uppercase">
                {day.label} · {pluralize(day.items.length, "entrada", "entradas")}
              </h2>
              <ol className="divide-y divide-border overflow-hidden rounded bg-card">
                {day.items.map((entry) => (
                  <li key={entry.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 px-4 py-2.5">
                    <time dateTime={entry.at.toISOString()} className="pt-px font-mono text-[0.8125rem] whitespace-nowrap text-mist tabular-nums">
                      {formatClock(entry.at)}
                    </time>
                    <div className="grid min-w-0 gap-0.5">
                      <p className="wrap-anywhere">
                        <span className="font-bold">{actorLabel(entry, names)}</span> · {entry.summary}
                      </p>
                      <p className="font-mono text-xs text-mist">
                        {entityTypeLabel(entry.entityType)} · {entry.action}
                        {entry.entityId ? (
                          <span title={entry.entityId}>
                            {" · "}#{shortId(entry.entityId)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
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
