"use client";

import { deleteForumCategory } from "@/interface/admin/forum/actions";

import { DeleteButton } from "../../../_components/row-actions";

/** Deleting a category is permanent and the server refuses it while the category still has threads. */
export function CategoryDeleteButton({ id, name }: { id: string; name: string }) {
  return (
    <DeleteButton
      label={name}
      triggerLabel="Eliminar"
      iconOnly
      confirmLabel="Sí, eliminar"
      warning={`¿Eliminar la categoría «${name}»?`}
      note="No se puede deshacer. Solo se puede eliminar si no tiene hilos."
      successMessage="Categoría eliminada."
      action={() => deleteForumCategory(id)}
    />
  );
}
