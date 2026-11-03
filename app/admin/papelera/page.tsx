import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { purgeTrashed, restoreTrashed } from "@/interface/admin/trash/actions";
import { getAdminTrash } from "@/interface/admin/trash/trash-admin-read";
import { formatDeletedAt, groupTrash, purgeWarning, TRASH_KIND_LABELS } from "@/interface/admin/trash/trash-labels";

import { PageHead } from "../_components/page-head";
import { DeleteButton, RestoreButton } from "../_components/row-actions";
import { EmptyState } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminTrashPage() {
  const actor = await requirePageSession();
  const items = await getAdminTrash();
  const canPurge = actor.role === "ADMIN";

  return (
    <div>
      <PageHead title="Papelera" meta={items.length === 0 ? "Sin elementos" : `${items.length} ${items.length === 1 ? "elemento" : "elementos"}`} />
      <p className="mt-4 max-w-2xl text-mist">
        Lo que se mueve a la papelera deja de mostrarse en el sitio y se conserva aquí. Al restaurarlo vuelve como borrador: nada se publica por sí solo.
        {canPurge
          ? "Eliminar definitivamente borra el elemento y sus archivos, y no se puede deshacer."
          : "Solo un administrador puede eliminar definitivamente."}
      </p>
      {items.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="line">
              <Link href="/admin">Volver al inicio</Link>
            </Button>
          }
        >
          La papelera está vacía.
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-8">
          {groupTrash(items).map(({ kind, items: group }) => (
            <section key={kind} aria-labelledby={`trash-${kind}`} className="grid gap-3">
              <h2 id={`trash-${kind}`} className="text-lg font-bold font-stretch-[112%]">
                {TRASH_KIND_LABELS[kind]} <span className="font-mono text-[0.8125rem] font-semibold text-mist">{group.length}</span>
              </h2>
              <ul className="grid gap-3">
                {group.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded bg-card p-4">
                    <div className="grid min-w-0 flex-1 basis-60 gap-1">
                      <p className="font-bold wrap-anywhere">{item.title}</p>
                      <p className="font-mono text-[0.8125rem] text-mist">Eliminado el {formatDeletedAt(item.deletedAt)}</p>
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
