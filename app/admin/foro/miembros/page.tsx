import Link from "next/link";

import type { ForumMemberListItemResult } from "@/application/forum/forum-members.use-cases";
import { getAdminForumMembers } from "@/interface/admin/forum/forum-moderation-read";
import { memberListHref, parseMemberListParams, type MemberListParams } from "@/interface/admin/forum/member-list-params";
import { pluralize } from "@/interface/admin/publication-summary";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { cn } from "@/lib/utils";

import { EmptyState } from "../../_components/empty-state";
import { PageHeader } from "../../_components/page-header";
import { SectionTitle } from "../../_components/section-title";
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

const CHIP = "inline-flex items-center rounded-full px-2.5 text-xs leading-5 font-semibold whitespace-nowrap";
const DATE = "font-mono text-[0.8125rem] tabular-nums max-lg:col-span-full max-lg:text-mist lg:w-px lg:whitespace-nowrap";
const HEAD = "pt-3 pb-2.5 pr-6 text-left text-[0.8125rem] font-semibold whitespace-nowrap text-mist last:pr-0";
const CELL = "text-left align-middle font-normal lg:py-3 lg:pr-6 lg:last:pr-0";

/**
 * One member as a table row: name and email, the two dates in columns sized to them, the state and the one step a
 * suspended account offers. Below 1024px the row is a card of stacked lines (name and state on top, one date per line,
 * the button last), so the dates say what they are and nothing scrolls sideways.
 */
function MemberRow({ member }: { member: ForumMemberListItemResult }) {
  const suspended = member.status === "SUSPENDED";

  return (
    <tr className="max-lg:grid max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:gap-x-3 max-lg:gap-y-1 max-lg:rounded-card max-lg:bg-card max-lg:p-4 max-lg:ring-1 max-lg:ring-paper-ring max-lg:ring-inset lg:border-t lg:border-paper-ring">
      <th scope="row" className={cn(CELL, "max-lg:col-start-1 max-lg:row-start-1")}>
        <span className="grid min-w-0 gap-0.5">
          <span className="font-bold wrap-anywhere">{member.displayName}</span>
          <span className="font-mono text-[0.8125rem] text-mist wrap-anywhere">{member.email}</span>
        </span>
      </th>
      <td className={cn(CELL, DATE, "max-lg:mt-1")}>
        <span className="lg:hidden">Se unió el </span>
        {DAY.format(member.createdAt)}
      </td>
      <td className={cn(CELL, DATE)}>
        {member.lastLoginAt ? (
          <>
            <span className="lg:hidden">Último ingreso: </span>
            {DAY.format(member.lastLoginAt)}
          </>
        ) : (
          <span className="text-mist">Sin ingresos registrados</span>
        )}
      </td>
      <td className={cn(CELL, "max-lg:contents lg:w-px lg:whitespace-nowrap")}>
        <span className={cn(CHIP, "max-lg:col-start-2 max-lg:row-start-1 max-lg:self-start", suspended ? "bg-tint-red text-on-tint-red" : "text-mist shadow-[inset_0_0_0_1px_var(--color-border)]")}>
          {suspended ? "Suspendido" : "Activo"}
        </span>
        {suspended && member.suspendedAt ? (
          <span className="block font-mono text-[0.8125rem] text-mist tabular-nums max-lg:col-span-full lg:mt-1">
            <span className="lg:hidden">Suspendido </span>el {DAY.format(member.suspendedAt)}
          </span>
        ) : null}
      </td>
      <td className={cn(CELL, "max-lg:col-span-full max-lg:mt-2 max-lg:empty:hidden lg:w-px lg:text-right")}>
        {suspended ? <ReactivateButton memberId={member.id} name={member.displayName} /> : null}
      </td>
    </tr>
  );
}

/** The members of the page in one table with its column headers; the headers stay for screen readers on a phone. */
function MembersTable({ members }: { members: readonly ForumMemberListItemResult[] }) {
  return (
    <div className="lg:rounded-card lg:bg-card lg:px-5 lg:py-1 lg:ring-1 lg:ring-paper-ring lg:ring-inset">
      <table aria-label="Miembros del foro" className="w-full border-collapse max-lg:block">
        <thead className="max-lg:sr-only">
          <tr>
            <th scope="col" className={HEAD}>
              Miembro
            </th>
            <th scope="col" className={HEAD}>
              Se unió
            </th>
            <th scope="col" className={HEAD}>
              Último ingreso
            </th>
            <th scope="col" className={HEAD}>
              Estado
            </th>
            <th scope="col" className={HEAD}>
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody className="max-lg:grid max-lg:gap-2">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </tbody>
      </table>
    </div>
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

      {/* Filter, search and links share one row, each as wide as its content; below 1024px the search takes its own line under them. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <nav aria-label="Filtrar miembros">
          <ul className="inline-flex max-w-full gap-[3px] overflow-hidden rounded-segmented bg-field p-[3px]">
            {FILTERS.map((option) => (
              <li key={option.filter}>
                <Link
                  href={memberListHref({ filter: option.filter, search, page: 1 })}
                  aria-current={option.filter === filter ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap text-mist sm:px-4",
                    "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                    "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground",
                    "aria-[current=true]:bg-action aria-[current=true]:text-on-action",
                  )}
                >
                  {option.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <MembersSearch filter={filter} search={search} />
        <div className="ml-auto flex flex-wrap items-center gap-x-4 lg:gap-x-6">
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

      {members.items.length === 0 ? (
        <MembersEmpty filter={filter} search={search} />
      ) : (
        <section aria-labelledby="members-group" className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <SectionTitle id="members-group">{filter === "suspended" ? "Cuentas suspendidas" : "Todas las cuentas"}</SectionTitle>
            <p className="text-sm text-mist">Las más recientes primero</p>
          </div>
          <MembersTable members={members.items} />
        </section>
      )}

      <MembersPager filter={filter} search={search} page={members} />
    </div>
  );
}
