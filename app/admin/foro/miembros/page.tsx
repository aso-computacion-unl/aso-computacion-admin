import Link from "next/link";

import type { ForumMemberListItemResult } from "@/application/forum/forum-members.use-cases";
import { getAdminForumMembers } from "@/interface/admin/forum/forum-moderation-read";
import { memberListHref, parseMemberListParams, type MemberListParams } from "@/interface/admin/forum/member-list-params";
import { pluralize } from "@/interface/admin/publication-summary";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { cn } from "@/lib/utils";

import { EmptyState } from "../../_components/empty-state";
import { PageHeader } from "../../_components/page-header";
import { Stamp } from "../../_components/timeline-parts";
import { MembersPager } from "./_components/members-pager";
import { MembersSearch } from "./_components/members-search";
import { ReactivateButton } from "./_components/reactivate-button";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ estado?: string | string[]; q?: string | string[]; pagina?: string | string[] }>;

const DAY = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" });

const LINK = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sky underline-offset-4 hover:underline";

const FILTERS = [
  { filter: "all", label: "Todos" },
  { filter: "suspended", label: "Suspendidos" },
] as const;

/** One member: who they are for the moderators, whether the account is active, and the one step a suspended account offers. */
function MemberRow({ member }: { member: ForumMemberListItemResult }) {
  const suspended = member.status === "SUSPENDED";

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded bg-card p-4">
      <div className="grid min-w-0 gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-bold wrap-anywhere">{member.displayName}</span>
          <Stamp>{suspended ? "Suspendido" : "Activo"}</Stamp>
        </p>
        <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">{member.email}</p>
        <p className="font-mono text-[0.8125rem] text-mist">
          {[
            `Se unió el ${DAY.format(member.createdAt)}`,
            member.lastLoginAt ? `Último ingreso: ${DAY.format(member.lastLoginAt)}` : "Sin ingresos registrados",
            suspended && member.suspendedAt ? `Suspendido el ${DAY.format(member.suspendedAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {suspended ? <ReactivateButton memberId={member.id} name={member.displayName} /> : null}
    </li>
  );
}

/** What the list says when it has no rows: the forum has no members yet, no account is suspended, or the search matched nobody. */
function MembersEmpty({ filter, search }: Pick<MemberListParams, "filter" | "search">) {
  if (search !== "") {
    return (
      <p role="status" className="mt-8 max-w-xl text-mist">
        No hay miembros{filter === "suspended" ? " suspendidos" : ""} que coincidan con «{search}».{" "}
        <Link href={memberListHref({ filter, search: "", page: 1 })} className="rounded-xs text-foreground underline underline-offset-4">
          Quitar la búsqueda
        </Link>
      </p>
    );
  }

  return filter === "suspended" ? (
    <EmptyState icon="check">No hay cuentas suspendidas.</EmptyState>
  ) : (
    <EmptyState icon="msg">Todavía no hay miembros. Aparecen aquí cuando un estudiante entra al foro con su cuenta de la UNL.</EmptyState>
  );
}

export default async function AdminForumMembersPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePageSession();
  const { filter, search, page: requested } = parseMemberListParams(await searchParams);
  const members = await getAdminForumMembers({ filter, search, page: requested });

  return (
    <div>
      <PageHeader
        title="Miembros del foro"
        status={filter === "suspended" ? pluralize(members.total, "suspendido", "suspendidos") : pluralize(members.total, "miembro", "miembros")}
        description="Los estudiantes que entraron al foro con su cuenta de la UNL. Aquí puede reactivar una cuenta suspendida."
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <nav aria-label="Filtrar miembros">
          <ul className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <li key={option.filter}>
                <Link
                  href={memberListHref({ filter: option.filter, search, page: 1 })}
                  aria-current={option.filter === filter ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded border border-input px-3.5 text-sm font-semibold text-mist",
                    "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                    "aria-[current=true]:border-action aria-[current=true]:bg-action aria-[current=true]:text-on-action",
                  )}
                >
                  {option.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-x-6">
          <Link href="/admin/foro/reportes" className={LINK}>
            Reportes
          </Link>
          {actor.role === "ADMIN" ? (
            <Link href="/admin/foro/categorias" className={LINK}>
              Categorías
            </Link>
          ) : null}
        </div>
      </div>

      <MembersSearch filter={filter} search={search} />

      {members.items.length === 0 ? (
        <MembersEmpty filter={filter} search={search} />
      ) : (
        <ul className="mt-6 grid gap-2" aria-label="Miembros del foro">
          {members.items.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}

      <MembersPager filter={filter} search={search} page={members} />
    </div>
  );
}
