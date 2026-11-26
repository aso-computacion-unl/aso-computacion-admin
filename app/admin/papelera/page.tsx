import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { purgeTrashed, restoreTrashed } from "@/interface/admin/trash/actions";
import { getAdminTrash } from "@/interface/admin/trash/trash-admin-read";
import { formatDeletedAt, groupTrash, purgeWarning, TRASH_KIND_LABELS } from "@/interface/admin/trash/trash-labels";

import { AreaTabs } from "../_components/area-tabs";
import { PageHeader } from "../_components/page-header";
import { SectionTitle } from "../_components/section-title";
import { DeleteButton, RestoreButton } from "../_components/row-actions";
import { EmptyState } from "../_components/empty-state";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminTrashPage() {
  const actor = await requirePageSession();
  const items = await getAdminTrash();
  const canPurge = actor.role === "ADMIN";

  return (
    <div>
      <AreaTabs area="ajustes" current="/admin/papelera" role={actor.role} />
      <PageHeader
        title="Papelera"
        action={
          canPurge ? (
            <Button asChild variant="line">
              <Link href="/admin/papelera/imagenes">Limpiar imágenes sin uso</Link>
            </Button>
          ) : undefined
        }
        status={items.length === 0 ? "Sin elementos" : `${items.length} ${items.length === 1 ? "elemento" : "elementos"}`}
        description={
          <>
            Lo que está aquí no se muestra en el sitio y, al restaurarlo, vuelve como borrador.{" "}
            {canPurge ? "Eliminar definitivamente borra también sus archivos y no se puede deshacer." : "Solo un administrador puede eliminar definitivamente."}
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon="trash"
          action={
            <Button asChild variant="line">
              <Link href="/admin">Volver al inicio</Link>
            </Button>
          }
        >
          La papelera está vacía.
        </EmptyState>
      ) : (
        // Kinds are 40 apart and their rows 6. From xl a row reads as columns: title | date | Restaurar | Eliminar
        // definitivamente; the date is as wide as the longest one («Eliminado el 28 sept 2026, 15:00») and the buttons
        // say the same in every row, so the columns line up across kinds too. A confirmation or an error takes a line of its own.
        <div className="mt-6 grid gap-10">
          {groupTrash(items).map(({ kind, items: group }) => (
            <section key={kind} aria-labelledby={`trash-${kind}`} className="grid gap-4">
              <SectionTitle id={`trash-${kind}`}>
                {TRASH_KIND_LABELS[kind]} <span className="ml-1 font-mono text-[0.8125rem] font-normal font-stretch-normal text-mist">{group.length}</span>
              </SectionTitle>
              <ul className={cn("grid gap-1.5 xl:gap-x-6", canPurge ? "xl:grid-cols-[minmax(0,1fr)_repeat(3,max-content)]" : "xl:grid-cols-[minmax(0,1fr)_repeat(2,max-content)]")}>
                {group.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded bg-card p-4 xl:col-span-full xl:grid xl:grid-cols-subgrid xl:px-5 xl:py-3.5 xl:[&>[role=group]]:col-span-full xl:[&>small]:order-last xl:[&>small]:col-span-full"
                  >
                    <div className="grid min-w-0 flex-1 basis-60 gap-1 xl:contents">
                      <p className="font-bold wrap-anywhere">{item.title}</p>
                      <p className="font-mono text-[0.8125rem] text-mist xl:w-[32ch]">Eliminado el {formatDeletedAt(item.deletedAt)}</p>
                    </div>
                    <RestoreButton label={item.title} action={restoreTrashed.bind(null, kind, item.id)} />
                    {canPurge ? (
                      <DeleteButton
                        label={item.title}
                        warning={purgeWarning(kind)}
                        note="Esta acción es irreversible: no se puede deshacer."
                        triggerLabel="Eliminar definitivamente"
                        confirmLabel="Sí, eliminar definitivamente"
                        successMessage="Eliminado definitivamente."
                        compactOnMobile={false}
                        action={purgeTrashed.bind(null, kind, item.id)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
