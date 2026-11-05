"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH, FORUM_CATEGORY_NAME_MAX_LENGTH } from "@/domain/forum";
import { FORUM_CATEGORY_FIELD_MESSAGES } from "@/interface/admin/field-messages";
import { createForumCategory, updateForumCategory } from "@/interface/admin/forum/actions";

import { ActionBar, Field, FormFeedback } from "../../../_components/form-parts";
import { useToast } from "../../../_components/toast";
import { useControlledForm } from "../../../_components/use-controlled-form";

export const CATEGORIES_PATH = "/admin/foro/categorias";

export interface CategoryFormValues {
  name: string;
  description: string;
  slug: string;
}

const EMPTY_VALUES: CategoryFormValues = { name: "", description: "", slug: "" };

type CategoryFormProps = { mode: "create" } | { mode: "edit"; id: string; initialValues: CategoryFormValues };

export function CategoryForm(props: CategoryFormProps) {
  const router = useRouter();
  const { notify } = useToast();
  const editing = props.mode === "edit";
  const action = props.mode === "edit" ? updateForumCategory.bind(null, props.id) : createForumCategory;
  const { bind, handleSubmit, state, isPending, errors } = useControlledForm(action, props.mode === "edit" ? props.initialValues : EMPTY_VALUES, { fieldMessages: FORUM_CATEGORY_FIELD_MESSAGES });
  const created = !editing && state?.success === true;

  // A new category has nothing left to edit: confirm it and go back to the list, where it now shows.
  useEffect(() => {
    if (!created) return;

    notify("Categoría creada.");
    router.push(CATEGORIES_PATH);
  }, [created, notify, router]);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <Field label="Nombre" error={errors.name}>
        {(control) => <Input {...control} {...bind("name")} required maxLength={FORUM_CATEGORY_NAME_MAX_LENGTH} />}
      </Field>
      <Field
        label="Descripción (opcional)"
        hint={editing ? `Hasta ${FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH} caracteres. Si la deja vacía, se conserva la actual.` : `Hasta ${FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH} caracteres. Los estudiantes la ven junto al nombre.`}
        error={errors.description}
      >
        {(control) => <Textarea {...control} {...bind("description")} rows={3} maxLength={FORUM_CATEGORY_DESCRIPTION_MAX_LENGTH} />}
      </Field>
      <Field
        label="Dirección (opcional)"
        hint={
          editing
            ? "Minúsculas, números y guiones. Si la deja vacía, se conserva la actual. Cambiarla rompe los enlaces que ya apuntan a esta categoría."
            : "Minúsculas, números y guiones. Si la deja vacía, se genera a partir del nombre."
        }
        error={errors.slug}
      >
        {(control) => <Input {...control} {...bind("slug")} autoCapitalize="off" autoComplete="off" spellCheck={false} className="font-mono" />}
      </Field>
      {/* A new category gets its own "Categoría creada." toast above. */}
      <ActionBar status={<FormFeedback state={state} toast={editing} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </ActionBar>
    </form>
  );
}
