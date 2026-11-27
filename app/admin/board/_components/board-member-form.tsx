"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { EditorGroup, SPAN } from "../../_components/editor-split";
import { ActionBar, Field, FieldError, FormFeedback } from "../../_components/form-parts";
import { PUBLISHED_MESSAGE, PublishPreview, PublishSubmitButton, usePublishFlow, type PublishFormProps } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { BOARD_MEMBER_PUBLISH_FIELDS, BoardMemberPreview } from "./board-member-preview";

export interface BoardMemberFormValues {
  name: string;
  role: string;
  /** Alt of the member's current photo; the field shows only when `hasPhoto`, and a blank one is ignored without a photo. */
  photoAlt: string;
  isPublished: boolean;
}

export const EMPTY_BOARD_MEMBER_FORM_VALUES: BoardMemberFormValues = { name: "", role: "", photoAlt: "", isPublished: false };

interface BoardMemberFormProps extends PublishFormProps<BoardMemberFormValues> {
  hasPhoto?: boolean;
  /** The stored photo's address, so the preview before publishing shows it. */
  photoUrl?: string | null;
}

// Only name, role and photo exist for a member: no contact data is collected (S4).
export function BoardMemberForm({ action, submitLabel, initialValues = EMPTY_BOARD_MEMBER_FORM_VALUES, autosave = false, hasPhoto = false, photoUrl = null }: BoardMemberFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { autosave });
  // A published member asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const photoErrorId = `${useId()}-photo-error`;
  const photo = photoUrl ? { url: photoUrl } : null;

  return (
    <form ref={formRef} onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid">
      <div className="grid gap-10">
        {/* Spans by data type: name and role are short text (6 + 6), the photo's description a full row. */}
        <EditorGroup title="Contenido" purpose="Cómo aparece en la directiva">
          <Field label="Nombre" count={{ length: values.name.length, max: 60 }} error={errors.name} className={SPAN.text}>
            {(control) => <Input {...control} {...bind("name")} required maxLength={60} />}
          </Field>
          <Field label="Cargo" count={{ length: values.role.length, max: 60 }} error={errors.role} className={SPAN.text}>
            {(control) => <Input {...control} {...bind("role")} required maxLength={60} />}
          </Field>
          {hasPhoto ? (
            <Field label="Descripción de la foto" help="Para quien no ve la foto." count={{ length: values.photoAlt.length, max: 200 }} error={errors.photoAlt} className={SPAN.row}>
              {(control) => <Input {...control} {...bind("photoAlt")} required maxLength={200} />}
            </Field>
          ) : null}
        </EditorGroup>
        <EditorGroup title="Publicación">
          <div className={cn("grid gap-1", SPAN.row)}>
            <SwitchField
              label="Publicado"
              description={hasPhoto ? undefined : "Sin foto no se puede publicar: suba la foto primero."}
              {...toggle("isPublished")}
              aria-describedby={errors.photo ? photoErrorId : undefined}
              aria-invalid={errors.photo ? true : undefined}
            />
            {errors.photo ? <FieldError id={photoErrorId} announce={false}>{errors.photo}</FieldError> : null}
          </div>
        </EditorGroup>
      </div>
      <ActionBar className="mt-6" status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <PublishSubmitButton isPending={isPending} publishing={publishing} label={submitLabel} className="min-h-12" />
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={BOARD_MEMBER_PUBLISH_FIELDS}
          render={(shown, changed) => <BoardMemberPreview values={shown} photo={photo} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
