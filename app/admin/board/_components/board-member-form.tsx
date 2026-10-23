"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FieldError, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

export interface BoardMemberFormValues {
  name: string;
  role: string;
  /** Alt of the member's current photo; the field shows only when `hasPhoto`, and a blank one is ignored without a photo. */
  photoAlt: string;
  isPublished: boolean;
}

export const EMPTY_BOARD_MEMBER_FORM_VALUES: BoardMemberFormValues = { name: "", role: "", photoAlt: "", isPublished: false };

interface BoardMemberFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: BoardMemberFormValues;
  hasPhoto?: boolean;
}

// Only name, role and photo exist for a member: no contact data is collected (S4).
export function BoardMemberForm({ action, submitLabel, initialValues = EMPTY_BOARD_MEMBER_FORM_VALUES, hasPhoto = false }: BoardMemberFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <Field label="Nombre" hint="El nombre que se muestra en el sitio público. Hasta 60 caracteres." error={errors.name}>
          {(control) => <Input {...control} {...bind("name")} required maxLength={60} />}
        </Field>
        <Field label="Cargo" hint="Por ejemplo «Presidente». Hasta 60 caracteres." error={errors.role}>
          {(control) => <Input {...control} {...bind("role")} required maxLength={60} />}
        </Field>
      </div>
      {hasPhoto ? (
        <Field label="Descripción de la foto" hint="Obligatoria, para accesibilidad. Hasta 200 caracteres." error={errors.photoAlt}>
          {(control) => <Input {...control} {...bind("photoAlt")} required maxLength={200} />}
        </Field>
      ) : null}
      <div className="grid gap-1">
        <SwitchField
          label="Publicado"
          description={
            hasPhoto
              ? "Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización."
              : "Sin foto no se puede publicar: suba la foto primero."
          }
          {...toggle("isPublished")}
        />
        {errors.photo ? <FieldError>{errors.photo}</FieldError> : null}
      </div>
      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
